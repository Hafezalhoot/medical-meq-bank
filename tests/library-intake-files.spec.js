import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
const intake={
  format:'medical-library-intake',version:1,status:'needs-source-review',
  lecture:{
    course:'surgery',subject:'urology',title:'Source intake follow-up',
    source:'Urology Chapter 5.pdf',id:'surgery-urology-source-intake-follow-up',order:9,
    topics:[{id:'topic-1',label:'Definitions'},{id:'topic-2',label:'الشرح من المحاضرة'}]
  }
};

test('B2 choosing a PDF fills metadata but never uploads or extracts source content',async({page})=>{
  const sent=[];
  page.on('request',r=>{if(r.method()!=='GET')sent.push({url:r.url(),method:r.method()})});
  await page.goto('/#/manage');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.locator('#intakePdf').setInputFiles({
    name:'Asthma Lecture.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%example\n')
  });
  await expect(page.locator('#intakeSource')).toHaveValue('Asthma Lecture.pdf');
  await expect(page.locator('#intakeTitle')).toHaveValue('Asthma Lecture');
  await expect(page.locator('#intakeId')).toHaveValue('surgery-urology-asthma-lecture');
  await expect(page.locator('#intakePdfHelp')).toContainText('stays on this device');
  expect(sent).toEqual([]);
  await page.reload();
  await expect(page.locator('#intakeSource')).toHaveValue('Asthma Lecture.pdf');
  await expect(page.locator('#intakePdf')).toHaveValue('');
  expect(await page.evaluate(()=>localStorage.getItem('medicalLibraryIntakeDraftV1'))).toBeNull();
});

test('B2 previously downloaded review-only intake can be reloaded without overwriting published lectures',async({page})=>{
  await page.goto('/#/manage');
  await page.locator('#intakeImportFile').setInputFiles({
    name:'saved-intake.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(intake))
  });
  await expect(page.locator('#intakeSummary')).toContainText('Source intake follow-up');
  await expect(page.locator('#intakeStatus')).toContainText('Review your draft');
  await expect(page.locator('#intakeSummary')).toContainText('Urology Chapter 5.pdf');
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.locator('#intakeSource')).toHaveValue('Urology Chapter 5.pdf');
  await expect(page.locator('#intakeTitle')).toHaveValue('Source intake follow-up');
  await expect(page.locator('#intakeId')).toHaveValue('surgery-urology-source-intake-follow-up');
  await expect(page.locator('#intakeTopics')).toHaveValue('Definitions\nالشرح من المحاضرة');
  await expect(page.getByRole('button',{name:/publish|approve/i})).toHaveCount(0);
});

test('B2 malformed or clinical-content intake file is rejected without replacing the current draft',async({page})=>{
  await page.goto('/#/manage');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.locator('#intakeTitle').fill('Existing unsaved title');
  const invalid={...intake,lecture:{...intake.lecture,cases:[{answer:'invented'}]}};
  await page.locator('#intakeImportFile').setInputFiles({
    name:'invalid-intake.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))
  });
  await expect(page.locator('#intakeError')).toContainText('Invalid intake');
  await expect(page.locator('#intakeTitle')).toHaveValue('Existing unsaved title');
});
