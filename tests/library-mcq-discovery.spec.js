import {test, expect} from '@playwright/test';

test.use({serviceWorkers:'block'});
const dermatology='internal-medicine-ii-dermatology-introduction';

async function openDermatology(page){
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#courseSelector')).toBeVisible();
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
  await expect(page.locator('#lecture-'+dermatology)).toBeVisible({timeout:20000});
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
}

async function openAdvancedFilters(page){
  const toggle=page.locator('#desktopFiltersToggle');
  if(await toggle.isVisible() && await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  await expect(page.locator('#typeFilter')).toBeVisible();
}

test('source MCQs are first-class: filter, source count, search and keyboard answer',async ({page})=>{
  await openDermatology(page);
  await expect(page.locator('#mcqCount')).toHaveText('30');
  await openAdvancedFilters(page);
  await page.locator('#typeFilter').selectOption('mcq');
  const cards=page.locator('#lecture-'+dermatology+' .study-guide-mcq:not(.hidden)');
  await expect(cards).toHaveCount(30);
  const part=page.locator('#'+dermatology+'-guide-mcqs');
  await expect(part).toHaveAttribute('open','');
  await expect(page.locator('.cases-section')).toBeHidden();
  await expect(page.locator('#lecture-'+dermatology+' .study-guide-part[data-guide-section="explanation"]')).toBeHidden();
  await page.locator('#search').fill('largest organ');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Which organ is described as the largest');
  await expect(cards.first()).toContainText('Lecture source: PDF p. 1');
  await cards.first().locator('input[type="radio"]').nth(1).check();
  await cards.first().getByRole('button',{name:'Reveal explanation'}).click();
  await expect(cards.first().locator('.study-guide-answer')).toContainText('Your answer is correct.');
});

test('MCQ-only Start and Random focus an actual source-backed question',async ({page})=>{
  await openDermatology(page);
  await openAdvancedFilters(page);
  await page.locator('#typeFilter').selectOption('mcq');
  await expect(page.locator('.study-guide-mcq:not(.hidden)')).toHaveCount(30);
  await page.locator('#resumeStudyBtn').click();
  await expect.poll(()=>page.evaluate(()=>document.activeElement?.classList.contains('study-guide-mcq'))).toBe(true);
  await page.locator('#randomBtn').click();
  await expect.poll(()=>page.evaluate(()=>document.activeElement?.classList.contains('study-guide-mcq'))).toBe(true);
  await expect(page.locator('#typeFilter')).toHaveValue('mcq');
});

test('MCQs have explicit saved ratings but answering alone never auto-marks Weak',async ({page})=>{
  await openDermatology(page);
  await openAdvancedFilters(page);
  await page.locator('#typeFilter').selectOption('mcq');
  const first=page.locator('#lecture-'+dermatology+' .study-guide-mcq:not(.hidden)').first();
  await first.locator('input[type="radio"]').first().check();
  await first.getByRole('button',{name:'Reveal explanation'}).click();
  await expect(first.locator('.status.active')).toHaveCount(0);
  await page.locator('#reviewFilter').selectOption('weak');
  await expect(page.locator('#lecture-'+dermatology+' .study-guide-mcq:not(.hidden)')).toHaveCount(0);
  await page.locator('#reviewFilter').selectOption('all');
  const restored=page.locator('#lecture-'+dermatology+' .study-guide-mcq:not(.hidden)').first();
  await restored.locator('.status.weak').click();
  await page.locator('#reviewFilter').selectOption('weak');
  await expect(page.locator('#lecture-'+dermatology+' .study-guide-mcq:not(.hidden)')).toHaveCount(1);
  await expect(page.locator('#myReviewCount')).toContainText('1 to revisit');
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
  await openAdvancedFilters(page);
  await page.locator('#typeFilter').selectOption('mcq');
  await expect(page.locator('#lecture-'+dermatology+' .study-guide-mcq:not(.hidden)')).toHaveCount(1);
  await expect(page.locator('.study-guide-mcq:not(.hidden) .status.weak.active')).toHaveCount(1);
});

test('My Review opens saved Weak source MCQ without clearing the Weak filter',async ({page})=>{
  await openDermatology(page);
  const mcq=page.locator('#'+dermatology+'-mcq-derm-mcq-001');
  await page.getByRole('navigation',{name:'Lecture sections'}).getByRole('button',{name:'MCQ practice',exact:true}).click();
  await expect(page.locator('#'+dermatology+'-guide-mcqs')).toHaveAttribute('open','');
  await mcq.locator('.status.weak').click();
  await expect(page.locator('#myReviewCount')).toContainText('1 to revisit');
  await page.locator('#myReviewDisclosure summary').click();
  const review=page.getByRole('button',{name:/Open 1 weak questions in.*Introduction/i});
  await expect(review).toBeVisible();
  await review.click();
  await expect(page.locator('#reviewFilter')).toHaveValue('weak');
  await expect(page.locator('#'+dermatology+'-guide-mcqs')).toHaveAttribute('open','');
  await expect(mcq).toBeVisible();
  await expect(mcq.locator('.status.weak')).toHaveClass(/active/);
  await expect(page.locator('#'+dermatology+' .study-guide-mcq:not(.hidden)')).toHaveCount(1);
});

test('MCQ bank can search source questions across both Psychiatry lectures on demand',async ({page})=>{
  const fetched=new Set();
  page.on('request',request=>{
    const url=new URL(request.url());
    if(url.pathname.startsWith('/lectures/data/'))fetched.add(url.pathname);
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await page.locator('#subjectSelector').selectOption('psychiatry');
  await expect(page.locator('#lectureFilter option[value="all"]')).toHaveCount(1);
  await page.locator('#lectureFilter').selectOption('all');
  await openAdvancedFilters(page);
  const beforeMcqSelection=new Set(fetched);
  await page.locator('#typeFilter').selectOption('mcq');
  await expect(page.locator('#mainContent .study-guide-mcq:not(.hidden)')).toHaveCount(108,{timeout:30000});
  await expect(page.locator('#mcqCount')).toHaveText('108');
  await page.locator('#search').fill('distinguish fear from anxiety');
  const cards=page.locator('#mainContent .study-guide-mcq:not(.hidden)');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('How does the lecture distinguish fear from anxiety?');
  await expect(cards.first()).toContainText('Lecture source: PDF p.2');
  // A course switch may already have fetched the previous default specialty.
  // MCQ discovery itself must load only the selected Psychiatry source payloads.
  expect([...fetched].filter(path=>!beforeMcqSelection.has(path)).every(path=>path.includes('psychiatry'))).toBe(true);
  expect(fetched.has('/lectures/data/internal-medicine-ii-psychiatry-anxiety-disorders.json')).toBe(true);
  expect(fetched.has('/lectures/data/internal-medicine-ii-psychiatry-psychiatric-history-mse.json')).toBe(true);
});

test('legacy lecture without authored MCQ has a truthful empty state and keeps Cases',async ({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.locator('#lectureFilter').selectOption('urology-bladder-cancer');
  await expect(page.locator('#lecture-urology-bladder-cancer')).toBeVisible({timeout:20000});
  await expect(page.locator('#mcqCount')).toHaveText('0');
  await openAdvancedFilters(page);
  await page.locator('#typeFilter').selectOption('mcq');
  await expect(page.locator('#mainContent .study-guide-mcq')).toHaveCount(0);
  await expect(page.locator('#emptyMessage')).toContainText('No source MCQs');
  await page.locator('#typeFilter').selectOption('case');
  await expect(page.locator('#urology-bladder-cancer-case-bc-c01')).toBeVisible();
});

test('phone MCQ review uses existing filter sheet with no horizontal overflow',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openDermatology(page);
  await page.locator('#mobileFiltersToggle').click();
  await page.locator('#typeFilter').selectOption('mcq');
  await page.locator('#applyMobileFiltersBtn').click();
  await expect(page.locator('#lecture-'+dermatology+' .study-guide-mcq:not(.hidden)')).toHaveCount(30);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});


test('specialty-wide source index finds MCQs and opens the exact authored question',async ({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await page.locator('#subjectSelector').selectOption('psychiatry');
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
  await page.locator('#search').fill('fear from anxiety');
  const result=page.locator('#globalSearchList .global-search-result[data-type="mcq"]')
    .filter({hasText:'How does the lecture distinguish fear from anxiety?'});
  await expect(result).toHaveCount(1,{timeout:20000});
  await result.click();
  await expect(page.locator('#lectureFilter')).toHaveValue('internal-medicine-ii-psychiatry-anxiety-disorders');
  const target=page.locator('#internal-medicine-ii-psychiatry-anxiety-disorders-mcq-psyanx-mcq-001');
  await expect(target).toBeVisible({timeout:20000});
  await expect(page.locator('#typeFilter')).toHaveValue('mcq');
});

test('catalog MCQ metadata is exact and does not change original grading keys',async ({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const response=await page.request.get('./lectures/catalog.json');
  expect(response.ok()).toBe(true);
  const catalog=await response.json();
  const available=catalog.lectures.filter(x=>Number.isInteger(x.mcqCount));
  expect(available.map(x=>[x.id,x.mcqCount]).sort()).toEqual([
    ['internal-medicine-ii-dermatology-introduction',30],
    ['internal-medicine-ii-psychiatry-anxiety-disorders',56],
    ['internal-medicine-ii-psychiatry-psychiatric-history-mse',52]
  ].sort());
  expect(available.reduce((sum,x)=>sum+x.mcqCount,0)).toBe(138);
});
