import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
test.use({serviceWorkers:'block'});

test('Manage Library can prepare a Chapter draft without editing the published registry',async({page},info)=>{
  await page.goto('/#/manage');
  const disclosure=page.getByRole('group',{name:'Manage library structure'});
  await expect(disclosure).toBeVisible();
  await disclosure.getByText('Add a Material, specialty or Chapter').click();
  await page.getByLabel('What would you like to add?').selectOption('chapter');
  await page.getByLabel('Choose material').selectOption('surgery');
  await page.getByLabel('Choose specialty').selectOption('urology');
  await page.getByLabel('New name').fill('Urologic Oncology');
  await expect(page.getByLabel('Stable structure ID')).toHaveValue('urologic-oncology');
  const fileEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download structure draft'}).click();
  const file=await fileEvent;const target=info.outputPath('chapter.json');await file.saveAs(target);
  const draft=JSON.parse(await readFile(target,'utf8'));
  expect(draft).toEqual({format:'medical-library-structure-intake',version:1,
    status:'needs-review',kind:'chapter',course:'surgery',subject:'urology',
    item:{id:'urologic-oncology',label:'Urologic Oncology'}});
  const output=execFileSync('python3',['tools/import_library_structure.py',target],{encoding:'utf8'});
  expect(output).toContain('Dry-run only');
  await expect(page.locator('#intakeCourse')).toHaveValue('surgery');
  expect(await page.evaluate(()=>globalThis.MEQCourseRegistry.packs.get('surgery')
     .subjects.find(x=>x.id==='urology').chapters||[])).toEqual([]);
});

test('Chapter draft rejects duplicate, malformed and cross-scope values without any download',async({page})=>{
  await page.goto('/#/manage');
  const disclosure=page.getByRole('group',{name:'Manage library structure'});
  await disclosure.getByText('Add a Material, specialty or Chapter').click();
  await page.getByLabel('New name').fill('Foundations');
  await page.getByLabel('Stable structure ID').fill('../wrong');
  await page.getByRole('button',{name:'Download structure draft'}).click();
  await expect(page.locator('#structureError')).toContainText('ID');
  await page.getByLabel('Stable structure ID').fill('foundations');
  await page.evaluate(()=>{
    globalThis.MEQCourseRegistry.packs.get('surgery').subjects.find(x=>x.id==='urology')
      .chapters=[{id:'foundations',label:'Foundations',order:1}];
  });
  await page.getByRole('button',{name:'Download structure draft'}).click();
  await expect(page.locator('#structureError')).toContainText('already exists');
});

test('Specialty draft works on mobile and offers no direct publish action',async({page},info)=>{
  await page.setViewportSize({width:320,height:740});
  await page.goto('/#/manage');
  const disclosure=page.getByRole('group',{name:'Manage library structure'});
  await disclosure.getByText('Add a Material, specialty or Chapter').click();
  await page.getByLabel('What would you like to add?').selectOption('specialty');
  await expect(page.getByLabel('Choose specialty')).toBeHidden();
  await page.getByLabel('New name').fill('Pediatrics');
  await expect(page.getByLabel('Stable structure ID')).toHaveValue('pediatrics');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  const ev=page.waitForEvent('download');await page.getByRole('button',{name:'Download structure draft'}).click();
  const download=await ev;const file=info.outputPath('specialty.json');await download.saveAs(file);
  const data=JSON.parse(await readFile(file,'utf8'));
  expect(data).toMatchObject({kind:'specialty',course:'surgery',item:{id:'pediatrics',label:'Pediatrics'}});
  expect(data.subject).toBeUndefined();
  await expect(page.getByRole('button',{name:/publish|approve/i})).toHaveCount(0);
});


test('New Material draft includes its first specialty without altering existing materials',async({page},info)=>{
  await page.goto('/#/manage');
  const group=page.getByRole('group',{name:'Manage library structure'});
  await group.getByText('Add a Material, specialty or Chapter').click();
  await page.getByLabel('What would you like to add?').selectOption('material');
  await expect(page.getByLabel('Choose material')).toBeHidden();
  await expect(page.getByLabel('Choose specialty')).toBeHidden();
  await page.getByLabel('New name').fill('Pediatrics');
  await expect(page.getByLabel('Stable structure ID')).toHaveValue('pediatrics');
  await page.getByLabel('First specialty name').fill('Neonatology');
  await expect(page.getByLabel('First specialty ID')).toHaveValue('neonatology');
  const ev=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download structure draft'}).click();
  const file=await ev;const target=info.outputPath('material.json');await file.saveAs(target);
  const data=JSON.parse(await readFile(target,'utf8'));
  expect(data).toEqual({format:'medical-library-structure-intake',version:1,
    status:'needs-review',kind:'material',item:{id:'pediatrics',label:'Pediatrics'},
    firstSubject:{id:'neonatology',label:'Neonatology'}});
  const output=execFileSync('python3',['tools/import_library_structure.py',target],{encoding:'utf8'});
  expect(output).toContain('Dry-run only');
  expect(await page.evaluate(()=>globalThis.MEQCourseRegistry.courses.length)).toBe(3);
});
