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
  await expect.poll(() => page.evaluate(() => localStorage.getItem('medicalBankStatusV2')))
    .toBe(JSON.stringify({'urology-congenital-anomalies::core::backup-safety': 'mastered'}));
});

test('standalone build embeds all verified Bladder Cancer, Urolithiasis and Renal Tumors images', async ({page}) => {
  const offlineFile = pathToFileURL(
    resolve('dist/offline/Medical_MEQ_Review_Bank_Offline.html')
  ).href;
  await page.goto(offlineFile, {waitUntil: 'domcontentloaded'});

  const bladder = page.locator('#lecture-urology-bladder-cancer .image-card img[src^="data:image/avif;base64,"]');
  const stones = page.locator('#lecture-urology-urolithiasis .image-card img[src^="data:image/avif;base64,"]');
  const renal = page.locator('#lecture-urology-renal-tumors .image-card img[src^="data:image/avif;base64,"]');
  await expect(bladder).toHaveCount(8);
  await expect(stones).toHaveCount(10);
  await expect(renal).toHaveCount(6);
  await expect(page.locator('img[src^="data:image/gif;base64,R0lGODlhAQABAAD"]')).toHaveCount(0);

  expect(await hasValidEmbeddedAvif(bladder.first())).toBe(true);
  expect(await hasValidEmbeddedAvif(stones.first())).toBe(true);
  expect(await hasValidEmbeddedAvif(renal.first())).toBe(true);
});

test('online lecture JSON embeds verified AVIF assets for all 24 reviewed image questions', async ({page}) => {
  await openBank(page);
  await expect(page.locator('#lecture-urology-bladder-cancer .image-card img[src^="data:image/avif;base64,"]')).toHaveCount(8);
  await expect(page.locator('#lecture-urology-urolithiasis .image-card img[src^="data:image/avif;base64,"]')).toHaveCount(10);
  await expect(page.locator('#lecture-urology-renal-tumors .image-card img[src^="data:image/avif;base64,"]')).toHaveCount(6);
});

test('one broken lecture response does not hide the remaining subject lectures', async ({page}) => {
  await page.addInitScript(() => {
    globalThis.__meqLectureLoadErrors = [];
    document.addEventListener('meq:lecture-load-errors', event => {
      globalThis.__meqLectureLoadErrors.push(event.detail);
    });
  });
  await page.route('**/lectures/data/urology-urolithiasis.json', route =>
    route.fulfill({status: 500, contentType: 'application/json', body: '{}'}));

  await openBank(page);
  await expect(page.locator('#lecture-urology-urolithiasis')).toHaveCount(0);
  await expect(page.locator('.lecture')).toHaveCount(7);
  await expect(page.locator('#lecture-urology-congenital-anomalies')).toBeVisible();
  await expect(page.locator('#lecture-urology-renal-tumors')).toBeVisible();
  await expect.poll(
    () => page.evaluate(() => globalThis.__meqLectureLoadErrors?.[0]?.lectureIds || [])
  ).toEqual(['urology-urolithiasis']);
});

test('failed subject retry is possible after the first rejected load', async ({page}) => {
  let failCatalog = true;
  await page.route('**/lectures/catalog.json', async route => {
    if (failCatalog) {
      failCatalog = false;
      await route.fulfill({status: 503, contentType: 'application/json', body: '{}'});
      return;
    }
    await route.continue();
  });

  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#emptyMessage')).toContainText('could not be loaded');
  const result = await page.evaluate(() => globalThis.MEQLectureLoader.loadSubject('urology'));
  expect(result.failed).toEqual([]);
  await expect(page.locator('#lecture-urology-congenital-anomalies')).toBeVisible();
});

test('responsive sidebar initialization cannot persist storage writes', async ({page}) => {
  await page.addInitScript(() => {
    globalThis.__meqSidebarWrites = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (String(key).includes('HideLectures') || String(key).includes('HideSubtopics')) {
        globalThis.__meqSidebarWrites.push([key, value]);
      }
      return original.call(this, key, value);
    };
  });
  await openBank(page);
  expect(await page.evaluate(() => globalThis.__meqSidebarWrites)).toEqual([]);
});

test('responsive sidebar resize preserves the saved desktop preference', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('medicalBankHideLecturesV4', '1');
    localStorage.setItem('medicalBankHideSubtopicsV4', '0');
  });
  await page.setViewportSize({width: 1280, height: 900});
  await openBank(page);
  await expect(page.locator('#mainLayout')).toHaveClass(/hide-lectures/);
  await page.setViewportSize({width: 480, height: 900});
  await expect(page.locator('#mainLayout')).not.toHaveClass(/hide-lectures/);
  await page.setViewportSize({width: 1280, height: 900});
  await expect(page.locator('#mainLayout')).toHaveClass(/hide-lectures/);
  expect(await page.evaluate(() => localStorage.getItem('medicalBankHideLecturesV4'))).toBe('1');
});

test('search input remains observable while filtering is debounced', async ({page}) => {
  await openBank(page);
  await page.evaluate(() => {
    globalThis.__meqSearchInputEvents = 0;
    document.getElementById('search')?.addEventListener('input', () => {
      globalThis.__meqSearchInputEvents += 1;
    });
  });
  await page.locator('#search').fill('Wilms');
  await expect.poll(() => page.evaluate(() => globalThis.__meqSearchInputEvents)).toBe(1);
  await expect.poll(() => page.locator('.study-item:not(.hidden)').count()).toBeGreaterThan(0);
});
