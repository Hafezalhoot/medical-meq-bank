import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
test.use({serviceWorkers:'block'});
const derm='internal-medicine-ii-dermatology-introduction';
const urology='urology-bladder-cancer';

for(const route of ['/','/#/home','/#/not-a-real-view']){
  test('R01 default entry is Library, not the legacy stacked screen: '+route,async({page},testInfo)=>{
    await page.goto(route);
    await expect(page.locator('body')).toHaveAttribute('data-workspace','library');
    await expect(page.locator('.hero')).toBeHidden();
    await expect(page.locator('.toolbar')).toBeHidden();
    await expect(page.locator('.lecture-overview-panel')).toBeVisible();
    await expect(page.getByRole('navigation',{name:'Primary workspace'}).getByRole('link',{name:'Library',exact:true})).toHaveAttribute('aria-current','page');
    expect(await page.evaluate(()=>location.hash)).toMatch(/^#\/library(?:\?|$)/);
    if(route==='/')await page.screenshot({path:testInfo.outputPath('library-default-desktop.png'),fullPage:true});
  });
}

test('R01 a bare lecture deep link resolves its catalog scope rather than saved Surgery defaults',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('medicalBankCourseV1','surgery'));
  await page.goto('/#/lecture/'+derm);
  await expect(page.locator('#lecture-'+derm)).toBeVisible({timeout:20000});
  await expect(page.locator('#courseSelector')).toHaveValue('internal-medicine-ii');
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
  expect(await page.evaluate(()=>globalThis.MEQStudyContext.get())).toMatchObject({schemaVersion:1,view:'lecture',courseId:'internal-medicine-ii',subjectId:'dermatology',lectureId:derm});
});

test('R01 an invalid explicit lecture/course pair recovers with a visible explanation',async({page})=>{
  await page.goto('/#/lecture/'+derm+'?course=surgery&subject=urology');
  await expect(page.locator('body')).toHaveAttribute('data-workspace','library');
  await expect(page.locator('#workspaceNavigationNotice')).toBeVisible();
  await expect(page.getByRole('button',{name:'Open lecture: Bladder Cancer',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Open lecture: Bladder Cancer',exact:true}).click();
  await expect(page.locator('#lecture-'+urology)).toBeVisible();
  await expect(page.locator('#workspaceNavigationNotice')).toBeHidden();
});

test('R01 back and forward restore the explicit course/specialty instead of the last hidden selection',async({page})=>{
  await page.goto('/#/library?course=surgery&subject=urology');
  await expect(page.getByRole('button',{name:'Open lecture: Bladder Cancer',exact:true})).toBeVisible();
  await page.evaluate(id=>{location.hash='#/lecture/'+id+'?course=internal-medicine-ii&subject=dermatology';},derm);
  await expect(page.locator('#lecture-'+derm)).toBeVisible();
  await page.goBack();
  await expect(page.locator('#courseSelector')).toHaveValue('surgery');
  await expect(page.locator('#subjectSelector')).toHaveValue('urology');
  await expect(page.getByRole('button',{name:'Open lecture: Bladder Cancer',exact:true})).toBeVisible();
  await page.goForward();
  await expect(page.locator('#courseSelector')).toHaveValue('internal-medicine-ii');
  await expect(page.locator('#lecture-'+derm)).toBeVisible();
});

test('R01 legacy lecture anchors open the same lecture without exposing the stacked root page',async({page})=>{
  await page.goto('/#lecture-'+urology);
  await expect(page.locator('body')).toHaveAttribute('data-workspace','lecture');
  await expect(page.locator('#lecture-'+urology)).toBeVisible();
});

test('R01 standalone root opens Library and restores a cross-course reader without a network loader',async({page})=>{
  const url=pathToFileURL(resolve('dist/offline/Medical_MEQ_Review_Bank_Offline.html')).href;
  await page.goto(url);
  await expect(page.locator('body')).toHaveAttribute('data-workspace','library');
  await page.evaluate(id=>{location.hash='#/lecture/'+id;},derm);
  await expect(page.locator('#lecture-'+derm)).toBeVisible();
  expect(await page.evaluate(()=>Boolean(globalThis.MEQLectureLoader))).toBe(false);
});

test('R01 late responses from the previous course do not replace the newer reader',async({page})=>{
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  let seen;
  const started=new Promise(resolve=>{seen=resolve;});
  await page.route('**/lectures/data/urology-bladder-cancer.json',async route=>{
    seen();await gate;await route.continue();
  });
  await page.goto('/#/lecture/'+urology+'?course=surgery&subject=urology');
  await started;
  await page.evaluate(id=>{location.hash='#/lecture/'+id+'?course=internal-medicine-ii&subject=dermatology';},derm);
  await expect(page.locator('#lecture-'+derm)).toBeVisible();
  const response=page.waitForResponse(response=>response.url().includes('/lectures/data/urology-bladder-cancer.json'));
  release();await response;
  await expect(page.locator('#lecture-'+derm)).toBeVisible();
  await expect(page.locator('#courseSelector')).toHaveValue('internal-medicine-ii');
  await expect(page.locator('#lectureFilter')).toHaveValue(derm);
});

for(const width of [320,390,768,1440]){
  test('R01 default Library fits at '+width+'px without duplicate Home navigation',async({page},testInfo)=>{
    await page.setViewportSize({width,height:width<500?844:900});
    await page.goto('/');
    await expect(page.locator('.lecture-overview-panel')).toBeVisible();
    const nav=page.getByRole('navigation',{name:'Primary workspace'});
    await expect(nav.getByRole('link',{name:'Home',exact:true})).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    if(width===390)await page.screenshot({path:testInfo.outputPath('library-default-mobile.png'),fullPage:true});
  });
}
