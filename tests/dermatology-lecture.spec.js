import {test, expect} from '@playwright/test';

// One actual source-grounded lecture pilot: no remote source scan is hosted.
test.use({serviceWorkers: 'block'});
const lectureId='internal-medicine-ii-dermatology-introduction';

async function openDermatology(page) {
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#courseSelector')).toBeVisible();
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
  await expect(page.locator('#lectureFilter option[value="'+lectureId+'"]')).toHaveCount(1, {timeout:15000});
  await page.locator('#lectureFilter').selectOption(lectureId);
  await expect(page.locator('main')).toHaveAttribute('aria-busy','false',{timeout:15000});
  await expect(page.locator('#lecture-'+lectureId)).toBeVisible();
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
    guide:{explanation:11,mcqs:30,infographic:true}});
  await expect(page.locator('.learning-companion .study-guide-part')).toHaveCount(3);
  await page.locator('.learning-companion summary').first().click();
  await expect(page.getByText('Dermatology هو فرع الطب',{exact:false})).toBeVisible();
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

test('original lecture visuals are served locally and avoid reproducing source clinical photos', async ({page}) => {
  await openDermatology(page);
  const sources=[
    '/assets/lectures/dermatology-intro/skin-layers.svg',
    '/assets/lectures/dermatology-intro/lesion-atlas.svg',
    '/assets/lectures/dermatology-intro/lesions-classification.svg'
  ];
  for(const url of sources){
    const res=await page.request.get(url);
    expect(res.ok(),url).toBe(true);
    const markup=await res.text();
    expect(markup).toContain('<svg');
    expect(markup).not.toMatch(/<script|<foreignObject|<!DOCTYPE|url\(/i);
  }
  await page.locator('.learning-companion summary').nth(2).click();
  const infographic=page.locator('.study-guide-figure img');
  await expect(infographic).toBeVisible();
  await expect.poll(()=>infographic.evaluate(el=>el.complete && el.naturalWidth>0)).toBe(true);
  await expect(page.locator('#lecture-'+lectureId+' .image-card')).toHaveCount(14);
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
});
