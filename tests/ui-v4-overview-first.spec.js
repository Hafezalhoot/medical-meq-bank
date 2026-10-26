import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

async function openPsychiatryOverview(page,width=1440,height=900){
  await page.setViewportSize({width,height});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await page.locator('#subjectSelector').selectOption('psychiatry');
  if(await page.locator('#mobileFiltersToggle').isVisible())await page.locator('#mobileFiltersToggle').click();
  await page.locator('#lectureFilter').selectOption('all');
  const apply=page.locator('#applyMobileFiltersBtn');
  if(await apply.isVisible())await apply.click();
  await expect(page.locator('#mainLayout')).toHaveClass(/lecture-overview-active/);
  await expect(page.locator('.lecture-overview-card')).toHaveCount(2);
}

test('overview is a readable lecture choice and Start studying enters a real question',async ({page})=>{
  await openPsychiatryOverview(page);
  await expect(page.getByRole('heading',{name:'Psychiatry lectures'})).toBeVisible();
  await expect(page.locator('.lecture-overview-total')).toHaveText('2 lectures');
  const first=page.locator('.lecture-overview-card').first();
  await expect(first).toContainText('Psychiatric History Taking');
  await expect(first).toContainText('5 MEQ cases');
  await expect(first).toContainText('46 core shorts');
  await expect(first).toContainText('6 image questions');
  for(const kind of ['lectures','subtopics']){
    const toggle=page.locator(kind==='lectures'?'#toggleLectures':'#toggleSubtopics');
    if(await toggle.getAttribute('aria-pressed')==='true')await toggle.click();
  }
  const readingWidth=await page.locator('#mainContent').evaluate(el=>el.getBoundingClientRect().width);
  expect(readingWidth).toBeGreaterThanOrEqual(1100);
  await page.locator('#resumeStudyBtn').click();
  await expect(page.locator('#lectureFilter')).toHaveValue('internal-medicine-ii-psychiatry-psychiatric-history-mse');
  await expect(page.locator('#mainLayout')).not.toHaveClass(/lecture-overview-active/);
  await expect(page.locator('#mainContent .lecture')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>{
    const el=document.activeElement;
    return Boolean(el?.matches('.study-item,.study-guide-mcq'));
  }),{timeout:10000}).toBe(true);
});

test('overview Start prioritizes a Weak question in another Psychiatry lecture',async ({page})=>{
  await openPsychiatryOverview(page);
  await page.locator('#lectureFilter').selectOption('internal-medicine-ii-psychiatry-anxiety-disorders');
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
  const firstQuestion=page.locator('.study-item .status.weak').first();
  await expect(firstQuestion).toBeVisible();
  await firstQuestion.click();
  await expect(firstQuestion).toHaveClass(/active/);
  await page.locator('#lectureFilter').selectOption('all');
  await expect(page.locator('.lecture-overview-card')).toHaveCount(2);
  await page.locator('#resumeStudyBtn').click();
  await expect(page.locator('#lectureFilter')).toHaveValue('internal-medicine-ii-psychiatry-anxiety-disorders');
  await expect.poll(()=>page.evaluate(()=>{
    return document.activeElement?.classList.contains('study-item') ||
      document.activeElement?.classList.contains('study-guide-mcq');
  }),{timeout:10000}).toBe(true);
  await expect(page.locator('.status.weak.active').first()).toBeVisible();
});

test('320px and dark overview retain usable cards without document overflow',async ({page})=>{
  await openPsychiatryOverview(page,320,720);
  const button=page.locator('.lecture-overview-card').first();
  await expect(button).toBeVisible();
  await expect(button.locator('.lecture-overview-action')).toContainText('Open lecture');
  await expect(button.locator('.lecture-overview-name')).toBeVisible();
  const computed=await button.locator('.lecture-overview-name').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  expect(computed).toBeGreaterThanOrEqual(16);
  await page.locator('#darkBtn').click();
  await expect(button).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
