import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
test.use({serviceWorkers:'block'});

async function start(page, url='/#/manage') {
  await page.goto(url);
  await expect(page.getByRole('heading',{name:'Manage library',exact:true})).toBeVisible();
  await expect(page.getByLabel('Material / course')).toHaveValue('surgery');
}
async function lectureStep(page) {
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByLabel('Lecture title', {exact:true}).fill('Source intake test');
  await page.getByLabel('Source PDF filename', {exact:true}).fill('original-lecture.pdf');
}
async function reviewStep(page) {
  await lectureStep(page);
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByLabel('Topic headings').fill('Definitions\nالأسباب والتشخيص');
  await page.getByRole('button',{name:'Review draft',exact:true}).click();
}

test('dedicated authoring flow exports an importer-compatible empty draft without touching published content',async({page},testInfo)=>{
  await start(page);
  await expect(page.locator('.toolbar')).toBeHidden();
  await expect(page.locator('#mainLayout')).toBeHidden();
  await reviewStep(page);
  await expect(page.getByText('Needs source review',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/publish|approve/i})).toHaveCount(0);
  const downloadEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download intake file',exact:true}).click();
  const download=await downloadEvent;
  const file=testInfo.outputPath('intake.json');await download.saveAs(file);
  const intake=JSON.parse(await readFile(file,'utf8'));
  expect(intake.status).toBe('needs-source-review');
  expect(intake.lecture).toMatchObject({course:'surgery',subject:'urology',source:'original-lecture.pdf',order:9});
  expect(intake.lecture.topics).toEqual([{id:'topic-1',label:'Definitions'},{id:'topic-2',label:'الأسباب والتشخيص'}]);
  const directory=await mkdtemp(join(tmpdir(),'library-intake-'));
  try {
    const output=execFileSync('python3',['tools/import_library_draft.py',file,'--write','--output-dir',directory],{encoding:'utf8'});
    expect(output).toContain('unpublished draft');
    const draft=JSON.parse(await readFile(join(directory,intake.lecture.id+'.json'),'utf8'));
    expect(draft.subtopics).toEqual(intake.lecture.topics);
    for(const key of ['cases','coreShorts','imageQuestions','detailedShorts','rapid'])expect(draft[key]).toEqual([]);
    expect(draft.studyGuide).toBeUndefined();
  }finally{await rm(directory,{recursive:true,force:true});}
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:testInfo.outputPath('manage-review-desktop.png'),fullPage:true,animations:'disabled'});
});

test('validation blocks duplicate published titles, IDs, orders, malformed sources and repeated topics',async({page})=>{
  await start(page);await lectureStep(page);
  await page.getByLabel('Lecture title',{exact:true}).fill('  Bladder   Cancer  ');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('already published');
  await page.getByLabel('Lecture title',{exact:true}).fill('Unique source');
  await page.getByLabel('Stable lecture ID',{exact:true}).fill('urology-bladder-cancer');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('ID already');
  await page.getByLabel('Stable lecture ID',{exact:true}).fill('surgery-urology-broken--id');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('single hyphens');
  await page.getByLabel('Stable lecture ID',{exact:true}).fill('surgery-urology-unique-source');
  await page.getByLabel('Lecture order',{exact:true}).fill('1');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('order');
  await page.getByLabel('Lecture order',{exact:true}).fill('9');
  await page.getByLabel('Source PDF filename',{exact:true}).fill('../private.pdf');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('filename');
  await page.getByLabel('Source PDF filename',{exact:true}).fill('original.pdf');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByLabel('Topic headings').fill('Definition\n definition ');
  await page.getByRole('button',{name:'Review draft',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Duplicate topic');
});

test('scope changes reset Chapter and recompute lecture identity without switching the learner course',async({page})=>{
  await start(page);
  await page.evaluate(()=>{
    globalThis.MEQCourseRegistry.packs.get('surgery').subjects.find(x=>x.id==='urology').chapters=[{id:'basics',label:'Foundations',order:1}];
    document.dispatchEvent(new Event('meq:course-changed'));
  });
  await page.getByLabel('Chapter (optional)').selectOption('basics');
  await page.getByLabel('Material / course').selectOption('internal-medicine');
  await expect(page.getByLabel('Chapter (optional)')).toHaveValue('');
  await expect(page.getByRole('combobox',{name:'Specialty',exact:true})).toHaveValue('cardiology');
  await lectureStep(page);
  await expect(page.getByLabel('Lecture order',{exact:true})).toHaveValue('1');
  await expect(page.getByLabel('Stable lecture ID',{exact:true})).toHaveValue('internal-medicine-cardiology-source-intake-test');
  expect(await page.evaluate(()=>globalThis.MEQCourseRegistry.activeCourse)).toBe('surgery');
  await page.getByRole('link',{name:'Library',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Manage library',exact:true})).toBeHidden();
  await page.goBack();
  await expect(page.getByLabel('Lecture title',{exact:true})).toHaveValue('Source intake test');
});

test('mobile wizard uses one step, supports Arabic, dark mode and accessible controls',async({page},testInfo)=>{
  await page.setViewportSize({width:320,height:740});await start(page);
  await page.getByRole('button',{name:'Switch to dark mode'}).click();
  await reviewStep(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({page}).include('#libraryManager').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations).toEqual([]);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:testInfo.outputPath('manage-review-mobile-dark.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByLabel('Topic headings')).toBeFocused();
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  }
});

test('standalone offline file offers the same authoring export',async({page})=>{
  await start(page,'file://'+resolve('dist/offline/Medical_MEQ_Review_Bank_Offline.html')+'#/manage');
  await reviewStep(page);
  await expect(page.getByRole('button',{name:'Download intake file',exact:true})).toBeEnabled();
});

test('Study tools opens authoring and skip navigation retains the dedicated screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/library');
  await page.getByRole('button',{name:'Study tools',exact:true}).click();
  await page.getByRole('link',{name:'Manage library',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Manage library',exact:true})).toBeVisible();
  const skip=page.getByRole('link',{name:'Skip to library manager'});
  await skip.focus();await skip.press('Enter');
  await expect(page.getByRole('heading',{name:'Manage library',exact:true})).toBeFocused();
  await expect(page).toHaveURL(/#\/manage$/);
  await expect(page.getByRole('button',{name:'Study tools',exact:true})).toHaveAttribute('aria-expanded','false');
});

test('unfinished intake survives a same-tab reload without changing saved study progress',async({page})=>{
  await start(page);
  await lectureStep(page);
  await page.getByLabel('Lecture title',{exact:true}).fill('Recovered Arabic lecture');
  await page.getByLabel('Source PDF filename',{exact:true}).fill('original-recovered.pdf');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByLabel('Topic headings').fill('Definition\\nالتشخيص');
  await page.reload();
  await expect(page.getByLabel('Topic headings')).toHaveValue('Definition\\nالتشخيص');
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByLabel('Lecture title',{exact:true})).toHaveValue('Recovered Arabic lecture');
  await expect(page.getByLabel('Source PDF filename',{exact:true})).toHaveValue('original-recovered.pdf');
  await expect(page.getByLabel('Stable lecture ID',{exact:true})).toHaveValue('surgery-urology-recovered-arabic-lecture');
  await expect(page.getByText(/draft recovered/i)).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('medicalLibraryIntakeDraftV1'))).toBeNull();
});
