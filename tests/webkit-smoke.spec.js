import {test, expect} from '@playwright/test';

async function waitForBank(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {
    name: 'Medical MEQ & Short Question Review Bank'
  })).toBeVisible();
  await expect(page.locator('#reviewFilter')).toBeAttached();
  await expect.poll(
    () => page.evaluate(() => document.querySelector('main')?.getAttribute('aria-busy'))
  ).toBe('false');
  await expect(page.locator('.study-item').first()).toBeAttached();
}

test('WebKit opens the active subject and loads another subject on demand', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'webkit-desktop', 'Desktop Safari scenario');

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await waitForBank(page);
  const expectedCounts = await page.evaluate(async () => {
    const catalog = await globalThis.MEQLectureLoader.loadCatalog();
    return {
      urology: catalog.lectures.filter(entry => entry.subjectKey === 'urology').length,
      neurosurgery: catalog.lectures.filter(entry => entry.subjectKey === 'neurosurgery').length
    };
  });
  await expect.poll(
    () => page.evaluate(() => globalThis.MEQLectureLoader?.loadedLectureIds.size)
  ).toBe(expectedCounts.urology);

  await page.locator('#subjectSelector').selectOption('neurosurgery');
  await expect(page.locator('#lecture-neurosurgery-traumatic-brain-injury')).toBeVisible();
  await expect.poll(
    () => page.evaluate(() => globalThis.MEQLectureLoader?.loadedLectureIds.size)
  ).toBe(expectedCounts.urology + expectedCounts.neurosurgery);

  expect(pageErrors).toEqual([]);
});

test('iPhone WebKit can expand, search and reset mobile filters', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'webkit-mobile', 'iPhone WebKit scenario');

  await waitForBank(page);

  const toggle = page.locator('#mobileFiltersToggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobileFilterBackdrop')).toBeVisible();
  await expect(page.locator('#studyToolbar')).toHaveAttribute('role', 'dialog');

  await page.locator('#search').fill('testicular');
  await expect(page.locator('#activeFilterChips')).toContainText('Search: testicular');
  await expect(page.locator('.study-item:not(.hidden)').first()).toBeVisible();

  await page.locator('#resetFiltersBtn').click();
  await expect(page.locator('#search')).toHaveValue('');
  await expect(page.locator('#activeFilterChips')).toBeHidden();
});
