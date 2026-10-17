import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

// One actual source-grounded lecture pilot: no remote source scan is hosted.
test.use({serviceWorkers: 'block'});
const lectureId='internal-medicine-ii-dermatology-introduction';

async function openDermatology(page) {
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#courseSelector')).toBeVisible();
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
  const mobileToggle=page.locator('#mobileFiltersToggle');
  if(await mobileToggle.isVisible()){
    await mobileToggle.click();
    await expect(page.locator('#mobileFilterBackdrop')).toBeVisible();
  }
  await expect(page.locator('#lectureFilter option[value="'+lectureId+'"]')).toHaveCount(1, {timeout:15000});
  await page.locator('#lectureFilter').selectOption(lectureId);
  const closeMobileFilters=page.locator('#closeMobileFiltersBtn');
  if(await closeMobileFilters.isVisible()) await closeMobileFilters.click();
  await expect(page.locator('main')).toHaveAttribute('aria-busy','false',{timeout:15000});
  await expect(page.locator('#lecture-'+lectureId)).toBeVisible();
  await expect(page.locator('#dataAlert')).toBeHidden();
}

test('Internal Medicine II / Dermatology loads the complete 10-page source-based lecture', async ({page}) => {
  await openDermatology(page);
  const info=await page.evaluate(id=>{
    const l=lectures.find(item=>item.id===id);
    return {course:l.courseId,subject:l.subjectKey,counts:{
      cases:l.cases.length,core:l.coreShorts.length,image:l.imageQuestions.length,
      detailed:l.detailedShorts.length,rapid:l.rapid.length
    },guide:{explanation:l.studyGuide.explanation.length,mcqs:l.studyGuide.mcqs.length,
      infographic:Boolean(l.studyGuide.infographic)}};
  },lectureId);
  expect(info).toEqual({course:'internal-medicine-ii',subject:'dermatology',
    counts:{cases:16,core:70,image:14,detailed:17,rapid:41},
    guide:{explanation:11,mcqs:30,infographic:false}});
  await expect(page.locator('.learning-companion .study-guide-part')).toHaveCount(3);
  await page.locator('.learning-companion summary').first().click();
  await expect(page.getByText('Dermatology هو فرع الطب',{exact:false})).toBeVisible();
  await expect(page.locator('.study-guide-explanation p').first()).toHaveAttribute('dir','rtl');
  await expect(page.getByText('PDF p. 1',{exact:false}).first()).toBeVisible();
  await expect(page.locator('.study-guide-understanding strong').first())
    .toHaveText('Understanding Aid — Not an additional exam fact');
  await page.locator('.learning-companion summary').nth(1).click();
  const firstMCQ=page.locator('.study-guide-mcq').first();
  await expect(firstMCQ.locator('input[type="radio"]')).toHaveCount(4);
  await firstMCQ.locator('input[type="radio"]').nth(1).check();
  await firstMCQ.getByRole('button',{name:'Reveal explanation'}).click();
  await expect(firstMCQ.locator('.study-guide-answer')).toContainText('Your answer is correct.');
});

test('Dermatology uses only source figures and never substituted clinical graphics', async ({page}) => {
  await openDermatology(page);
  await expect(page.locator('#lecture-'+lectureId+' .image-card')).toHaveCount(14);
  await expect(page.locator('#lecture-'+lectureId+' .image-card[data-original-figure-id]')).toHaveCount(14);
  await expect(page.locator('#originalFigureTools')).toBeVisible();
  await expect(page.locator('.learning-companion .study-guide-part')).toHaveCount(3);
  await page.locator('.learning-companion summary').nth(2).click();
  await expect(page.locator('.original-guide-link')).toBeVisible();
  await expect(page.locator('.study-guide-figure img')).toHaveCount(0);
  const status=await page.evaluate(id=>{
    const l=lectures.find(item=>item.id===id);
    return {images:l.imageQuestions.map(q=>q.image??null),infographic:Boolean(l.studyGuide.infographic)};
  },lectureId);
  expect(status.images.every(img=>img===null)).toBe(true);
  expect(status.infographic).toBe(false);
});

test('Dermatology progress remains isolated from the original Surgery course', async ({page}) => {
  await page.addInitScript(()=>{
    localStorage.setItem('medicalBankStatusV2',JSON.stringify({'urology-bladder-cancer::case::bc-c01':'mastered'}));
  });
  await openDermatology(page);
  await expect(page.locator('#courseSelector')).toHaveValue('internal-medicine-ii');
  await page.locator('#courseSelector').selectOption('surgery');
  await expect(page.locator('#subjectSelector')).toHaveValue('urology');
  const preserved=await page.evaluate(async()=>{
    const data=await globalThis.MEQProgressStore.exportAll();
    return data['urology-bladder-cancer::case::bc-c01'];
  });
  expect(preserved).toBe('mastered');
  await expect(page.locator('#dataAlert')).toBeHidden();
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
  await expect(page.locator('#dataAlert')).toBeHidden();
});


test('original-source import works on phone and persists without changing progress', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await openDermatology(page);
  const photo=page.locator('.image-card[data-original-figure-id="derm-image-003"]');
  await expect(photo.locator('.original-source-placeholder')).toHaveCount(1);
  // A bundled app icon is a harmless binary fixture for file-import plumbing,
  // never presented in a medical test as an authentic clinical photograph.
  await page.locator('#originalFigureFiles').setInputFiles({
    name:'derm-image-003.png',mimeType:'image/png',buffer:readFileSync('icons/icon-192.png')
  });
  await expect(photo.locator('.source-figure-full img')).toBeVisible();
  await expect(photo).toHaveAttribute('data-visual-source','original-pdf');
  await expect(page.locator('#originalFigureStatus')).toContainText('1/14');
  await page.reload();
  await openDermatology(page);
  await expect(page.locator('.image-card[data-original-figure-id="derm-image-003"] .source-figure-full img')).toBeVisible();
  await expect(page.locator('#originalFigureStatus')).toContainText('1/14');
  await expect(page.locator('.image-card[data-original-figure-id="derm-image-004"] .original-source-placeholder')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
});
