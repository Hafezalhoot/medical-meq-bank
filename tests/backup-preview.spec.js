import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

async function ready(page, width = 1440) {
  await page.setViewportSize({width, height: 820});
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy', 'false', {timeout: 20_000});
  await expect.poll(() => page.evaluate(() => globalThis.MEQProgressStore?.ready))
    .toMatchObject({available: true});
}

const current = {
  'urology-congenital-anomalies::core::old-rating': 'mastered',
  'urology-congenital-anomalies::core::changed-rating': 'review'
};
const imported = {
  'urology-congenital-anomalies::core::changed-rating': 'weak',
  'internal-medicine-ii-psychiatry-anxiety-disorders::mcq::new-rating': 'mastered'
};

function backup(progress = imported, preferences = {'medicalBankDarkV4': '1'}) {
  return {
    name: 'my-study-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      schema: 'medical-meq-progress',
      schemaVersion: 2,
      preferences,
      progress
    }))
  };
}

test('choosing a backup previews losses and changes without touching saved ratings', async ({page}) => {
  await ready(page);
  await page.evaluate(async ratings => {
    await globalThis.MEQProgressStore.replaceAll(ratings);
    localStorage.setItem('medicalBankDarkV4', '0');
  }, current);

  await page.locator('#importProgressFile').setInputFiles(backup());
  const modal = page.locator('#restorePreviewDialog');
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('#restorePreviewFile')).toHaveText('my-study-backup.json');
  await expect(page.locator('#restoreCurrentCount')).toHaveText('2');
  await expect(page.locator('#restoreIncomingCount')).toHaveText('2');
  await expect(page.locator('#restoreRemovedCount')).toHaveText('1');
  await expect(page.locator('#restoreChangedCount')).toHaveText('1');
  await expect(page.locator('#restorePreviewNotice')).toContainText('Restoring will replace');
  expect(await page.evaluate(() => globalThis.MEQProgressStore.exportAll())).toEqual(current);
  expect(await page.evaluate(() => localStorage.getItem('medicalBankDarkV4'))).toBe('0');

  await page.locator('#restorePreviewCancel').click();
  await expect(modal).toBeHidden();
  expect(await page.evaluate(() => globalThis.MEQProgressStore.exportAll())).toEqual(current);

  // Re-selecting the same file works after Cancel, and only explicit approval writes.
  await page.locator('#importProgressFile').setInputFiles(backup());
  await expect(modal).toBeVisible();
  await page.locator('#restorePreviewConfirm').click();
  await expect(page.locator('#appToast')).toContainText('Progress restored');
  await expect.poll(() => page.evaluate(() => globalThis.MEQProgressStore.exportAll()))
    .toEqual(imported);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('medicalBankDarkV4'))).toBe('1');
});

test('Escape cancels an empty backup that would erase all ratings on a 320px phone', async ({page}) => {
  await ready(page, 320);
  await page.evaluate(async ratings => {
    await globalThis.MEQProgressStore.replaceAll(ratings);
  }, current);

  await page.locator('#importProgressFile').setInputFiles(backup({}, {}));
  await expect(page.locator('#restorePreviewDialog')).toBeVisible();
  await expect(page.locator('#restoreIncomingCount')).toHaveText('0');
  await expect(page.locator('#restoreRemovedCount')).toHaveText('2');
  await expect(page.locator('#restorePreviewNotice')).toContainText('erase every current rating');
  const boxes = await page.evaluate(() => ({
    viewport: innerWidth,
    scroll: document.documentElement.scrollWidth,
    confirm: document.getElementById('restorePreviewConfirm').getBoundingClientRect().toJSON()
  }));
  expect(boxes.scroll).toBeLessThanOrEqual(boxes.viewport + 1);
  expect(boxes.confirm.width).toBeGreaterThanOrEqual(100);
  expect(boxes.confirm.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape');
  await expect(page.locator('#restorePreviewDialog')).toBeHidden();
  expect(await page.evaluate(() => globalThis.MEQProgressStore.exportAll())).toEqual(current);
});

test('current progress can be downloaded before confirming a restore', async ({page}) => {
  await ready(page);
  await page.evaluate(async ratings => globalThis.MEQProgressStore.replaceAll(ratings), current);
  await page.locator('#importProgressFile').setInputFiles(backup());
  await expect(page.locator('#restorePreviewDialog')).toBeVisible();
  const filePromise = page.waitForEvent('download');
  await page.locator('#restorePreviewBackup').click();
  const downloaded = await filePromise;
  expect(downloaded.suggestedFilename()).toMatch(/^medical-meq-progress-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.locator('#restorePreviewDialog')).toBeVisible();
  expect(await page.evaluate(() => globalThis.MEQProgressStore.exportAll())).toEqual(current);
  await page.locator('#restorePreviewCancel').click();
});

test('a confirmed in-flight restore cannot be dismissed as if it were cancelled', async ({page}) => {
  await ready(page);
  await page.evaluate(async ratings => {
    const original = globalThis.MEQProgressStore;
    await original.replaceAll(ratings);
    globalThis.MEQProgressStore = {
      ...original,
      replaceAll: async next => {
        await new Promise(resolve => { window.__finishRestore = resolve; });
        return original.replaceAll(next);
      }
    };
  }, current);

  await page.locator('#importProgressFile').setInputFiles(backup());
  await expect(page.locator('#restorePreviewDialog')).toBeVisible();
  await page.locator('#restorePreviewConfirm').click();
  await expect(page.locator('#restorePreviewDialog')).toHaveAttribute('aria-busy', 'true');
  await expect.poll(() => page.evaluate(() => typeof window.__finishRestore)).toBe('function');

  await page.keyboard.press('Escape');
  await expect(page.locator('#restorePreviewDialog')).toBeVisible();
  await expect(page.locator('#restorePreviewCancel')).toBeDisabled();
  await expect(page.locator('#restorePreviewBackup')).toBeDisabled();

  await page.evaluate(() => window.__finishRestore());
  await expect(page.locator('#appToast')).toContainText('Progress restored');
  await expect.poll(() => page.evaluate(() => globalThis.MEQProgressStore.exportAll()))
    .toEqual(imported);
});
