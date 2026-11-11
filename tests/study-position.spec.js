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
  const diagnostic=await page.evaluate(async()=>{
    const record=await globalThis.MEQStudyPosition?.read();
    const catalog=await globalThis.MEQLectureLoader?.loadCatalog();
    return {workspace:document.body.dataset.workspace,record,
      result:globalThis.MEQStudyPosition?.validate(record,catalog),
      card:document.getElementById('continueLastStudyCard')?.outerHTML.slice(0,700)};
  });
  expect(diagnostic.result,{diagnostic}).toMatchObject({ok:true});
  const continueButton=page.getByRole('button',{name:/Continue Introduction to Dermatology/i});
  await expect(continueButton,{diagnostic}).toBeVisible();
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

test('R03 Practice restores the exact authored question after leaving and reloading Library',async({page})=>{
  await page.goto('/#/practice');
  await expect(page.locator('#practiceSession')).toBeVisible({timeout:20000});
  await page.locator('#practiceNext').click();
  await page.locator('#practiceNext').click();
  const lastId=await page.locator('.practice-current').getAttribute('id');
  expect(lastId).toMatch(/^[a-z0-9-]+$/);
  await expect.poll(async()=>page.evaluate(async()=>(await globalThis.MEQStudyPosition.read())?.questionId))
    .toBe(lastId);
  await page.goto('/#/library');
  await page.reload();
  const continueButton=page.locator('#continueLastStudy');
  await expect(continueButton).toBeVisible();
  await continueButton.click();
  await expect(page.locator('body')).toHaveAttribute('data-workspace','practice');
  await expect(page.locator('.practice-current')).toHaveAttribute('id',lastId);
  await expect(page.locator('#practiceQuestionCounter')).toContainText('Question 3 of');
  expect(await page.evaluate(()=>new URLSearchParams(location.hash.split('?')[1]).get('question')))
    .toBe(lastId);
});

test('R03 explicit Practice question link wins over a previously saved checkpoint',async({page})=>{
  await page.goto('/#/practice');
  await expect(page.locator('#practiceSession')).toBeVisible({timeout:20000});
  await page.locator('#practiceNext').click();
  const saved=await page.locator('.practice-current').getAttribute('id');
  await expect.poll(async()=>page.evaluate(async()=>(await globalThis.MEQStudyPosition.read())?.questionId))
    .toBe(saved);
  const first='urology-bladder-cancer-case-bc-c01';
  await page.goto('/#/practice?course=surgery&subject=urology&lecture=urology-bladder-cancer&question='+first);
  await expect(page.locator('.practice-current')).toHaveAttribute('id',first,{timeout:20000});
  await expect(page.locator('#practiceQuestionCounter')).toContainText('Question 1 of');
});

test('R03 an unavailable Practice question falls back safely; saved grades are unchanged',async({page})=>{
  await page.goto('/#/practice?course=surgery&subject=urology&lecture=urology-bladder-cancer&question=missing-question');
  await expect(page.locator('#practiceSession')).toBeVisible({timeout:20000});
  await expect(page.locator('.practice-current')).toBeVisible();
  expect(await page.locator('.practice-current').getAttribute('id')).not.toBe('missing-question');
  await expect.poll(async()=>page.evaluate(()=>new URLSearchParams(location.hash.split('?')[1]).get('question')))
    .not.toBe('missing-question');
  await expect(page.locator('#practicePrevious')).toBeDisabled();
});

test('R03 each Rapid Recall card has a stable source-scoped question link',async({page})=>{
  const rapidId='urology-bladder-cancer-rapid-1';
  await page.goto('/#/practice?course=surgery&subject=urology&lecture=urology-bladder-cancer&question='+rapidId);
  await expect(page.locator('.practice-current')).toHaveAttribute('id',rapidId,{timeout:20000});
  await expect.poll(async()=>page.evaluate(async()=>(await globalThis.MEQStudyPosition.read())?.questionId))
    .toBe(rapidId);
});


test('R03 authored question identifiers containing underscores can be resumed',async({page})=>{
  const question='urology-bph-prostate-carcinoma-core-bp_core01';
  await page.goto('/#/practice?course=surgery&subject=urology&lecture=urology-bph-prostate-carcinoma&question='+question);
  await expect(page.locator('.practice-current')).toHaveAttribute('id',question,{timeout:20000});
  await expect.poll(async()=>page.evaluate(async()=>(await globalThis.MEQStudyPosition.read())?.questionId)).toBe(question);
  await page.goto('/#/library');
  await expect(page.locator('#continueLastStudy')).toBeVisible();
  await page.locator('#continueLastStudy').click();
  await expect(page.locator('.practice-current')).toHaveAttribute('id',question);
});
