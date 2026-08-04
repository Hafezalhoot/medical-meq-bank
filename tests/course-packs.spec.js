import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

async function openBank(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false', {timeout: 15_000});
  await expect(page.locator('#lecture-urology-renal-tumors')).toBeAttached();
}

test('course and subject configuration is loaded from the Surgery content pack', async ({page}) => {
  await openBank(page);
  await expect(page.locator('#courseSelector')).toHaveValue('surgery');
  await expect(page.locator('#courseSelector option')).toHaveText(['Surgery']);
  await expect(page.locator('#subjectSelector option')).toHaveText([
    'Urology', 'General Surgery', 'GIT Surgery', 'Neurosurgery'
  ]);
  await expect(page.locator('#lectureFilter option')).toHaveCount(9);
  await expect(page.locator('#lecture-urology-renal-tumors .case')).toHaveCount(12);
  await expect(page.locator('#lecture-urology-renal-tumors .image-card')).toHaveCount(6);
});

test('adding Renal Tumours preserves legacy progress keys and isolates its own progress', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('medicalBankStatusV2', JSON.stringify({
      'urology-bladder-cancer::core::bc-s01': 'mastered'
    }));
  });
  await openBank(page);
  const legacy = page.locator('[data-key="urology-bladder-cancer::core::bc-s01"][data-status="mastered"]');
  await expect(legacy).toHaveClass(/active/);

  const renal = page.locator('[data-key="urology-renal-tumors::core::rt-s01"][data-status="review"]');
  await renal.click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('medicalBankStatusV2'))))
    .toEqual({
      'urology-bladder-cancer::core::bc-s01': 'mastered',
      'urology-renal-tumors::core::rt-s01': 'review'
    });
});

test('course registry and content-pack manifest are available as independent resources', async ({request}) => {
  const registryResponse = await request.get('/courses/catalog.json');
  expect(registryResponse.ok()).toBe(true);
  const registry = await registryResponse.json();
  expect(registry.defaultCourse).toBe('surgery');
  expect(registry.courses).toEqual([
    expect.objectContaining({id: 'surgery', manifest: 'surgery/course.json'})
  ]);

  const manifestResponse = await request.get('/courses/surgery/course.json');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.defaultSubject).toBe('urology');
  expect(manifest.lectureCatalog).toBe('../../lectures/catalog.json');
  expect(manifest.subjects.map(subject => subject.id)).toEqual([
    'urology', 'general', 'git', 'neurosurgery'
  ]);
});
