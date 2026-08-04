import {test, expect} from '@playwright/test';

test('service-worker installation does not request missing same-origin assets', async ({page}) => {
  test.setTimeout(90_000);
  const notFound = [];

  page.on('response', response => {
    if (response.status() === 404) {
      notFound.push(new URL(response.url()).pathname);
    }
  });

  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#reviewFilter')).toBeAttached();
  await page.waitForLoadState('load');

  await expect.poll(
    () => page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return Boolean(registration?.active);
    }),
    {timeout: 60_000, intervals: [500, 1000, 2000]}
  ).toBe(true);

  expect([...new Set(notFound)].sort()).toEqual([]);
});
