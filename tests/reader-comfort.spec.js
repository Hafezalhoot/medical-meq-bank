import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
const derm='/#/lecture/internal-medicine-ii-dermatology-introduction?course=internal-medicine-ii&subject=dermatology';

test('D1 reader text size is adjustable and persists without changing study progress',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(derm,{waitUntil:'domcontentloaded'});
  const root=page.locator('#lecture-internal-medicine-ii-dermatology-introduction');
  const paragraph=root.locator('.study-guide-explanation:visible p').first();
  await expect(paragraph).toBeVisible({timeout:20000});
  const before=await paragraph.evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
  const progress=await page.evaluate(async()=>globalThis.MEQProgressStore.exportAll());
  const size=page.getByRole('group',{name:'Reading text size'});
  await expect(size).toBeVisible();
  await size.getByRole('button',{name:'Increase text size'}).click();
  const after=await paragraph.evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
  expect(after).toBeGreaterThan(before);
  await page.reload();
  await expect(paragraph).toBeVisible({timeout:20000});
  expect(await paragraph.evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBe(after);
  expect(await page.evaluate(async()=>globalThis.MEQProgressStore.exportAll())).toEqual(progress);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await size.getByRole('button',{name:'Reset text size'}).click();
  expect(await paragraph.evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBe(before);
});

for(const width of [320,768,1440]){
  test('D1 reading size controls leave reader tabs and original text reachable at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto(derm,{waitUntil:'domcontentloaded'});
    const tab=page.getByRole('tab',{name:'Explanation'});
    await expect(tab).toBeVisible({timeout:20000});
    const size=page.getByRole('group',{name:'Reading text size'});
    await expect(size.getByRole('button',{name:'Increase text size'})).toBeVisible();
    for(let i=0;i<3;i++)await size.getByRole('button',{name:'Increase text size'}).click();
    await expect(page.locator('.study-guide-explanation:visible').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    await expect(page.locator('#readerTopicSelect')).toBeVisible();
    await tab.focus();
    await expect(tab).toBeFocused();
  });
}

test('D1 print typography ignores the device reading-size preference',async({page})=>{
  await page.goto(derm,{waitUntil:'domcontentloaded'});
  const paragraph=page.locator('.study-guide-explanation:visible p').first();
  await expect(paragraph).toBeVisible({timeout:20000});
  const size=page.getByRole('group',{name:'Reading text size'});
  await size.getByRole('button',{name:'Increase text size'}).click();
  await size.getByRole('button',{name:'Increase text size'}).click();
  await page.emulateMedia({media:'print'});
  const enlargedPreferencePrint=await paragraph.evaluate(node=>getComputedStyle(node).fontSize);
  await page.emulateMedia({media:'screen'});
  await size.getByRole('button',{name:'Reset text size'}).click();
  await page.emulateMedia({media:'print'});
  const defaultPreferencePrint=await paragraph.evaluate(node=>getComputedStyle(node).fontSize);
  expect(enlargedPreferencePrint).toBe(defaultPreferencePrint);
});
