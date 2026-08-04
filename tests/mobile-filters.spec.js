import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

async function openMobileBank(page) {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#reviewFilter')).toBeAttached();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false', {timeout: 15_000});
  await expect(page.locator('#mobileFiltersToggle')).toBeVisible();
}

test('a single lecture filter produces one removable mobile chip', async ({page}) => {
  await openMobileBank(page);

  await page.locator('#mobileFiltersToggle').click();
  const lectureFilter = page.locator('#lectureFilter');
  const lectureValue = await lectureFilter.locator('option:not([value="all"])').first().getAttribute('value');
  expect(lectureValue).toBeTruthy();
  await lectureFilter.selectOption(lectureValue);
  await page.locator('#applyMobileFiltersBtn').click();

  const chips = page.locator('#activeFilterChips');
  const lectureChip = chips.locator('.filter-chip[data-filter="lecture"]');
  await expect(chips).toBeVisible();
  await expect(chips.locator('.filter-chip')).toHaveCount(1);
  await expect(lectureChip).toContainText('Lecture:');
  await expect(page.locator('#mobileFiltersToggle .mobile-filter-count')).toHaveText('1');

  await lectureChip.click();
  await expect(lectureFilter).toHaveValue('all');
  await expect(chips).toBeHidden();
  await expect(page.locator('#mobileFiltersToggle .mobile-filter-count')).toBeHidden();
});
