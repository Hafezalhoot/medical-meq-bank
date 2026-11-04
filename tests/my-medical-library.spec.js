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
