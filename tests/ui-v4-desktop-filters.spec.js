import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

async function openBank(page,width=1440,height=900){
  await page.setViewportSize({width,height});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
  await expect(page.locator('#reviewFilter')).toBeAttached();
}

test('desktop first row shows search, lecture, random, and a real advanced-filter disclosure',async({page})=>{
  await openBank(page);
  const toggle=page.locator('#desktopFiltersToggle');
  const toolbar=page.locator('#studyToolbar');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  for(const id of ['#search','#lectureFilter','#randomBtn'])await expect(page.locator(id)).toBeVisible();
  for(const id of ['#typeFilter','#topicFilter','#priorityFilter','#reviewFilter','#revealBtn'])
    await expect(page.locator(id)).toBeHidden();
  const compactHeight=(await toolbar.boundingBox()).height;
  expect(compactHeight).toBeLessThanOrEqual(90);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await expect(toolbar).toHaveClass(/desktop-filters-expanded/);
  for(const id of ['#typeFilter','#topicFilter','#priorityFilter','#reviewFilter','#revealBtn'])
    await expect(page.locator(id)).toBeVisible();
  await page.locator('#typeFilter').selectOption('core');
  await expect(page.locator('#activeFilterChips')).toContainText('Type: High-yield shorts');
  await expect(toggle.locator('.desktop-filter-count')).toHaveText('1');
  await toggle.click();
  await expect(page.locator('#typeFilter')).toBeHidden();
  await expect(page.locator('#typeFilter')).toHaveValue('core');
  await expect(toggle).toHaveAttribute('aria-label',/1 active/);
  await page.locator('#resetFilterChipsBtn').click();
  await expect(page.locator('#typeFilter')).toHaveValue('all');
  await expect(toggle.locator('.desktop-filter-count')).toBeHidden();
});

test('desktop Advanced filters closes on Escape and returns keyboard focus',async({page})=>{
  await openBank(page);
  const toggle=page.locator('#desktopFiltersToggle');
  await toggle.click();
  await page.locator('#priorityFilter').focus();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#priorityFilter')).toBeHidden();
});

test('a previously saved Weak filter stays visible in the badge and chips even when closed',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('medicalBankReviewFilterV1','weak');
  });
  await openBank(page);
  await expect(page.locator('#reviewFilter')).toHaveValue('weak');
  const toggle=page.locator('#desktopFiltersToggle');
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(toggle.locator('.desktop-filter-count')).toHaveText('1');
  await expect(page.locator('#activeFilterChips')).toContainText('Status: Weak');
  await toggle.click();
  await expect(page.locator('#reviewFilter')).toBeVisible();
  await expect(page.locator('#reviewFilter')).toHaveValue('weak');
});

for(const width of [768,1024,1440]){
  test(`desktop/tablet ${width}px keeps both filter states inside the viewport`,async({page})=>{
    await openBank(page,width,900);
    const toggle=page.locator('#desktopFiltersToggle');
    await expect(toggle).toBeVisible();
    for(const open of [false,true]){
      if(open)await toggle.click();
      const boxes=await page.evaluate(()=>{
        const ids=['search','lectureFilter','desktopFiltersToggle','randomBtn'];
        if(document.getElementById('studyToolbar').classList.contains('desktop-filters-expanded'))
          ids.push('typeFilter','topicFilter','priorityFilter','reviewFilter','revealBtn');
        return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
          elements:ids.map(id=>{
            const b=document.getElementById(id).getBoundingClientRect();
            return {id,left:b.left,right:b.right,height:b.height}
          })};
      });
      expect(boxes.scrollWidth).toBeLessThanOrEqual(boxes.width+1);
      for(const box of boxes.elements){
        expect(box.left,box.id).toBeGreaterThanOrEqual(-1);
        expect(box.right,box.id).toBeLessThanOrEqual(width+1);
        expect(box.height,box.id).toBeGreaterThanOrEqual(43);
      }
    }
  });
}

for(const width of [320,390]){
  test(`${width}px phone preserves the existing mobile sheet and dark-mode interactions`,async({page})=>{
    await openBank(page,width,770);
    await expect(page.locator('#desktopFiltersToggle')).toBeHidden();
    const mobile=page.locator('#mobileFiltersToggle');
    await expect(mobile).toBeVisible();
    await mobile.click();
    await expect(page.locator('#typeFilter')).toBeVisible();
    await page.locator('#typeFilter').selectOption('image');
    await page.locator('#applyMobileFiltersBtn').click();
    await expect(page.locator('#mobileFilterBackdrop')).toBeHidden();
    await expect(page.locator('#activeFilterChips')).toContainText('Type: Image/spot questions');
    await page.locator('#darkBtn').click();
    await expect(page.locator('body')).toHaveClass(/dark/);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });
}
