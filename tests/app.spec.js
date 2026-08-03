import {test, expect} from '@playwright/test';

const headingName = 'Medical MEQ & Short Question Review Bank';

async function openBank(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page).toHaveTitle(/Medical MEQ Review Bank/);
  await expect(page.getByRole('heading', {name: headingName})).toBeVisible();
  await expect(page.locator('#reviewFilter')).toBeAttached();
  await expect.poll(async () => page.locator('.lecture').count()).toBeGreaterThan(0);
}

function meaningfulSearchToken(text) {
  const ignored = new Set(['rapid', 'recall', 'question', 'answer', 'which', 'what', 'where', 'when', 'state']);
  const words = text.match(/[A-Za-z]{6,}/g) || [];
  return words.find(word => !ignored.has(word.toLowerCase())) || words[0] || 'testicular';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('opens without JavaScript exceptions and renders lectures', async ({page}) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await openBank(page);
  await expect(page.locator('#lectureFilter option')).not.toHaveCount(0);
  await expect(page.locator('.study-item').first()).toBeAttached();
  expect(pageErrors).toEqual([]);
});

test('All study items search includes matching Rapid Recall cards', async ({page}) => {
  await openBank(page);

  const typeFilter = page.locator('#typeFilter');
  await typeFilter.selectOption('rapid');

  await expect(page.locator('#topicFilter')).toBeDisabled();
  await expect(page.locator('#priorityFilter')).toBeDisabled();
  await expect(page.locator('#reviewFilter')).toBeDisabled();

  const firstRapid = page.locator('.rapid-item:not(.hidden)').first();
  await expect(firstRapid).toBeVisible();
  const token = meaningfulSearchToken(await firstRapid.innerText());

  await typeFilter.selectOption('all');
  await page.locator('#search').fill(token);

  const matchingRapid = page
    .locator('.rapid-item:not(.hidden)')
    .filter({hasText: new RegExp(escapeRegExp(token), 'i')});
  await expect(matchingRapid.first()).toBeVisible();
});

test('full-bank text search waits for the debounce interval', async ({page}) => {
  await openBank(page);

  const search = page.locator('#search');
  await expect(search).toHaveAttribute('data-optimized-search', '1');
  await expect(search).toHaveAttribute('data-filter-delay', '160');

  const immediatelyEmpty = await page.evaluate(() => {
    window.__meqSearchApplied = 0;
    const input = document.getElementById('search');
    input.addEventListener('meq:search-applied', () => {
      window.__meqSearchApplied += 1;
    });
    input.value = 'definitely-no-such-medical-item-8374';
    input.dispatchEvent(new Event('input', {bubbles: true}));
    return document.getElementById('empty').classList.contains('show');
  });

  // This value is captured synchronously in the same task that dispatched the
  // input event, before any 160 ms timer can run.
  expect(immediatelyEmpty).toBe(false);

  await expect.poll(
    () => page.evaluate(() => window.__meqSearchApplied)
  ).toBe(1);
  await expect(page.locator('#empty')).toHaveClass(/show/);
});

test('mobile filters expand, show active chips, and reset cleanly', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await openBank(page);

  const toggle = page.locator('#mobileFiltersToggle');
  const topicFilter = page.locator('#topicFilter');
  const chips = page.locator('#activeFilterChips');

  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(topicFilter).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(topicFilter).toBeVisible();

  await page.locator('#search').fill('testicular');
  await expect(chips).toBeVisible();
  await expect(chips).toContainText('Search: testicular');

  await page.locator('#resetFiltersBtn').click();
  await expect(page.locator('#search')).toHaveValue('');
  await expect(chips).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('mobile sidebar defaults stay responsive until the user chooses', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await openBank(page);

  const layout = page.locator('#mainLayout');
  await expect(layout).toHaveClass(/hide-lectures/);
  await expect(layout).toHaveClass(/hide-subtopics/);

  const initialPreferences = await page.evaluate(() => ({
    lectures: localStorage.getItem('medicalBankHideLecturesV4'),
    subtopics: localStorage.getItem('medicalBankHideSubtopicsV4')
  }));
  expect(initialPreferences).toEqual({lectures: null, subtopics: null});

  await page.locator('#toggleLectures').click();
  await expect(layout).not.toHaveClass(/hide-lectures/);
  await expect(page.locator('#toggleLectures')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(
    () => page.evaluate(() => localStorage.getItem('medicalBankHideLecturesV4'))
  ).toBe('0');

  expect(
    await page.evaluate(() => localStorage.getItem('medicalBankHideSubtopicsV4'))
  ).toBeNull();
});

test('desktop starts with both sidebars open without saving preferences', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await openBank(page);

  const layout = page.locator('#mainLayout');
  await expect(layout).not.toHaveClass(/hide-lectures/);
  await expect(layout).not.toHaveClass(/hide-subtopics/);

  expect(await page.evaluate(() => ({
    lectures: localStorage.getItem('medicalBankHideLecturesV4'),
    subtopics: localStorage.getItem('medicalBankHideSubtopicsV4')
  }))).toEqual({lectures: null, subtopics: null});
});

test('malformed saved progress cannot prevent startup', async ({page}) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('medicalBankStatusV2', '{invalid-json');
  });

  await openBank(page);
  await expect(page.locator('.study-item').first()).toBeAttached();
  expect(pageErrors).toEqual([]);
});

test('installed service worker restores the bank while offline', async ({page, context}) => {
  await openBank(page);
  await expect.poll(
    () => page.evaluate(async () => Boolean(await navigator.serviceWorker.ready)),
    {timeout: 15_000}
  ).toBe(true);

  await page.reload({waitUntil: 'domcontentloaded'});
  await expect.poll(
    () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    {timeout: 15_000}
  ).toBe(true);

  await context.setOffline(true);
  try {
    await page.reload({waitUntil: 'domcontentloaded', timeout: 15_000});
    await expect(page.getByRole('heading', {name: headingName})).toBeVisible();
    await expect(page.locator('.study-item').first()).toBeAttached();
  } finally {
    await context.setOffline(false);
  }
});
