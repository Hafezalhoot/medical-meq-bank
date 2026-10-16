import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test, expect} from '@playwright/test';

// These tests exercise storage and network-failure behavior directly. The
// dedicated service-worker lifecycle and offline coverage lives in app.spec.js.
test.use({serviceWorkers: 'block'});

async function openBank(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#reviewFilter')).toBeAttached();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false', {timeout: 15_000});
  await expect(page.locator('.study-item').first()).toBeAttached();
}

async function hasValidEmbeddedAvif(locator) {
  return locator.evaluate(image => {
    const prefix = 'data:image/avif;base64,';
    const source = image.getAttribute('src') || '';
    if (!source.startsWith(prefix)) return false;
    try {
      const payload = atob(source.slice(prefix.length));
      if (payload.length < 16 || payload.slice(4, 8) !== 'ftyp') return false;
      const brands = payload.slice(8, 32);
      return brands.includes('avif') || brands.includes('avis');
    } catch (error) {
      return false;
    }
  });
}

test('invalid progress backup is rejected without deleting current progress', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('medicalBankStatusV2', JSON.stringify({
      'urology-congenital-anomalies::core::backup-safety': 'mastered'
    }));
  });
  await openBank(page);

  const invalidBackup = JSON.stringify({
    schema: 'medical-meq-progress',
    schemaVersion: 1,
    storage: {
      medicalBankStatusV2: JSON.stringify({
        'urology-congenital-anomalies::core::backup-safety': 'invalid-level'
      })
    }
  });

  await page.locator('#importProgressFile').setInputFiles({
    name: 'invalid-progress.json',
    mimeType: 'application/json',
    buffer: Buffer.from(invalidBackup)
  });

  await expect(page.locator('#appToast')).toContainText('current progress was kept');
  await expect.poll(
    () => page.evaluate(() => globalThis.MEQProgressStore?.exportAll?.())
  ).toEqual({'urology-congenital-anomalies::core::backup-safety': 'mastered'});
  await expect.poll(
    () => page.evaluate(() => localStorage.getItem('medicalBankStatusV2'))
  ).toBeNull();
});

test('standalone build embeds all verified Bladder Cancer, Urolithiasis and Renal Tumors images', async ({page}) => {
  const offlineFile = pathToFileURL(
    resolve('dist/offline/Medical_MEQ_Review_Bank_Offline.html')
  ).href;
  await page.goto(offlineFile, {waitUntil: 'domcontentloaded'});

  const checked = [];
  for (const [lectureId, imageCount] of [
    ['urology-bladder-cancer', 8],
    ['urology-urolithiasis', 10],
    ['urology-renal-tumors', 6]
  ]) {
    await page.locator('#lectureFilter').selectOption(lectureId);
    const images = page.locator(`#lecture-${lectureId} .image-card img[src^="data:image/avif;base64,"]`);
    await expect(images).toHaveCount(imageCount);
    expect(await hasValidEmbeddedAvif(images.first())).toBe(true);
    checked.push(imageCount);
  }
  expect(checked).toEqual([8, 10, 6]);
  await expect(page.locator('img[src^="data:image/gif;base64,R0lGODlhAQABAAD"]')).toHaveCount(0);
});

test('online lecture JSON embeds verified AVIF assets when each reviewed lecture is opened', async ({page}) => {
  await openBank(page);

  for (const [lectureId, imageCount] of [
    ['urology-bladder-cancer', 8],
    ['urology-urolithiasis', 10],
    ['urology-renal-tumors', 6]
  ]) {
    await page.locator('#lectureFilter').selectOption(lectureId);
    await expect(page.locator(`#lecture-${lectureId}`)).toBeVisible();
    await expect(page.locator(`#lecture-${lectureId} .image-card img[src^="data:image/avif;base64,"]`)).toHaveCount(imageCount);
    await expect(page.locator('.lecture')).toHaveCount(1);
  }
});

test('one broken lecture response does not hide catalog metadata or other lectures', async ({page}) => {
  await page.addInitScript(() => {
    globalThis.__meqLectureLoadErrors = [];
    document.addEventListener('meq:lecture-load-errors', event => {
      globalThis.__meqLectureLoadErrors.push(event.detail);
    });
  });
  await page.route('**/lectures/data/urology-urolithiasis.json', route =>
    route.fulfill({status: 500, contentType: 'application/json', body: '{}'}));

  await openBank(page);
  await expect(page.locator('#lectureFilter option[value="urology-urolithiasis"]')).toHaveCount(1);
  await page.locator('#lectureFilter').selectOption('urology-urolithiasis');
  await expect.poll(
    () => page.evaluate(() => globalThis.__meqLectureLoadErrors?.at(-1)?.lectureIds || [])
  ).toEqual(['urology-urolithiasis']);
  await expect(page.locator('#lecture-urology-urolithiasis')).toHaveCount(0);

  await page.locator('#lectureFilter').selectOption('urology-congenital-anomalies');
  await expect(page.locator('#lecture-urology-congenital-anomalies')).toBeVisible();
  await expect(page.locator('.lecture')).toHaveCount(1);

  await page.locator('#lectureFilter').selectOption('urology-renal-tumors');
  await expect(page.locator('#lecture-urology-renal-tumors')).toBeVisible();
  await expect(page.locator('.lecture')).toHaveCount(1);
});


test('backup import rolls back progress and preferences when progress replacement fails', async ({page}) => {
  await openBank(page);

  await page.evaluate(async () => {
    localStorage.setItem('medicalBankDarkV4', '0');
    const original = globalThis.MEQProgressStore;
    await original.replaceAll({
      'urology-congenital-anomalies::core::backup-before': 'mastered'
    });

    let replaceCalls = 0;
    globalThis.MEQProgressStore = {
      ...original,
      replaceAll: async progress => {
        replaceCalls += 1;
        if (replaceCalls === 1) throw new Error('simulated progress replacement failure');
        return original.replaceAll(progress);
      }
    };
  });

  const backup = JSON.stringify({
    schema: 'medical-meq-progress',
    schemaVersion: 2,
    preferences: {
      medicalBankDarkV4: '1'
    },
    progress: {
      'urology-congenital-anomalies::core::backup-after': 'review'
    }
  });

  await page.locator('#importProgressFile').setInputFiles({
    name: 'progress-v2-rollback.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup)
  });

  await expect(page.locator('#appToast')).toContainText('current progress was kept');
  await expect.poll(
    () => page.evaluate(() => globalThis.MEQProgressStore?.exportAll?.())
  ).toEqual({'urology-congenital-anomalies::core::backup-before': 'mastered'});
  await expect.poll(
    () => page.evaluate(() => localStorage.getItem('medicalBankDarkV4'))
  ).toBe('0');
});


test('backup import reports when automatic rollback also fails', async ({page}) => {
  await openBank(page);

  await page.evaluate(async () => {
    localStorage.setItem('medicalBankDarkV4', '0');
    const original = globalThis.MEQProgressStore;
    await original.replaceAll({
      'urology-congenital-anomalies::core::rollback-before': 'mastered'
    });

    let replaceCalls = 0;
    globalThis.MEQProgressStore = {
      ...original,
      replaceAll: async progress => {
        replaceCalls += 1;
        if (replaceCalls === 1) return original.replaceAll(progress);
        throw new Error('simulated rollback replacement failure');
      },
      snapshotNow: async () => {
        if (replaceCalls === 1) throw new Error('simulated post-write snapshot failure');
        return original.snapshotNow();
      }
    };
  });

  const backup = JSON.stringify({
    schema: 'medical-meq-progress',
    schemaVersion: 2,
    preferences: {
      medicalBankDarkV4: '1'
    },
    progress: {
      'urology-congenital-anomalies::core::rollback-after': 'review'
    }
  });

  await page.locator('#importProgressFile').setInputFiles({
    name: 'progress-v2-rollback-failure.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup)
  });

  await expect(page.locator('#appToast')).toContainText('automatic rollback could not complete');
  await expect.poll(
    () => page.evaluate(() => globalThis.MEQProgressStore?.exportAll?.())
  ).toEqual({'urology-congenital-anomalies::core::rollback-after': 'review'});
  await expect.poll(
    () => page.evaluate(() => localStorage.getItem('medicalBankDarkV4'))
  ).toBe('0');
});


test('backup schema v2 restores progress and preferences transactionally', async ({page}) => {
  await openBank(page);

  const backup = JSON.stringify({
    schema: 'medical-meq-progress',
    schemaVersion: 2,
    preferences: {
      medicalBankDarkV4: '1'
    },
    progress: {
      'urology-congenital-anomalies::core::backup-v2': 'review'
    }
  });

  await page.locator('#importProgressFile').setInputFiles({
    name: 'progress-v2.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup)
  });

  await expect(page.locator('#appToast')).toContainText('Progress restored');
  await expect.poll(
    () => page.evaluate(() => globalThis.MEQProgressStore?.exportAll?.())
  ).toEqual({'urology-congenital-anomalies::core::backup-v2': 'review'});
  await expect.poll(
    () => page.evaluate(() => localStorage.getItem('medicalBankDarkV4'))
  ).toBe('1');
});
