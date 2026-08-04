import {test, expect} from '@playwright/test';

// Course and lecture behavior is tested without PWA lifecycle reloads. The
// dedicated service-worker installation and offline tests cover that layer.
test.use({serviceWorkers: 'block'});

async function openBank(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page).toHaveTitle(/Medical MEQ Review Bank/);
  await expect(page.locator('#courseSelector')).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false', {timeout: 15_000});
  await expect(page.locator('.lecture').first()).toBeAttached();
}

test('course configuration is loaded above subjects and preserves the surgery bank', async ({page}) => {
  await openBank(page);

  await expect(page.locator('#courseSelector')).toHaveValue('surgery');
  await expect(page.locator('#courseSelector option')).toHaveText(['Surgery', 'Internal Medicine']);
  await expect(page.locator('#subjectSelector option')).toHaveText([
    'Urology',
    'General Surgery',
    'GIT Surgery',
    'Neurosurgery'
  ]);

  const registry = await page.evaluate(() => ({
    activeCourse: globalThis.MEQCourseRegistry.activeCourse,
    urologyCourse: globalThis.MEQCourseRegistry.courseForSubject('urology'),
    medicineCourse: globalThis.MEQCourseRegistry.courseForSubject('cardiology'),
    urologyCatalog: globalThis.MEQCourseRegistry.catalogForSubject('urology'),
    cardiologyCatalog: globalThis.MEQCourseRegistry.catalogForSubject('cardiology')
  }));
  expect(registry).toEqual({
    activeCourse: 'surgery',
    urologyCourse: 'surgery',
    medicineCourse: 'internal-medicine',
    urologyCatalog: './lectures/catalog.json',
    cardiologyCatalog: null
  });
});

test('switching to a new course does not alter saved surgery progress', async ({page}) => {
  const protectedKey = 'urology-bladder-cancer::case::bc-c01';
  await page.addInitScript(key => {
    localStorage.setItem('medicalBankStatusV2', JSON.stringify({[key]: 'mastered'}));
    localStorage.setItem('medicalBankCourseV1', 'surgery');
    localStorage.setItem('medicalBankSubjectV4:surgery', 'urology');
  }, protectedKey);

  await openBank(page);
  await page.locator('#courseSelector').selectOption('internal-medicine');
  await expect(page.locator('#subjectSelector')).toHaveValue('cardiology');
  await expect(page.locator('#subjectSelector option')).toHaveText([
    'Cardiology',
    'Chest Medicine',
    'Gastroenterology',
    'Nephrology',
    'Endocrinology',
    'Hematology',
    'Rheumatology'
  ]);
  await expect(page.locator('#empty')).toHaveClass(/show/);
  await expect(page.locator('#emptyMessage')).toContainText('No lectures have been added');

  await page.locator('#courseSelector').selectOption('surgery');
  await expect(page.locator('#subjectSelector')).toHaveValue('urology');
  await expect(page.locator('#lecture-urology-renal-tumors')).toBeAttached();

  const stored = await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem('medicalBankStatusV2') || '{}');
    return state[key];
  }, protectedKey);
  expect(stored).toBe('mastered');
});

test('Renal Tumors loads as lecture 08 with verified content and images', async ({page}) => {
  await openBank(page);
  await expect(page.locator('#lecture-urology-renal-tumors')).toBeAttached();

  await expect(page.locator('#lectureFilter option[value="urology-renal-tumors"]')).toHaveText('08. Renal Tumors');
  await page.locator('#lectureFilter').selectOption('urology-renal-tumors');
  await expect(page.locator('#lecture-urology-renal-tumors .lecture-title')).toHaveText('Renal Tumors');

  const counts = await page.evaluate(() => {
    const lecture = lectures.find(item => item.id === 'urology-renal-tumors');
    return {
      cases: lecture?.cases.length,
      coreShorts: lecture?.coreShorts.length,
      imageQuestions: lecture?.imageQuestions.length,
      detailedShorts: lecture?.detailedShorts.length,
      rapid: lecture?.rapid.length
    };
  });
  expect(counts).toEqual({cases: 12, coreShorts: 30, imageQuestions: 6, detailedShorts: 45, rapid: 30});
  await expect(page.locator('#lecture-urology-renal-tumors .image-card')).toHaveCount(6);
  await expect(page.locator('#lecture-urology-renal-tumors .image-card img[src^="data:image/avif;base64,"]')).toHaveCount(6);
});

test('full-bank loading spans configured courses without failing empty future packs', async ({page}) => {
  await openBank(page);
  const result = await page.evaluate(() => globalThis.MEQLectureLoader.loadAll());
  expect(result.failedSubjects).toEqual([]);
  expect(result.lectureIds).toContain('urology-renal-tumors');
  expect(result.lectureIds).toContain('urology-bladder-cancer');
  expect(result.lectureIds).toContain('neurosurgery-traumatic-brain-injury');
});
