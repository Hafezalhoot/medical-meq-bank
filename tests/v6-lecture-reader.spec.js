import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});
const dermatology='/#/lecture/internal-medicine-ii-dermatology-introduction?course=internal-medicine-ii&subject=dermatology';
const bladder='/#/lecture/urology-bladder-cancer?course=surgery&subject=urology';
const ready=async(page)=> {
  await expect(page.locator('.lecture-title')).toBeVisible({timeout:20000});
  await expect(page.locator('#readerModeTabs')).toBeVisible({timeout:20000});
};

test('source guide starts in Explanation without stacking all sections below it',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(dermatology,{waitUntil:'domcontentloaded'});
  await ready(page);
  const tabs=page.getByRole('tablist',{name:'Lecture reading modes'});
  await expect(tabs.getByRole('tab',{name:'Explanation'})).toHaveAttribute('aria-selected','true');
  await expect(tabs.getByRole('tab',{name:'MCQ practice'})).toBeVisible();
  await expect(tabs.getByRole('tab',{name:'Infographic'})).toHaveCount(0);
  await expect(page.locator('.study-guide-part[data-guide-section="explanation"]')).toBeVisible();
  await expect(page.locator('.study-guide-part[data-guide-section="explanation"]')).toHaveAttribute('open','');
  await expect(page.locator('.study-guide-part[data-guide-section="mcqs"]')).toBeHidden();
  await expect(page.locator('.content-section.cases-section')).toBeHidden();
  await expect(page.locator('.study-guide-explanation:visible')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('Explanation topic picker shows one authored section at a time and can read all',async({page})=>{
  await page.goto(dermatology,{waitUntil:'domcontentloaded'});
  await ready(page);
  const select=page.getByRole('combobox',{name:'Lecture topic'});
  await expect(select).toBeVisible();
  expect(await select.locator('option').count()).toBe(11);
  await expect(page.locator('.study-guide-explanation:visible')).toHaveCount(1);
  await page.getByRole('button',{name:'Next topic'}).click();
  await expect(select).toHaveValue('e-2');
  await expect(page.locator('.study-guide-explanation:visible')).toHaveCount(1);
  await page.getByRole('button',{name:'Read all topics'}).click();
  await expect(page.locator('.study-guide-explanation:visible')).toHaveCount(11);
  await page.getByRole('button',{name:'Show one topic'}).click();
  await expect(page.locator('.study-guide-explanation:visible')).toHaveCount(1);
  await expect(select).toHaveValue('e-2');
});

test('switching to MCQs hides Explanation and survives a direct link reload',async({page})=>{
  await page.goto(dermatology,{waitUntil:'domcontentloaded'});
  await ready(page);
  const tabs=page.getByRole('tablist',{name:'Lecture reading modes'});
  await tabs.getByRole('tab',{name:'MCQ practice'}).click();
  await expect(tabs.getByRole('tab',{name:'MCQ practice'})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('.study-guide-part[data-guide-section="mcqs"]')).toBeVisible();
  await expect(page.locator('.study-guide-part[data-guide-section="explanation"]')).toBeHidden();
  await expect(page.locator('.study-guide-mcq').first()).toBeVisible();
  await expect(page).toHaveURL(/tab=mcqs/);
  await page.reload({waitUntil:'domcontentloaded'});
  await ready(page);
  await expect(tabs.getByRole('tab',{name:'MCQ practice'})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('.study-guide-mcq').first()).toBeVisible();
  await expect(page.locator('.lecture-title')).toContainText('Introduction to Dermatology');
});

test('legacy lecture offers only authored modes and keeps old question IDs intact',async({page})=>{
  await page.goto(bladder,{waitUntil:'domcontentloaded'});
  await ready(page);
  const tabs=page.getByRole('tablist',{name:'Lecture reading modes'});
  await expect(tabs.getByRole('tab',{name:'Explanation'})).toHaveCount(0);
  await expect(tabs.getByRole('tab',{name:'MCQ practice'})).toHaveCount(0);
  await expect(tabs.getByRole('tab',{name:'Cases'})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#urology-bladder-cancer-case-bc-c01')).toBeVisible();
  await expect(page.locator('.core-section')).toBeHidden();
  await tabs.getByRole('tab',{name:'Images'}).click();
  await expect(page.locator('.image-section')).toBeVisible();
  await expect(page.locator('.cases-section')).toBeHidden();
  await expect(page.locator('#urology-bladder-cancer-case-bc-c01')).toBeAttached();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('reading modes work from keyboard without losing saved study progress',async({page})=>{
  const legacy='urology-bladder-cancer::case::bc-c01';
  const scoped='v2::surgery::urology::urology-bladder-cancer::case::bc-c01';
  await page.addInitScript(key=>localStorage.setItem('medicalBankStatusV2',JSON.stringify({[key]:'mastered'})),legacy);
  await page.goto(bladder,{waitUntil:'domcontentloaded'});
  await ready(page);
  // Existing source rating keys migrate from legacy localStorage into the
  // course-scoped v2 IndexedDB key. Wait for the asynchronous migration, then
  // assert that keyboard navigation doesn't affect the migrated rating.
  const rating=()=>page.evaluate(async key=>{
    await globalThis.MEQProgressStore.ready;
    const stored=await globalThis.MEQProgressStore.exportAll();
    return stored[key];
  },scoped);
  await expect.poll(rating).toBe('mastered');
  const first=page.getByRole('tablist',{name:'Lecture reading modes'}).getByRole('tab').first();
  await first.focus();
  await page.keyboard.press('ArrowRight');
  const selected=page.getByRole('tablist',{name:'Lecture reading modes'}).locator('[role="tab"][aria-selected="true"]');
  await expect(selected).toHaveCount(1);
  await expect(selected).not.toHaveText('Cases');
  await expect.poll(rating).toBe('mastered');
});

test('reader modes preserve content and stay usable at 320px',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.goto(dermatology,{waitUntil:'domcontentloaded'});
  await ready(page);
  await expect(page.getByRole('combobox',{name:'Lecture topic'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('.study-guide-explanation:visible')).toHaveCount(1);
});
