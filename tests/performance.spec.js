import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

async function openBank(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {
    name: 'Medical MEQ Review Bank'
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
  expect(new Set(lectureRequests).size).toBe(1);
  expect(lectureRequests.some(path => path.includes('neurosurgery-traumatic-brain-injury'))).toBe(false);
  await expect(page.locator('.lecture')).toHaveCount(1);

  const metrics = await page.evaluate(() => ({
    studyItems: document.querySelectorAll('.study-item').length,
    rapidItems: document.querySelectorAll('.rapid-item').length,
    nodes: document.getElementsByTagName('*').length
  }));
  const shellNodeBudget = 2_000;
  const singleLectureNodeBudget = 2_600;

  expect(metrics.studyItems).toBeLessThan(500);
  expect(metrics.rapidItems).toBeLessThan(100);
  expect(metrics.nodes).toBeLessThan(shellNodeBudget + singleLectureNodeBudget);
});

test('debounced search filtering completes within the interaction budget and preserves listeners', async ({page}) => {
  await openBank(page);

  const result = await page.evaluate(() => new Promise(resolve => {
    const input = document.getElementById('search');
    let observedInputEvents = 0;
    const observeInput = () => {
      observedInputEvents += 1;
    };
    input.addEventListener('input', observeInput);

    const started = performance.now();
    input.addEventListener('meq:search-applied', () => {
      input.removeEventListener('input', observeInput);
      resolve({
        duration: performance.now() - started,
        observedInputEvents
      });
    }, {once: true});

    input.value = 'testicular';
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: 'r',
      inputType: 'insertText'
    }));
  }));

  expect(result.duration).toBeGreaterThanOrEqual(280);
  expect(result.duration).toBeLessThan(1_500);
  expect(result.observedInputEvents).toBe(1);
  await expect(page.locator('#globalSearchResults .global-search-result').first()).toBeVisible();
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


test('switching lectures fetches only the selected payload and keeps one lecture in the DOM', async ({page}) => {
  const requested = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/lectures/data/')) requested.push(path);
  });

  await openBank(page);
  const initial = [...new Set(requested)];
  expect(initial).toHaveLength(1);

  requested.length = 0;
  await page.locator('#lectureFilter').selectOption('urology-renal-tumors');
  await expect(page.locator('#lecture-urology-renal-tumors')).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false', {timeout: 15_000});

  expect([...new Set(requested)]).toEqual(['/lectures/data/urology-renal-tumors.json']);
  await expect(page.locator('.lecture')).toHaveCount(1);
  await expect(page.locator('#lecture-urology-congenital-anomalies')).toHaveCount(0);
});


test('global search finds an unloaded lecture without fetching it until the result is opened', async ({page}) => {
  const requested = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/lectures/data/')) requested.push(path);
  });

  await openBank(page);
  requested.length = 0;

  await page.locator('#search').fill('Renal Tumors');
  const result = page.locator('#globalSearchResults .global-search-result[data-lecture="urology-renal-tumors"]').first();
  await expect(result).toBeVisible({timeout: 10_000});
  expect(requested.some(path => path.includes('urology-renal-tumors'))).toBe(false);

  await result.click();
  await expect(page.locator('#lecture-urology-renal-tumors')).toBeVisible({timeout: 10_000});
  expect(requested.filter(path => path.includes('urology-renal-tumors')).length).toBe(1);
  await expect(page.locator('.lecture')).toHaveCount(1);
});
