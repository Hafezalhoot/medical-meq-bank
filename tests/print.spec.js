import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

async function openBank(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#reviewFilter')).toBeAttached();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false', {timeout: 15_000});
  await expect(page.locator('.study-item').first()).toBeAttached();
  await expect(page.locator('#printCenterQuickBtn')).toBeAttached();
}

test('print center builds a complete worksheet document with saved pagination settings', async ({page, context}) => {
  await context.addInitScript(() => {
    window.print = () => {
      globalThis.__medicalBankNativePrintCalled = true;
    };
  });

  await openBank(page);
  await page.locator('#printCenterQuickBtn').click();

  const modal = page.locator('#printCenterModal');
  await expect(modal).toBeVisible();
  await expect(page.locator('#printCenterTitle')).toHaveText('Print & PDF Center');
  await expect(page.locator('#printSelectionCount')).not.toHaveText(/^0 printable items/);
  await expect(page.locator('#printCenterClose')).toBeFocused();

  await page.locator('input[name="printMode"][value="worksheet"]').check();
  await page.locator('#printSpaceSize').selectOption('compact');
  await page.locator('#printQuestionsPerPage').selectOption('2');
  await page.locator('#printMarginPreset').selectOption('standard');
  await page.locator('#printDetailLevel').selectOption('clean');

  await expect(page.locator('#worksheetPrintOptions')).toBeVisible();
  await expect(page.locator('#printPaginationBadge')).toHaveText('2/PAGE');

  await page.locator('#printCenterCreate').click();
  await expect.poll(
    () => page.evaluate(() => Boolean(globalThis.__medicalBankLastPrintHTML)),
    {timeout: 20_000}
  ).toBe(true);

  const generated = await page.evaluate(() => ({
    html: globalThis.__medicalBankLastPrintHTML,
    settings: globalThis.__medicalBankLastPrintSettings,
    pagination: globalThis.__medicalBankLastPaginationResult
  }));

  expect(generated.settings).toMatchObject({
    mode: 'worksheet',
    spaceSize: 'compact',
    questionsPerPage: '2',
    marginPreset: 'standard',
    detailLevel: 'clean'
  });
  expect(generated.html).toContain('Handwritten worksheet');
  expect(generated.html).toContain('class="print-item');
  expect(generated.html).toContain('class="answer-space"');
  expect(generated.html).toContain('data-page-count=');
  expect(generated.pagination?.pages || 0).toBeGreaterThan(0);

  await expect.poll(
    () => page.evaluate(() => localStorage.getItem('medicalBankPrintSettingsV1'))
  ).not.toBeNull();

  for (const candidate of context.pages()) {
    if (candidate !== page) await candidate.close();
  }
});


test('print center close control meets the minimum interaction target', async ({page}) => {
  await openBank(page);
  await page.locator('#printCenterQuickBtn').click();
  const box = await page.locator('#printCenterClose').boundingBox();
  expect(box).toBeTruthy();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
});
