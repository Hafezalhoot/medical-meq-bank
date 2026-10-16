import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test, expect} from '@playwright/test';

const headingName = 'Medical MEQ Review Bank';

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

test('search waits for the debounce interval', async ({page}) => {
  await openBank(page);

  await expect.poll(
    () => page.evaluate(() => Boolean(globalThis.MEQSearch?.renderResults))
  ).toBe(true);

  const initialSignals = await page.evaluate(() => {
    window.__meqSearchApplied = 0;
    const input = document.getElementById('search');
    input.addEventListener('meq:search-applied', () => {
      window.__meqSearchApplied += 1;
    });
    input.value = 'definitely-no-such-medical-item-8374';
    input.dispatchEvent(new Event('input', {bubbles: true}));
    return window.__meqSearchApplied;
  });

  expect(initialSignals).toBe(0);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__meqSearchApplied)).toBe(0);

  await expect.poll(
    () => page.evaluate(() => window.__meqSearchApplied)
  ).toBe(1);
  await expect(page.locator('#globalSearchResults')).toBeVisible();
  await expect(page.locator('#globalSearchStatus')).toContainText('No matching study items');
});

test('mobile filter bar stays compact and opens an accessible bottom sheet', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await openBank(page);

  const toolbar = page.locator('#studyToolbar');
  const toggle = page.locator('#mobileFiltersToggle');
  const backdrop = page.locator('#mobileFilterBackdrop');
  const chips = page.locator('#activeFilterChips');

  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#lectureFilter')).toBeHidden();
  await expect(page.locator('#typeFilter')).toBeHidden();

  const collapsed = await toolbar.evaluate(element => {
    const box = element.getBoundingClientRect();
    return {height: box.height, position: getComputedStyle(element).position};
  });
  expect(collapsed.height).toBeLessThanOrEqual(94);
  expect(collapsed.position).toBe('static');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toolbar).toHaveAttribute('role', 'dialog');
  await expect(toolbar).toHaveAttribute('aria-modal', 'true');
  await expect(backdrop).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/mobile-filters-open/);
  await expect(page.locator('#lectureFilter')).toBeVisible();
  await expect(page.locator('#closeMobileFiltersBtn')).toBeFocused();

  const sheet = await toolbar.boundingBox();
  expect(sheet).toBeTruthy();
  expect(sheet.height).toBeLessThanOrEqual(844 * 0.82);
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(845);

  await page.locator('#typeFilter').selectOption('case');
  await expect(chips).toContainText('Type: MEQ cases');
  await page.locator('#applyMobileFiltersBtn').click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(backdrop).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/mobile-filters-open/);
  await expect(toggle).toBeFocused();

  await toggle.click();
  await page.locator('#search').fill('testicular');
  await expect(chips).toContainText('Search: testicular');
  await expect(page.locator('#globalSearchResults')).toBeVisible();
  await page.locator('#resetFiltersBtn').click();
  await expect(page.locator('#search')).toHaveValue('');
  await expect(chips).toBeHidden();
  await expect(page.locator('#globalSearchResults')).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#search')).toBeFocused();

  await toggle.click();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('image cards never request undefined resources', async ({page}) => {
  const invalidRequests = [];
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/undefined')) invalidRequests.push(request.url());
  });

  await openBank(page);
  await expect(page.locator('.image-card').first()).toBeAttached();
  await expect(page.locator('img[src="undefined"]')).toHaveCount(0);

  const invalidVisuals = await page.locator('.image-card').evaluateAll(cards => cards.filter(card => {
    const image = card.querySelector('.visual img');
    if (image) {
      const source = image.getAttribute('src')?.trim();
      return !source || source === 'undefined';
    }
    const placeholder = card.querySelector('.visual-placeholder');
    return !placeholder || !/Lecture (page|source)/i.test(placeholder.textContent || '');
  }).length);

  expect(invalidVisuals).toBe(0);
  expect(invalidRequests).toEqual([]);
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

test('legacy progress migrates to IndexedDB and survives a corrupt legacy key', async ({page}) => {
  const expected = {
    'urology-congenital-anomalies::core::recovery-check': 'mastered'
  };

  await page.addInitScript(value => {
    localStorage.setItem('medicalBankStatusV2', JSON.stringify(value));
  }, expected);
  await openBank(page);

  await expect.poll(
    () => page.evaluate(() => globalThis.MEQProgressStore?.exportAll?.())
  ).toEqual(expected);
  await expect.poll(
    () => page.evaluate(() => localStorage.getItem('medicalBankStatusV2'))
  ).toBeNull();

  await page.evaluate(async () => {
    localStorage.setItem('medicalBankStatusV2', '{corrupted-json');
    await globalThis.MEQProgressStore.snapshotNow();
  });
  await page.reload({waitUntil: 'domcontentloaded'});

  await expect.poll(
    () => page.evaluate(() => globalThis.MEQProgressStore?.exportAll?.()),
    {timeout: 15_000}
  ).toEqual(expected);
});

test('explicit IndexedDB progress reset remains empty after reload', async ({page}) => {
  await openBank(page);
  await expect.poll(
    () => page.evaluate(() => Boolean(globalThis.MEQProgressStore))
  ).toBe(true);

  await page.evaluate(async () => {
    await globalThis.MEQProgressStore.set(
      'urology-congenital-anomalies::core::reset-check',
      'review'
    );
    await globalThis.MEQProgressStore.clear();
    await globalThis.MEQProgressStore.snapshotNow();
  });

  await page.reload({waitUntil: 'domcontentloaded'});
  await expect.poll(
    () => page.evaluate(() => globalThis.MEQProgressStore?.exportAll?.())
  ).toEqual({});
});

test('installed service worker restores the bank while offline', async ({page, context}) => {
  test.setTimeout(90_000);
  await openBank(page);
  await page.waitForLoadState('load');

  await expect.poll(
    () => page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return Boolean(registration?.active);
    }),
    {timeout: 60_000, intervals: [500, 1000, 2000]}
  ).toBe(true);

  await page.reload({waitUntil: 'domcontentloaded'});
  await expect.poll(
    () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    {timeout: 30_000, intervals: [500, 1000, 2000]}
  ).toBe(true);

  await context.setOffline(true);
  try {
    await page.reload({waitUntil: 'domcontentloaded', timeout: 30_000});
    await expect(page.getByRole('heading', {name: headingName})).toBeVisible();
    await expect(page.locator('.study-item').first()).toBeAttached();
  } finally {
    await context.setOffline(false);
  }
});

test('standalone offline HTML opens directly without a server', async ({page}) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  const offlineFile = pathToFileURL(
    resolve('dist/offline/Medical_MEQ_Review_Bank_Offline.html')
  ).href;
  await page.goto(offlineFile, {waitUntil: 'domcontentloaded'});

  await expect(page.getByRole('heading', {name: headingName})).toBeVisible();
  await expect(page.locator('#reviewFilter')).toBeAttached();
  await expect(page.locator('.study-item').first()).toBeAttached();
  await expect(page.locator('link[href="./app.css"]')).toHaveCount(0);
  await expect(page.locator('script[src="./app.js"]')).toHaveCount(0);
  await expect(page.locator('script[src="./progress-resilience.js"]')).toHaveCount(0);
  await expect(page.locator('script[src="./pwa-client.js"]')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});


test('rating one item persists one IndexedDB record without rebuilding legacy localStorage', async ({page}) => {
  await openBank(page);
  const status = page.locator('.study-item').first().locator('.status.mastered');
  await status.click();

  const result = await page.evaluate(async () => {
    await globalThis.MEQProgressStore.ready;
    const progress = await globalThis.MEQProgressStore.exportAll();
    return {
      count: Object.keys(progress).length,
      values: Object.values(progress),
      legacy: localStorage.getItem('medicalBankStatusV2')
    };
  });

  expect(result.count).toBe(1);
  expect(result.values).toEqual(['mastered']);
  expect(result.legacy).toBeNull();
});


test('empty search state offers one-click filter recovery', async ({page}) => {
  await openBank(page);

  const search = page.locator('#search');
  await search.fill('unlikely-no-result-term-zzzzzz');
  await expect(page.locator('#empty')).toHaveClass(/show/);
  await expect(page.locator('#emptyResetBtn')).toBeVisible();

  await page.locator('#emptyResetBtn').click();
  await expect(search).toHaveValue('');
  await expect(page.locator('#empty')).not.toHaveClass(/show/);
});
