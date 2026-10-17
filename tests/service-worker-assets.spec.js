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

  const cachedPaths = await page.evaluate(async () => {
    const paths = [];
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      for (const request of await cache.keys()) paths.push(new URL(request.url).pathname);
    }
    return [...new Set(paths)].sort();
  });

  const cachedLectures = cachedPaths.filter(path => path.startsWith('/lectures/data/'));
  expect(cachedLectures.length).toBeLessThanOrEqual(1);
  expect(cachedPaths).not.toContain('/offline/Medical_MEQ_Review_Bank_Offline.html');
  expect(cachedPaths).toContain('/lectures/catalog.json');
  expect(cachedPaths).toContain('/lectures/search/catalog.json');
});


test('explicit offline cache stores only the requested lecture', async ({page}) => {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#reviewFilter')).toBeAttached();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false', {timeout: 15_000});

  await expect.poll(
    () => page.evaluate(() => Boolean(globalThis.MEQOfflineCache && globalThis.MEQLectureLoader)),
    {timeout: 15_000}
  ).toBe(true);

  await page.evaluate(async () => {
    await globalThis.MEQOfflineCache.cacheLecture('urology-renal-tumors');
  });

  expect(await page.evaluate(
    () => globalThis.MEQOfflineCache.isLectureCached('urology-renal-tumors')
  )).toBe(true);

  expect(await page.evaluate(
    () => globalThis.MEQOfflineCache.isLectureCached('urology-bladder-cancer')
  )).toBe(false);
});


test('saved Dermatology lecture includes all local figures and remains readable offline', async ({page}) => {
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('main')).toHaveAttribute('aria-busy','false',{timeout:15000});
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    {timeout:60000, intervals:[500,1000,2000]}).toBe(true);

  const id='internal-medicine-ii-dermatology-introduction';
  // The offline API uses catalog metadata, which the UI loads when selecting a course.
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
  await expect(page.locator('#lectureFilter option[value="'+id+'"]')).toHaveCount(1,{timeout:15000});
  await page.evaluate(async lectureId => {
    await globalThis.MEQOfflineCache.cacheLecture(lectureId);
  }, id);
  await expect.poll(() => page.evaluate(lectureId =>
    globalThis.MEQOfflineCache.isLectureCached(lectureId), id)).toBe(true);
  // A missing local infographic must make the saved-status check fail.
  const wasCompleteAfterLoss = await page.evaluate(async lectureId => {
    const cache=await caches.open('medical-meq-bank-'+(await (await fetch('/version.json')).json()).version);
    await cache.delete(new URL('/assets/lectures/dermatology-intro/lesions-classification.svg',location.href).href);
    return globalThis.MEQOfflineCache.isLectureCached(lectureId);
  }, id);
  expect(wasCompleteAfterLoss).toBe(false);
  await page.evaluate(async lectureId => {
    await globalThis.MEQOfflineCache.cacheLecture(lectureId);
  }, id);
  await expect.poll(()=>page.evaluate(lectureId =>
    globalThis.MEQOfflineCache.isLectureCached(lectureId),id)).toBe(true);
  const paths=[
    '/lectures/data/internal-medicine-ii-dermatology-introduction.json',
    '/assets/lectures/dermatology-intro/skin-layers.svg',
    '/assets/lectures/dermatology-intro/lesion-atlas.svg',
    '/assets/lectures/dermatology-intro/lesions-classification.svg'
  ];
  const saved=await page.evaluate(async required => {
    const cache=await caches.open('medical-meq-bank-'+(await (await fetch('/version.json')).json()).version);
    const keys=(await cache.keys()).map(request=>new URL(request.url).pathname);
    return required.map(path=>({path,cached:keys.includes(path)}));
  },paths);
  expect(saved.every(item=>item.cached),JSON.stringify(saved)).toBe(true);

  await page.context().setOffline(true);
  const statuses=await page.evaluate(async required =>
    Promise.all(required.map(async path=>{
      const response=await fetch(path);
      return {path,ok:response.ok};
    })),paths);
  expect(statuses.every(item=>item.ok),JSON.stringify(statuses)).toBe(true);
});
