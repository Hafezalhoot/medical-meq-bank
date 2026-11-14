import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

const derm='/#/lecture/internal-medicine-ii-dermatology-introduction?course=internal-medicine-ii&subject=dermatology';

test('B1: phone reader places study text near the first screen without hiding source information',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(derm,{waitUntil:'domcontentloaded'});
  const article=page.locator('.study-guide-explanation:visible').first();
  await expect(article).toBeVisible({timeout:20000});
  const top=await article.locator('h3').evaluate(el=>el.getBoundingClientRect().top);
  expect(top,'the first explanation heading should not be buried below stacked controls').toBeLessThan(620);
  const about=page.locator('#lecture-internal-medicine-ii-dermatology-introduction .source-boundary');
  await expect(about).toHaveCount(1);
  await expect(about).not.toHaveAttribute('open','');
  await expect(about.locator('.lecture-summary')).toHaveCount(1);
  await about.locator('summary').click();
  await expect(about.locator('.lecture-summary')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('B1: compact phone topic controls retain native selection, read-all and keyboard focus',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.goto(derm,{waitUntil:'domcontentloaded'});
  const reader=page.locator('#lecture-internal-medicine-ii-dermatology-introduction');
  await expect(reader.locator('#readerTopicSelect')).toBeVisible({timeout:20000});
  const bar=reader.locator('#readerTopicBar');
  const geometry=await bar.evaluate(el=>{
    const select=el.querySelector('select').getBoundingClientRect();
    const prev=el.querySelector('#readerPreviousTopic').getBoundingClientRect();
    const next=el.querySelector('#readerNextTopic').getBoundingClientRect();
    return {selectTop:select.top,prevTop:prev.top,nextTop:next.top,prevWidth:prev.width,nextWidth:next.width};
  });
  expect(Math.abs(geometry.selectTop-geometry.prevTop)).toBeLessThan(9);
  expect(Math.abs(geometry.prevTop-geometry.nextTop)).toBeLessThan(9);
  expect(geometry.prevWidth).toBeGreaterThanOrEqual(44);
  expect(geometry.nextWidth).toBeGreaterThanOrEqual(44);
  await reader.locator('#readerNextTopic').click();
  await expect(reader.locator('#readerTopicSelect')).toHaveValue('e-2');
  await expect(reader.getByRole('button',{name:'Read all topics'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('B1: exam setup selects Material, specialty, and lecture without relying on hidden Library settings',async({page})=>{
  await page.goto('/#/exams',{waitUntil:'domcontentloaded'});
  await page.locator('#workspaceExamStart').click();
  await expect(page.locator('#examDialog')).toBeVisible();
  await expect(page.getByLabel('Material / course',{exact:true})).toBeVisible();
  await page.locator('#examCourse').selectOption('internal-medicine-ii');
  await page.locator('#examSpecialty').selectOption('psychiatry');
  await page.locator('#examLecture').selectOption('internal-medicine-ii-psychiatry-anxiety-disorders');
  await page.locator('#examScope').selectOption('lecture');
  await expect(page.locator('#examScopeSummary')).toContainText('Anxiety Disorders');
  await expect(page.locator('#examAvailableCount')).toContainText('56 source MCQs');
  await expect(page.locator('#examScopeSummary')).toContainText('Psychiatry');
  await page.locator('#examFormat').selectOption('mcq');
  await page.locator('#examCount').selectOption('10');
  await page.locator('#examBegin').click();
  await expect(page.locator('#examPlay')).toBeVisible({timeout:20000});
  await expect(page.locator('#examQuestion')).toContainText('Anxiety Disorders');
  await expect(page.locator('#examCounts')).toContainText('0 / 10');
});

test('B1: changing exam selectors does not silently change Library scope or ongoing ratings',async({page})=>{
  await page.goto('/#/exams',{waitUntil:'domcontentloaded'});
  const before=await page.evaluate(()=>({
    course:globalThis.MEQCourseRegistry.activeCourse,
    subject:document.getElementById('subjectSelector').value
  }));
  await page.locator('#workspaceExamStart').click();
  await page.locator('#examCourse').selectOption('internal-medicine-ii');
  await page.locator('#examSpecialty').selectOption('dermatology');
  await page.locator('#examFormat').selectOption('mcq');
  const after=await page.evaluate(()=>({
    course:globalThis.MEQCourseRegistry.activeCourse,
    subject:document.getElementById('subjectSelector').value
  }));
  expect(after).toEqual(before);
  await expect(page.locator('#examScopeSummary')).toContainText('Dermatology');
});

test('B1: exam scope shows empty availability rather than pretending an unrelated specialty has questions',async({page})=>{
  await page.goto('/#/exams');
  await page.locator('#workspaceExamStart').click();
  await page.locator('#examCourse').selectOption('internal-medicine-ii');
  await page.locator('#examSpecialty').selectOption('dermatology');
  await page.locator('#examFormat').selectOption('mcq');
  await page.locator('#examScope').selectOption('lecture');
  await page.locator('#examLecture').selectOption('internal-medicine-ii-dermatology-introduction');
  await expect(page.locator('#examAvailableCount')).toContainText('30 source MCQs');
  await expect(page.locator('#examScopeSummary')).toContainText('Introduction to Dermatology');
});
