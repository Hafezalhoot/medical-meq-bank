import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
const derm='internal-medicine-ii-dermatology-introduction';
const lecture='/#/lecture/'+derm+'?course=internal-medicine-ii&subject=dermatology&tab=explanation';

test('R03 resume the exact source section across Library navigation and reload',async({page})=>{
  await page.goto(lecture);
  const reader=page.locator('#lecture-'+derm);
  await expect(reader.locator('#readerTopicSelect')).toBeVisible();
  await reader.locator('#readerTopicSelect').selectOption('e-4');
  await expect(reader.locator('.study-guide-explanation:visible h3'))
    .toContainText('Dermis, Hypodermis and skin appendages');
  await expect.poll(async()=>Boolean(await page.evaluate(()=>globalThis.MEQStudyPosition?.read())))
    .toBe(true);
  await page.goto('/#/library');
  const continueButton=page.getByRole('button',{name:/Continue Introduction to Dermatology/i});
  await expect(continueButton).toBeVisible();
  await page.reload();
  await expect(continueButton).toBeVisible();
  await continueButton.click();
  await expect(reader.locator('#readerTopicSelect')).toHaveValue('e-4');
  await expect(reader.locator('.study-guide-explanation:visible h3'))
    .toContainText('Dermis, Hypodermis and skin appendages');
});

test('R03 valid direct link overrides the remembered section, not the other way round',async({page})=>{
  await page.goto(lecture);
  await page.locator('#lecture-'+derm+' #readerTopicSelect').selectOption('e-6');
  await expect.poll(async()=> (await page.evaluate(async()=>await globalThis.MEQStudyPosition?.read()))?.sectionId).toBe('e-6');
  await page.goto(lecture+'&section=e-3');
  await expect(page.locator('#lecture-'+derm+' #readerTopicSelect')).toHaveValue('e-3');
  await expect(page.locator('#lecture-'+derm+' .study-guide-explanation:visible h3')).toContainText('Epidermal cells');
});

test('R03 a stale saved lecture cannot redirect or overwrite existing ratings',async({page})=>{
  await page.goto('/#/library');
  await page.evaluate(async()=>{
    await globalThis.MEQProgressStore.ready;
    await globalThis.MEQProgressStore.replaceAll({'v2::surgery::urology::urology-bladder-cancer::core::fixture-r03':'weak'});
    await globalThis.MEQStudyPosition?.save({
      schemaVersion:1,view:'lecture',courseId:'surgery',subjectId:'urology',
      lectureId:'lecture-no-longer-exists',mode:'read'
    },{});
  });
  await page.reload();
  await expect(page.getByRole('button',{name:/Continue lecture-no-longer-exists/i})).toHaveCount(0);
  await expect(page.locator('body')).toHaveAttribute('data-workspace','library');
  await expect.poll(async()=>await page.evaluate(async()=>{
    await globalThis.MEQProgressStore.ready;
    return (await globalThis.MEQProgressStore.exportAll())['v2::surgery::urology::urology-bladder-cancer::core::fixture-r03'];
  })).toBe('weak');
});

test('R03 standalone HTML retains its reading checkpoint across a page reload',async({page})=>{
  const {resolve}=await import('node:path');
  const {pathToFileURL}=await import('node:url');
  const standalone=pathToFileURL(resolve('dist/offline/Medical_MEQ_Review_Bank_Offline.html')).href;
  await page.goto(standalone+'#/lecture/'+derm);
  const select=page.locator('#lecture-'+derm+' #readerTopicSelect');
  await expect(select).toBeVisible();
  await select.selectOption('e-7');
  await expect.poll(async()=> (await page.evaluate(async()=>await globalThis.MEQStudyPosition?.read()))?.sectionId).toBe('e-7');
  await page.reload();
  await expect(select).toHaveValue('e-7');
});