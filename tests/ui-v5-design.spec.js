import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

async function ready(page,width=1440,height=900){
  await page.setViewportSize({width,height});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
  await expect(page.locator('.studio-masthead')).toBeVisible();
}

test('V5 replaces corporate teal with a calm mineral-blue study system',async({page},info)=>{
  await ready(page);
  await expect(page.getByRole('heading',{name:'Medical MEQ Review Bank'})).toBeVisible();
  await expect(page.locator('.studio-wordmark')).toHaveText(/MEQ Studio/);
  await expect(page.locator('#pwaToolsToggle')).toBeVisible();
  await expect(page.locator('#darkBtn')).toBeVisible();
  await expect(page.locator('#resumeStudyBtn')).toBeVisible();
  await expect(page.locator('#examModeBtn')).toBeVisible();
  const v=await page.evaluate(()=>{
    const root=getComputedStyle(document.body);
    const hero=document.querySelector('.hero');
    const masthead=document.querySelector('.studio-masthead');
    return {
      bg:root.backgroundColor,
      accent:root.getPropertyValue('--brand').trim(),
      heading:getComputedStyle(hero.querySelector('h1')).color,
      heroBackground:getComputedStyle(hero).backgroundImage,
      heroY:hero.getBoundingClientRect().top,
      mastheadBottom:masthead.getBoundingClientRect().bottom,
      headerHeight:masthead.getBoundingClientRect().height,
      overflow:document.documentElement.scrollWidth-innerWidth
    };
  });
  expect(v.bg).toBe('rgb(245, 247, 252)');
  expect(v.accent.toLowerCase()).toBe('#4f63a8');
  expect(v.heading).toBe('rgb(36, 48, 75)');
  expect(v.heroBackground).toContain('linear-gradient');
  expect(v.heroY).toBeGreaterThan(v.mastheadBottom);
  expect(v.headerHeight).toBeLessThanOrEqual(88);
  expect(v.overflow).toBeLessThanOrEqual(1);
  await info.attach('v5-desktop-mineral-blue.png',{
    body:await page.screenshot(),contentType:'image/png'
  });
});

test('V5 top-bar Study tools retains backup, restore and Escape focus',async({page})=>{
  await ready(page);
  const tools=page.locator('#pwaToolsToggle');
  await expect(page.locator('#exportProgressBtn')).toBeHidden();
  await tools.click();
  await expect(tools).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#exportProgressBtn')).toBeVisible();
  await expect(page.locator('#importProgressBtn')).toBeVisible();
  await page.locator('#exportProgressBtn').focus();
  await page.keyboard.press('Escape');
  await expect(tools).toBeFocused();
  await expect(tools).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#exportProgressBtn')).toBeHidden();
});

test('V5 medical source reader follows the new shell without touching source content',async({page},info)=>{
  await ready(page,1280,900);
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await page.locator('#subjectSelector').selectOption('psychiatry');
  await page.locator('#lectureFilter').selectOption('internal-medicine-ii-psychiatry-anxiety-disorders');
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
  await expect(page.locator('.lecture-title')).toContainText('Anxiety Disorders');
  await expect(page.locator('.learning-companion')).toBeAttached();
  await expect(page.locator('.study-guide-part')).not.toHaveCount(0);
  const tokens=await page.evaluate(()=>{
    const heading=document.querySelector('.lecture-title');
    const explanation=document.querySelector('.study-guide-explanation p');
    const s=getComputedStyle(explanation);
    return {
      h:getComputedStyle(heading).fontSize,
      p:parseFloat(s.fontSize),
      line:parseFloat(s.lineHeight),
      bg:getComputedStyle(document.body).backgroundColor
    };
  });
  expect(parseFloat(tokens.h)).toBeGreaterThanOrEqual(26);
  expect(tokens.p).toBeGreaterThanOrEqual(16);
  expect(tokens.line).toBeGreaterThanOrEqual(30);
  expect(tokens.bg).toBe('rgb(245, 247, 252)');
  await info.attach('v5-anxiety-reader.png',{body:await page.screenshot(),contentType:'image/png'});
});

for(const width of [320,390,768,1024,1440]){
  test('V5 '+width+'px layout keeps actual student actions within the screen',async({page},info)=>{
    await ready(page,width,820);
    const controls=await page.evaluate(()=>{
      const ids=['darkBtn','pwaToolsToggle','courseSelector','subjectSelector','resumeStudyBtn','examModeBtn'];
      return {
        scroll:document.documentElement.scrollWidth-innerWidth,
        items:ids.map(id=>{
          const el=document.getElementById(id);
          const rect=el.getBoundingClientRect();
          return {id,left:rect.left,right:rect.right,height:rect.height}
        })
      };
    });
    expect(controls.scroll).toBeLessThanOrEqual(1);
    for(const r of controls.items){
      expect(r.left,r.id).toBeGreaterThanOrEqual(-1);
      expect(r.right,r.id).toBeLessThanOrEqual(width+1);
      expect(r.height,r.id).toBeGreaterThanOrEqual(43);
    }
    await expect(page.locator('#resumeStudyBtn')).toBeEnabled();
    if(width===320 || width===1440)await info.attach('v5-'+width+'px.png',{
      body:await page.screenshot(),contentType:'image/png'
    });
  });
}

test('V5 dark theme uses ink surfaces and comfortable controls at 390px',async({page},info)=>{
  await ready(page,390,844);
  await page.locator('#darkBtn').click();
  await expect(page.locator('body')).toHaveClass(/dark/);
  const colors=await page.evaluate(()=>{
    const body=getComputedStyle(document.body);
    const h=getComputedStyle(document.querySelector('.hero h1'));
    const title=document.querySelector('.studio-wordmark strong');
    return {
      background:body.backgroundColor,brand:body.getPropertyValue('--brand').trim(),
      heading:h.color,wordmark:getComputedStyle(title).color,
      overflow:document.documentElement.scrollWidth-innerWidth
    };
  });
  expect(colors.background).toBe('rgb(18, 24, 40)');
  expect(colors.brand.toLowerCase()).toBe('#aabbff');
  expect(colors.overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('#courseSelector')).toBeVisible();
  await expect(page.locator('#subjectSelector')).toBeVisible();
  await info.attach('v5-phone-dark.png',{body:await page.screenshot(),contentType:'image/png'});
});

test('V5 retains meaningful focus-mode reading and restores the full shell',async({page})=>{
  await ready(page,1440,900);
  await page.locator('#focusModeBtn').click();
  await expect(page.locator('.hero')).toBeHidden();
  await expect(page.locator('.studio-masthead')).toBeHidden();
  await expect(page.locator('#mainContent')).toBeVisible();
  await page.locator('#focusModeBtn').click();
  await expect(page.locator('.studio-masthead')).toBeVisible();
  await expect(page.locator('.hero')).toBeVisible();
});


test('V5 desktop selected lecture uses the real reading column, never a phantom third grid track',async({page})=>{
  await ready(page,1440,900);
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await page.locator('#subjectSelector').selectOption('dermatology');
  await page.locator('#lectureFilter').selectOption('internal-medicine-ii-dermatology-introduction');
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
  const boxes=await page.evaluate(()=>{
    const nav=document.querySelector('.study-navigation-column').getBoundingClientRect();
    const main=document.querySelector('#mainContent').getBoundingClientRect();
    const card=document.querySelector('.lecture-head').getBoundingClientRect();
    return {
      navRight:nav.right,mainLeft:main.left,mainWidth:main.width,
      cardWidth:card.width,appWidth:document.querySelector('.app').getBoundingClientRect().width,
      overflow:document.documentElement.scrollWidth-innerWidth
    };
  });
  expect(boxes.mainWidth).toBeGreaterThanOrEqual(780);
  expect(boxes.cardWidth).toBeGreaterThanOrEqual(700);
  expect(boxes.mainLeft).toBeGreaterThanOrEqual(boxes.navRight);
  expect(boxes.overflow).toBeLessThanOrEqual(1);
});
