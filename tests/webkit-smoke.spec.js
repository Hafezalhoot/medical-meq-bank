import {test, expect} from '@playwright/test';

async function waitForBank(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {
    name: 'Medical MEQ Review Bank'
  })).toBeVisible();
  await expect(page.locator('#reviewFilter')).toBeAttached();
  await expect.poll(
    () => page.evaluate(() => document.querySelector('main')?.getAttribute('aria-busy'))
  ).toBe('false');
  await expect(page.locator('.study-item').first()).toBeAttached();
}

async function expectControlToBeTopmost(locator) {
  const receivesPointer = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
    return target === element || element.contains(target);
  });
  expect(receivesPointer).toBe(true);
}

test('WebKit opens the active subject and loads another subject on demand', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'webkit-desktop', 'Desktop Safari scenario');

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await waitForBank(page);
  await expect.poll(
    () => page.evaluate(() => globalThis.MEQLectureLoader?.loadedLectureIds.size)
  ).toBe(1);

  await page.locator('#subjectSelector').selectOption('neurosurgery');
  await expect(page.locator('#lecture-neurosurgery-traumatic-brain-injury')).toBeVisible();
  await expect.poll(
    () => page.evaluate(() =>
      globalThis.MEQLectureLoader?.isLoaded('neurosurgery-traumatic-brain-injury')
    )
  ).toBe(true);
  await expect.poll(
    () => page.evaluate(() => globalThis.MEQLectureLoader?.loadedLectureIds.size)
  ).toBe(2);

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
  await expect(page.locator('#globalSearchResults')).toBeVisible();
  await expect(page.locator('#globalSearchResults .global-search-result').first()).toBeVisible();

  const resetButton = page.locator('#resetFiltersBtn');
  await expect(resetButton).toBeVisible();
  await expectControlToBeTopmost(resetButton);
  await resetButton.click();
  await expect(page.locator('#search')).toHaveValue('');
  await expect(page.locator('#activeFilterChips')).toBeHidden();
  await expect(page.locator('#globalSearchResults')).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
