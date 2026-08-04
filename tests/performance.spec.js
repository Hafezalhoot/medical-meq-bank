import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

async function openBank(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {
    name: 'Medical MEQ & Short Question Review Bank'
  })).toBeVisible();
  await expect(page.locator('#reviewFilter')).toBeAttached();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false', {timeout: 15_000});
  await expect(page.locator('.study-item').first()).toBeAttached();
}

test('initial active-subject load stays within a practical request budget', async ({page}) => {
  const requested = [];
  page.on('request', request => requested.push(new URL(request.url()).pathname));

  await openBank(page);

  const lectureRequests = requested.filter(path => path.startsWith('/lectures/data/'));
  const activeLectureCount = await page.locator('#lectureFilter option').count() - 1;
  expect(new Set(lectureRequests).size).toBeLessThanOrEqual(Math.max(activeLectureCount, 1));
  expect(lectureRequests.some(path => path.includes('neurosurgery-traumatic-brain-injury'))).toBe(false);

  const metrics = await page.evaluate(() => ({
    studyItems: document.querySelectorAll('.study-item').length,
    rapidItems: document.querySelectorAll('.rapid-item').length,
    nodes: document.getElementsByTagName('*').length
  }));
  const shellNodeBudget = 2_000;
  const perLectureNodeBudget = 2_600;
  const nodeBudget = shellNodeBudget + Math.max(activeLectureCount, 1) * perLectureNodeBudget;

  expect(metrics.studyItems).toBeLessThan(2_500);
  expect(metrics.rapidItems).toBeLessThan(1_000);
  expect(metrics.nodes).toBeLessThan(nodeBudget);
});

test('debounced search filtering completes within the interaction budget', async ({page}) => {
  await openBank(page);

  const duration = await page.evaluate(() => new Promise(resolve => {
    const input = document.getElementById('search');
    const started = performance.now();
    input.addEventListener('meq:search-applied', () => {
      resolve(performance.now() - started);
    }, {once: true});
    input.value = 'testicular';
    input.dispatchEvent(new Event('input', {bubbles: true}));
  }));

  expect(duration).toBeGreaterThanOrEqual(280);
  expect(duration).toBeLessThan(1_500);
  await expect(page.locator('.study-item:not(.hidden)').first()).toBeVisible();
});

test('switching to an unloaded subject completes within the navigation budget', async ({page}) => {
  await openBank(page);

  const started = Date.now();
  await page.locator('#subjectSelector').selectOption('neurosurgery');
  await expect(page.locator('#lecture-neurosurgery-traumatic-brain-injury')).toBeVisible();
  const duration = Date.now() - started;

  expect(duration).toBeLessThan(3_000);
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false', {timeout: 15_000});
});
