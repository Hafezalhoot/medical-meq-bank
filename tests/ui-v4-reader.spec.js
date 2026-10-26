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
  if(await drawer.isVisible())await page.locator('#closeMobileFiltersBtn').click();
  await expect(page.locator('.original-atlas-item')).toHaveCount(7,{timeout:20000});
}

async function showAtlas(page){
  const atlas=page.locator('.original-atlas-grid');
  if(!(await atlas.isVisible())){
    await page.locator('.learning-companion summary')
      .filter({hasText:'Original lecture figures'}).click();
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
  await expect(primary).toHaveCSS('background-color','rgb(13, 98, 103)');
  const hero=await page.locator('.hero').boundingBox();
  expect(hero.height).toBeLessThan(360);
  await primary.click();
  await expect.poll(()=>page.evaluate(()=>document.activeElement?.classList.contains('study-item')))
    .toBe(true);
  const target=await page.evaluate(()=>{
    const r=document.activeElement.getBoundingClientRect();
    return {top:r.top,bottom:r.bottom,viewport:innerHeight};
  });
  expect(target.top).toBeGreaterThanOrEqual(0);
  expect(target.top).toBeLessThan(target.viewport);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('V4 dark navigation labels meet normal-text contrast also when inactive',async ({page})=>{
  await openBank(page);
  await page.locator('#darkBtn').click();
  await page.locator('#toggleLectures').click();
  const colors=await page.locator('#toggleLectures').evaluate(el=>{
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
  await expect(page.locator('#toggleLectures')).not.toHaveClass(/active/);
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
