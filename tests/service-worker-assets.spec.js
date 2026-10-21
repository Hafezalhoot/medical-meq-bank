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


test('saved Dermatology source study remains available offline without invented graphics', async ({page}) => {
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('main')).toHaveAttribute('aria-busy','false',{timeout:15000});
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller)),{timeout:60000}).toBe(true);
  const id='internal-medicine-ii-dermatology-introduction';
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
  await expect(page.locator('#lectureFilter option[value="'+id+'"]')).toHaveCount(1,{timeout:15000});
  await page.evaluate(async x=>globalThis.MEQOfflineCache.cacheLecture(x),id);
  await expect.poll(()=>page.evaluate(x=>globalThis.MEQOfflineCache.isLectureCached(x),id)).toBe(true);
  const source=await page.evaluate(async()=>(
    await (await fetch('/lectures/data/internal-medicine-ii-dermatology-introduction.json')).json()
  ));
  expect(source.imageQuestions).toHaveLength(14);
  expect(source.imageQuestions.every(q=>/^\.\/assets\/lectures\/dermatology-introduction\/derm-image-\d{3}\.jpg$/.test(q.image))).toBe(true);
  expect(Boolean(source.studyGuide.infographic)).toBe(false);
  await page.context().setOffline(true);
  const found=await page.evaluate(async data=>{
    const doc=await fetch('/lectures/data/internal-medicine-ii-dermatology-introduction.json');
    if(!doc.ok)return false;
    const responses=await Promise.all(data.imageQuestions.map(q=>fetch(q.image)));
    return responses.length===14 && responses.every(x=>x.ok);
  },source);
  expect(found).toBe(true);
});
