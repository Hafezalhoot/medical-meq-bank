import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

test('My Medical Library identity is consistent in the page and installed-app manifest', async ({page}) => {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page).toHaveTitle(/My Medical Library/);
  await expect(page.locator('.studio-wordmark strong')).toHaveText('My Medical Library');
  await expect(page.getByRole('heading', {name: 'Your medical study library'})).toBeVisible();
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestResponse = await page.request.get(new URL(href, page.url()).href);
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe('My Medical Library');
  expect(manifest.short_name).toBe('My Medical Library');
});

test('Browse my library opens the existing course catalog without replacing study state', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy', 'false', {timeout: 20000});
  const openLibrary = page.getByRole('link', {name: 'Browse my library'});
  await expect(openLibrary).toBeVisible();
  await openLibrary.click();
  const disclosure = page.locator('#courseLibraryDisclosure');
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(disclosure.locator('summary')).toBeFocused();
  await expect(page.locator('#courseLibraryGrid .course-library-card').first()).toBeVisible();
  await expect(page.locator('#lectureContainer')).toBeAttached();
});

test('mobile library and review remain available without horizontal overflow', async ({page}) => {
  await page.setViewportSize({width: 320, height: 700});
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByText('My Library', {exact: true}).first()).toBeVisible();
  await page.locator('#courseLibraryDisclosure summary').click();
  await expect(page.locator('#courseLibraryDisclosure')).toHaveAttribute('open', '');
  await page.locator('#myReviewDisclosure summary').click();
  await expect(page.locator('#myReviewDisclosure')).toHaveAttribute('open', '');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});


test('lecture navigation is a compact, accessible section row outside the lecture header', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  // On phones the lecture select belongs to the closed native filter sheet.
  await expect(page.locator('#mobileFiltersToggle')).toBeVisible();
  await page.locator('#mobileFiltersToggle').click();
  await page.locator('#lectureFilter').selectOption('urology-congenital-anomalies');
  await page.locator('#applyMobileFiltersBtn').click();
  const header = page.locator('.lecture-head');
  await expect(header).toBeVisible({timeout: 20000});
  const nav = page.getByRole('navigation', {name:'Lecture sections'});
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('button', {name:'Cases'})).toBeVisible();
  await nav.getByRole('button', {name:'Images'}).click();
  await expect(page.locator('#typeFilter')).toHaveValue('image');
  const alignment = await page.evaluate(() => {
    const header = document.querySelector('.lecture-head').getBoundingClientRect();
    const nav = document.querySelector('.lecture-section-nav').getBoundingClientRect();
    return {below: nav.top >= header.bottom - 2, overflow: document.documentElement.scrollWidth - innerWidth};
  });
  expect(alignment.below).toBe(true);
  expect(alignment.overflow).toBeLessThanOrEqual(1);
});

test('unreviewed marking schemes do not render empty answer boxes', async ({page}) => {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await page.locator('#lectureFilter').selectOption('urology-bladder-cancer');
  const card = page.locator('#urology-bladder-cancer-case-bc-c01');
  await expect(card).toBeVisible({timeout: 20000});
  await card.getByRole('button', {name:'Show model answer'}).click();
  await expect(card.locator('.answer-grid .answer-card')).toHaveCount(1);
  await expect(card.getByText('Suggested marking scheme')).toHaveCount(0);
  await expect(card.locator('.answer-grid')).toHaveClass(/single-answer/);
  await expect(card.locator('.exam-trap')).toHaveCount(1);

  await page.locator('#lectureFilter').selectOption('urology-congenital-anomalies');
  const reviewed = page.locator('#urology-congenital-anomalies-case-pujo');
  await expect(reviewed).toBeVisible({timeout: 20000});
  await reviewed.getByRole('button', {name:'Show model answer'}).click();
  await expect(reviewed.locator('.answer-grid .answer-card')).toHaveCount(2);
  await expect(reviewed.getByText('Suggested marking scheme')).toBeVisible();
});
