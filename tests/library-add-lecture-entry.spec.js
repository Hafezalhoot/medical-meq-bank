import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

for(const width of [320,390,1440]){
  test('C2 Library has a visible, keyboard-usable Add lecture entry at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:width<500?844:900});
    await page.goto('/#/library',{waitUntil:'domcontentloaded'});
    const action=page.getByRole('link',{name:/Add lecture/});
    await expect(action).toBeVisible({timeout:20000});
    await expect(action).toHaveAttribute('href','#/manage');
    const size=await action.boundingBox();
    expect(size.height).toBeGreaterThanOrEqual(44);
    await action.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveAttribute('data-workspace','manage');
    await expect(page.locator('#libraryManager')).toBeVisible();
    await expect(page.locator('#intakeTitle')).toBeAttached();
    await expect(page.locator('.intake-boundary')).toContainText('Private draft');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });
}

test('C2 the Add lecture shortcut stays out of the distraction-free reader and Practice',async({page})=>{
  await page.goto('/#/lecture/internal-medicine-ii-dermatology-introduction?course=internal-medicine-ii&subject=dermatology');
  await expect(page.locator('.lecture-title')).toBeVisible({timeout:20000});
  await expect(page.locator('#libraryAddLectureLink')).toBeHidden();
  await page.goto('/#/practice');
  await expect(page.locator('#libraryAddLectureLink')).toBeHidden();
  await page.goto('/#/library');
  await expect(page.locator('#libraryAddLectureLink')).toBeVisible();
});

test('C2 Library shortcut preserves study progress when preparing a new lecture draft',async({page})=>{
  await page.goto('/#/library');
  const before=await page.evaluate(async()=>globalThis.MEQProgressStore.exportAll());
  await page.locator('#libraryAddLectureLink').click();
  await expect(page.locator('#libraryManager')).toBeVisible();
  await expect(page.getByText('Add a Material, specialty or Chapter')).toBeAttached();
  const after=await page.evaluate(async()=>globalThis.MEQProgressStore.exportAll());
  expect(after).toEqual(before);
});
