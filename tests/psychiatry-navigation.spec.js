import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test.use({serviceWorkers: 'block'});

const SOURCE_LECTURES = [
  {id: 'internal-medicine-ii-psychiatry-psychiatric-history-mse',
    name: 'Psychiatric History Taking & Mental Status Examination',
    mcqs: 52, explanations: 45, images: 6, cases: 5, core: 46, detailed: 13, rapid: 28},
  {id: 'internal-medicine-ii-psychiatry-anxiety-disorders',
    name: 'Anxiety Disorders',
    mcqs: 56, explanations: 40, images: 7, cases: 5, core: 47, detailed: 12, rapid: 30}
];

async function openPsychiatry(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#courseSelector')).toBeVisible();
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await expect(page.locator('#subjectSelector option[value="psychiatry"]')).toHaveText('Psychiatry');
  await page.locator('#subjectSelector').selectOption('psychiatry');
  const mobileToggle = page.locator('#mobileFiltersToggle');
  if (await mobileToggle.isVisible()) await mobileToggle.click();
  await expect(page.locator('#lectureFilter option')).toHaveCount(3, {timeout: 20_000});
  await expect(page.locator('#lectureFilter option').nth(1)).toContainText('Psychiatric History');
  await expect(page.locator('#lectureFilter option').nth(2)).toContainText('Anxiety Disorders');
}

test('Psychiatry appears in the actual course selector and both published lectures load', async ({page}) => {
  await openPsychiatry(page);
  for (const source of SOURCE_LECTURES) {
    await page.locator('#lectureFilter').selectOption(source.id);
    await expect(page.locator('#lecture-' + source.id)).toBeAttached({timeout: 20_000});
    await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false', {timeout: 20_000});
    const study = await page.evaluate(id => {
      const lecture = lectures.find(item => item.id === id);
      if (!lecture || lecture.__metadataOnly) return null;
      return {
        id: lecture.id,
        title: lecture.title,
        course: lecture.courseId,
        subject: lecture.subjectKey,
        mcqs: lecture.studyGuide?.mcqs.length,
        explanations: lecture.studyGuide?.explanation.length,
        cases: lecture.cases.length,
        core: lecture.coreShorts.length,
        detailed: lecture.detailedShorts.length,
        rapid: lecture.rapid.length,
        imageQuestions: lecture.imageQuestions.length,
        missingImageSources: lecture.imageQuestions.filter(q => !q.image).length
      };
    }, source.id);
    expect(study).toMatchObject({
      id: source.id, title: source.name,
      course: 'internal-medicine-ii', subject: 'psychiatry',
      mcqs: source.mcqs, explanations: source.explanations,
      cases: source.cases, core: source.core,
      detailed: source.detailed, rapid: source.rapid,
      imageQuestions: source.images, missingImageSources: 0
    });
    await expect(page.locator('#lecture-' + source.id + ' .study-guide-mcq'))
      .toHaveCount(source.mcqs);
    await expect(page.locator('#lecture-' + source.id + ' .image-card'))
      .toHaveCount(source.images);
    // Verify actual original PDF-crop JPEG assets, not placeholders or substituted AI art.
    const images = page.locator('#lecture-' + source.id + ' .image-card img');
    await expect(images).toHaveCount(source.images);
    await expect(page.locator('#lecture-' + source.id + ' .visual-placeholder'))
      .toHaveCount(0);
    const assets = await page.evaluate(async id => {
      const lecture = lectures.find(item => item.id === id);
      return Promise.all(lecture.imageQuestions.map(async item => {
        const response = await fetch(item.image);
        const data = await response.arrayBuffer();
        return {ok: response.ok, type: response.headers.get('content-type'),
          bytes: data.byteLength, expected: item.imageBytes,
          hashLength: item.imageSha256?.length, page: item.page};
      }));
    }, source.id);
    expect(assets).toHaveLength(source.images);
    for (const image of assets) {
      expect(image.ok).toBe(true);
      expect(image.type).toMatch(/image\/jpeg/);
      expect(image.bytes).toBeGreaterThan(300);
      expect(image.bytes).toBe(image.expected);
      expect(image.hashLength).toBe(64);
      expect(image.page).toMatch(/^PDF p\.\d+$/);
    }
    await expect(page.locator('#dataAlert')).toBeHidden();
  }
});

test('iPhone layout can select Psychiatry and open Anxiety Disorders', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await openPsychiatry(page);
  await page.locator('#lectureFilter').selectOption(SOURCE_LECTURES[1].id);
  await expect(page.locator('#lecture-' + SOURCE_LECTURES[1].id)).toBeAttached();
  await expect(page.locator('#lecture-' + SOURCE_LECTURES[1].id + ' .study-guide-mcq'))
    .toHaveCount(56);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(1);
});

test('release cache identity changed along with Psychiatry catalog and embedded course registry', async ({page}) => {
  const sourceVersion = JSON.parse(readFileSync('version.json', 'utf8')).version;
  const sw = readFileSync('service-worker.js', 'utf8');
  const pwa = readFileSync('src/pwa-client.js', 'utf8');
  const [year, month, day] = sourceVersion.split('.').map(Number);
  expect(year * 10000 + month * 100 + day).toBeGreaterThanOrEqual(20261025);
  expect(sw).toContain("const APP_VERSION = '" + sourceVersion + "'");
  expect(pwa).toContain("const APP_VERSION = '" + sourceVersion + "'");
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  const evidence = await page.evaluate(async () => {
    const [version, runtime, catalog] = await Promise.all([
      fetch('/version.json', {cache: 'no-store'}).then(r => r.json()),
      fetch('/course-packs.js', {cache: 'no-store'}).then(r => r.text()),
      fetch('/lectures/catalog.json', {cache: 'no-store'}).then(r => r.json())
    ]);
    return {
      version: version.version,
      hasPsychiatry: runtime.includes('"id":"psychiatry"'),
      psychiatryLectures: catalog.lectures.filter(
        lecture => lecture.courseId === 'internal-medicine-ii' && lecture.subjectKey === 'psychiatry'
      ).length
    };
  });
  expect(evidence).toEqual({
    version: sourceVersion, hasPsychiatry: true, psychiatryLectures: 2
  });
});
