import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test, expect} from '@playwright/test';

async function openBank(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#reviewFilter')).toBeAttached();
  await expect.poll(
    () => page.evaluate(() => document.querySelector('main')?.getAttribute('aria-busy'))
  ).toBe('false');
  await expect(page.locator('.study-item').first()).toBeAttached();
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

test('standalone build keeps lecture-page placeholders instead of transparent fake images', async ({page}) => {
  const offlineFile = pathToFileURL(
    resolve('dist/offline/Medical_MEQ_Review_Bank_Offline.html')
  ).href;
  await page.goto(offlineFile, {waitUntil: 'domcontentloaded'});

  await expect(page.locator('.visual-placeholder').first()).toBeAttached();
  await expect(page.locator('img[src^="data:image/gif;base64,R0lGODlhAQABAAD"]')).toHaveCount(0);
  await expect(page.locator('.visual-placeholder').first()).toContainText(/Lecture page|Lecture source/);
});

test('one broken lecture response does not hide the remaining subject lectures', async ({page}) => {
  await page.route('**/lectures/data/urology-urolithiasis.json', route =>
    route.fulfill({status: 500, contentType: 'application/json', body: '{}'}));

  await openBank(page);
  await expect(page.locator('.lecture')).toHaveCount(6);
  await expect(page.locator('#lecture-urology-congenital-anomalies')).toBeVisible();
  await expect(page.locator('#appToast')).toContainText('1 lecture could not be loaded');
});
