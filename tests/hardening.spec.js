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

test('standalone build embeds all verified Bladder Cancer and Urolithiasis images', async ({page}) => {
  const offlineFile = pathToFileURL(
    resolve('dist/offline/Medical_MEQ_Review_Bank_Offline.html')
  ).href;
  await page.goto(offlineFile, {waitUntil: 'domcontentloaded'});

  const bladder = page.locator('#lecture-urology-bladder-cancer .image-card img[src^="data:image/avif;base64,"]');
  const stones = page.locator('#lecture-urology-urolithiasis .image-card img[src^="data:image/avif;base64,"]');
  await expect(bladder).toHaveCount(8);
  await expect(stones).toHaveCount(10);
  await expect(page.locator('img[src^="data:image/gif;base64,R0lGODlhAQABAAD"]')).toHaveCount(0);

  await bladder.first().scrollIntoViewIfNeeded();
  await expect.poll(() => bladder.first().evaluate(image => image.naturalWidth > 0)).toBe(true);
  await stones.first().scrollIntoViewIfNeeded();
  await expect.poll(() => stones.first().evaluate(image => image.naturalWidth > 0)).toBe(true);
});

test('online lecture JSON embeds verified AVIF assets for all 18 new image questions', async ({page}) => {
  await openBank(page);
  await expect(page.locator('#lecture-urology-bladder-cancer .image-card img[src^="data:image/avif;base64,"]')).toHaveCount(8);
  await expect(page.locator('#lecture-urology-urolithiasis .image-card img[src^="data:image/avif;base64,"]')).toHaveCount(10);
});

test('one broken lecture response does not hide the remaining subject lectures', async ({page}) => {
  await page.route('**/lectures/data/urology-urolithiasis.json', route =>
    route.fulfill({status: 500, contentType: 'application/json', body: '{}'}));

  await openBank(page);
  await expect(page.locator('.lecture')).toHaveCount(6);
  await expect(page.locator('#lecture-urology-congenital-anomalies')).toBeVisible();
  await expect(page.locator('#appToast')).toContainText('1 lecture could not be loaded');
});
