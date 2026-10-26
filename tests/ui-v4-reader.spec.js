import {test, expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

async function openBank(page,width=390,height=844){
  await page.setViewportSize({width,height});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
}

async function selectPsychiatry(page){
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await page.locator('#subjectSelector').selectOption('psychiatry');
  const drawer=page.locator('#mobileFiltersToggle');
  if(await drawer.isVisible())await drawer.click();
  await page.locator('#lectureFilter').selectOption('internal-medicine-ii-psychiatry-anxiety-disorders');
  const backdrop=page.locator('#mobileFilterBackdrop');
  if(await backdrop.isVisible())await page.locator('#applyMobileFiltersBtn').click();
  await expect(backdrop).toBeHidden();
  await expect(page.locator('.original-atlas-item')).toHaveCount(7,{timeout:20000});
}

async function showAtlas(page){
  const atlas=page.locator('.original-atlas-grid');
  if(!(await atlas.isVisible())){
    const summary=page.locator('.learning-companion .study-guide-part').nth(2).locator('summary');
    await summary.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    await summary.click();
  }
  await expect(atlas).toBeVisible();
  return atlas;
}

test('V4 first screen preserves study routes and gives a primary question action on phone',async ({page})=>{
  await openBank(page,390,844);
  await expect(page.locator('#courseSelector')).toBeVisible();
  await expect(page.locator('#subjectSelector')).toBeVisible();
  const primary=page.locator('#resumeStudyBtn');
  await expect(primary).toBeVisible();
  await expect(primary).toHaveCSS('background-color','rgb(79, 99, 168)');
  const hero=await page.locator('.hero').boundingBox();
  expect(hero.height).toBeLessThan(360);
  await primary.click();
  await expect.poll(()=>page.evaluate(()=>document.activeElement?.classList.contains('study-item')))
    .toBe(true);
  await expect.poll(()=>page.evaluate(()=>{
    const r=document.activeElement.getBoundingClientRect();
    return r.top>=0&&r.top<innerHeight;
  }),{timeout:8000}).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('V4 dark navigation labels meet normal-text contrast also when inactive',async ({page})=>{
  await openBank(page);
  await page.locator('#darkBtn').click();
  const nav=page.locator('#toggleLectures');
  if(await nav.getAttribute('aria-pressed')==='true')await nav.click();
  await expect(nav).toHaveAttribute('aria-pressed','false');
  await expect(nav).not.toHaveClass(/\bactive\b/);
  const colors=await nav.evaluate(el=>{
    const style=getComputedStyle(el);
    function channels(value){return (value.match(/[\d.]+/g)||[]).slice(0,3).map(Number);}
    function luminance(rgb){
      return rgb.map(x=>x/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4)
        .reduce((sum,x,i)=>sum+x*[0.2126,0.7152,0.0722][i],0);
    }
    const [a,b]=[luminance(channels(style.color)),luminance(channels(style.backgroundColor))].sort((x,y)=>y-x);
    return {ratio:(a+0.05)/(b+0.05),color:style.color,background:style.backgroundColor};
  });
  expect(colors.ratio,JSON.stringify(colors)).toBeGreaterThanOrEqual(4.5);
});

test('V4 original Anxiety table opens a keyboard-accessible zoom reader',async ({page},testInfo)=>{
  await openBank(page,1440,900);
  await selectPsychiatry(page);
  const atlas=await showAtlas(page);
  await expect(atlas.locator('.original-atlas-item')).toHaveCount(7);
  await atlas.locator('.source-figure-full').first().click();
  const viewer=page.locator('#sourceFigureViewer');
  await expect(viewer).toBeVisible();
  await testInfo.attach('v4-original-source-reader-desktop',{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
  await expect(viewer.locator('img')).toHaveAttribute('src',/assets\/lectures\/psychiatry-anxiety\/.+\.jpg/);
  await expect.poll(()=>viewer.locator('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(100);
  await viewer.locator('[data-source-in]').click();
  await expect(viewer.locator('img')).toHaveCSS('width',/^\d+px$/);
  await expect(viewer.locator('.source-viewer-zoom output')).toHaveText('150%');
  await viewer.locator('[data-source-fit]').click();
  await expect(viewer.locator('.source-viewer-zoom output')).toHaveText('100%');
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();

  await atlas.locator('.source-figure-full').first().click();
  await viewer.locator('[data-source-questions]').click();
  await expect(viewer).toBeHidden();
  await expect(page.locator('.image-card').first()).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.activeElement?.classList.contains('image-card')))
    .toBe(true);
});

test('V4 source viewer is readable and escapable on a narrow phone',async ({page},testInfo)=>{
  await openBank(page,390,844);
  await selectPsychiatry(page);
  const atlas=await showAtlas(page);
  await expect(atlas.locator('.original-atlas-item')).toHaveCount(7);
  await atlas.locator('.source-figure-full').first().click();
  const viewer=page.locator('#sourceFigureViewer');
  await expect(viewer).toBeVisible();
  await testInfo.attach('v4-original-source-reader-phone',{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
  const rect=await viewer.boundingBox();
  expect(rect.width).toBeLessThanOrEqual(390);
  expect(rect.height).toBeLessThanOrEqual(844);
  await viewer.locator('[data-source-in]').click();
  await expect(viewer.locator('.source-viewer-zoom output')).toHaveText('150%');
  await viewer.locator('[data-source-close]').click();
  await expect(viewer).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('V4 mixed Arabic prose retains correct RTL reading even when a medical term is first',async ({page})=>{
  await openBank(page,390,844);
  await selectPsychiatry(page);
  const explanation=page.locator('.learning-companion .study-guide-part').first();
  await explanation.locator('summary').click();
  const paragraph=explanation.locator('.study-guide-explanation p').filter({hasText:/^Fear في المحاضرة/}).first();
  await expect(paragraph).toBeVisible();
  await expect(paragraph).toHaveAttribute('dir','rtl');
  await expect(paragraph).toHaveAttribute('lang','ar');
  const reading=await paragraph.evaluate(el=>{
    const s=getComputedStyle(el);
    return {direction:s.direction,align:s.textAlign,size:parseFloat(s.fontSize),lineHeight:parseFloat(s.lineHeight)};
  });
  expect(reading.direction).toBe('rtl');
  expect(reading.align).toBe('right');
  expect(reading.size).toBeGreaterThanOrEqual(16);
  expect(reading.lineHeight).toBeGreaterThanOrEqual(30);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('V4 original source captions are legible on the smallest supported phone',async ({page})=>{
  await openBank(page,320,720);
  await selectPsychiatry(page);
  const atlas=await showAtlas(page);
  for(const label of [
    atlas.locator('.source-figure-caption').first(),
    atlas.locator('.original-atlas-item>figcaption strong').first(),
    atlas.locator('.original-atlas-item>figcaption small').first()
  ]){
    await expect(label).toBeVisible();
    expect(await label.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(13.5);
  }
  await page.locator('#darkBtn').click();
  await expect(atlas.locator('.original-atlas-item')).toHaveCount(7);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('V4 reader opens source-verified private blob figure in the same zoom dialog',async ({page})=>{
  await openBank(page,390,844);
  await selectPsychiatry(page);
  const atlas=await showAtlas(page);
  const link=atlas.locator('.source-figure-full').first();
  const blobUrl=await link.evaluate(async el=>{
    const bytes=await (await fetch(el.href)).blob();
    const url=URL.createObjectURL(bytes);
    el.href=url;
    return url;
  });
  await link.click();
  const viewer=page.locator('#sourceFigureViewer');
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('img')).toHaveAttribute('src',/^blob:/);
  await expect.poll(()=>viewer.locator('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(100);
  await viewer.locator('[data-source-in]').click();
  await expect(viewer.locator('.source-viewer-zoom output')).toHaveText('150%');
  await viewer.locator('[data-source-close]').click();
  await expect(viewer).toBeHidden();
  await page.evaluate(url=>URL.revokeObjectURL(url),blobUrl);
});

test('V4 resume reaches real source MCQs and preserves filtered short-question navigation',async ({page})=>{
  await openBank(page,390,844);
  await selectPsychiatry(page);
  await expect(page.locator('.lecture-counts')).toContainText('56 source MCQs');
  await page.locator('#resumeStudyBtn').click();
  await expect.poll(()=>page.evaluate(()=>document.activeElement?.classList.contains('study-guide-mcq'))).toBe(true);
  await expect(page.locator('.learning-companion .study-guide-part').nth(1)).toHaveAttribute('open','');
  const mcq=page.locator('.study-guide-mcq').first();
  await expect(mcq).toBeVisible();
  await page.locator('#mobileFiltersToggle').click();
  await page.locator('#typeFilter').selectOption('core');
  await page.locator('#applyMobileFiltersBtn').click();
  await page.locator('#resumeStudyBtn').click();
  await expect.poll(()=>page.evaluate(()=>document.activeElement?.dataset.type)).toBe('core');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
