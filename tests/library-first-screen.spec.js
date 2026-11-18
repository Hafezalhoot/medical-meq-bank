import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

for(const {width,height} of [{width:320,height:700},{width:390,height:844}]){
  test('U1 Library shows the first real lecture within the opening viewport at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height});
    await page.goto('/#/library',{waitUntil:'domcontentloaded'});
    const first=page.locator('.lecture-overview-card').first();
    await expect(first).toBeVisible({timeout:20000});
    const geometry=await first.boundingBox();
    expect(geometry.y,'First lecture is buried below redundant Library chrome').toBeLessThanOrEqual(430);
    for(const selector of ['#courseSelector','#subjectSelector','#libraryLectureSearch','#libraryAddLectureLink']){
      await expect(page.locator(selector)).toBeVisible();
      const box=await page.locator(selector).boundingBox();
      expect(box.height,selector+' should be touchable').toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });
}

test('U1 mobile Library search has an empty state, Escape resets, and Add lecture remains accessible',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.goto('/#/library',{waitUntil:'domcontentloaded'});
  const first=page.locator('.lecture-overview-card').first();
  await expect(first).toBeVisible({timeout:20000});
  const input=page.locator('#libraryLectureSearch');
  await input.fill('no-such-lecture-u1-2026');
  await expect(page.locator('.library-search-empty')).toContainText('No lectures match this search.');
  await expect(page.getByRole('link',{name:'Add lecture draft'})).toBeVisible();
  await input.press('Escape');
  await expect(input).toHaveValue('');
  await expect(first).toBeVisible();
  await page.getByRole('link',{name:'Add lecture draft'}).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/manage/);
  await expect(page.getByRole('heading',{name:'Manage library'})).toBeVisible();
});

test('U1 course and specialty changes retain real lecture deep links and browser Back',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/library',{waitUntil:'domcontentloaded'});
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await page.locator('#subjectSelector').selectOption('dermatology');
  const lecture=page.getByRole('button',{name:'Open lecture: Introduction to Dermatology'});
  await expect(lecture).toBeVisible({timeout:20000});
  await lecture.click();
  await expect(page).toHaveURL(/#\/lecture\/internal-medicine-ii-dermatology-introduction/);
  await expect(page.locator('body')).toHaveAttribute('data-workspace','lecture');
  await page.goBack();
  await expect(page.locator('body')).toHaveAttribute('data-workspace','library');
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
});

test('U1 Library rating bar reflows without horizontal document scroll at 200% text zoom',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.goto('/#/library',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.lecture-overview-card').first()).toBeVisible({timeout:20000});
  await page.evaluate(()=>{document.documentElement.style.zoom='200%'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('#courseSelector')).toBeVisible();
  await expect(page.locator('#subjectSelector')).toBeVisible();
});
