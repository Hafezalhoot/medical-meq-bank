import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

const urologyLecture = 'urology-bladder-cancer';
const lectureUrl = '/#/lecture/'+urologyLecture+'?course=surgery&subject=urology';

test('home and library are distinct, keyboard accessible workspace views', async ({page}) => {
  await page.goto('/#/home', {waitUntil:'domcontentloaded'});
  const nav = page.getByRole('navigation', {name:'Primary workspace'});
  await expect(nav.getByRole('link', {name:'Home'})).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'home');
  await expect(page.locator('.hero')).toBeVisible();
  await expect(page.locator('#mainLayout')).toBeHidden();

  await nav.getByRole('link', {name:'Library'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'library');
  await expect(page.locator('#courseLibraryDisclosure')).toHaveAttribute('open', '');
  await expect(page.locator('#mainLayout')).toBeVisible();
  await expect(page.locator('.toolbar')).toBeHidden();
  await expect(page.locator('#lectureFilter')).toHaveValue('all', {timeout:15000});
  await expect(page.locator('.lecture-overview-panel')).toBeVisible({timeout:15000});
  await expect(nav.getByRole('link', {name:'Library'})).toHaveAttribute('aria-current', 'page');
  await page.goBack();
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'home');
  await page.goForward();
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'library');
});

test('selecting a lecture from the library opens a focused deep-linkable reader', async ({page}) => {
  await page.goto('/#/library', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#courseSelector')).toBeVisible();
  await expect(page.locator('.lecture-overview-panel')).toBeVisible({timeout:20000});
  await page.getByRole('button', {name:'Open lecture: Bladder Cancer'}).click();
  await expect(page).toHaveURL(/#\/lecture\/urology-bladder-cancer\?/);
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'lecture');
  await expect(page.locator('.hero')).toBeHidden();
  await expect(page.locator('#myReviewDisclosure')).toBeHidden();
  await expect(page.locator('.toolbar')).toBeHidden();
  await expect(page.locator('#lectureFilter')).toHaveValue(urologyLecture);
  await expect(page.locator('#lecture-'+urologyLecture+' .lecture-title')).toBeVisible({timeout:20000});
  const top = await page.locator('.lecture-title').first().evaluate(el=>el.getBoundingClientRect().top);
  expect(top).toBeLessThan(780);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'lecture');
  await expect(page.locator('#lecture-'+urologyLecture)).toBeVisible({timeout:20000});
  await page.goBack();
  await expect(page.locator('body')).toHaveAttribute('data-workspace','library');
});

test('review, practice and exams each expose only their task surface', async ({page}) => {
  await page.goto('/#/review', {waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveAttribute('data-workspace','review');
  await expect(page.locator('#myReviewDisclosure')).toHaveAttribute('open','');
  await expect(page.locator('.hero')).toBeHidden();
  await expect(page.locator('#mainLayout')).toBeHidden();

  await page.getByRole('navigation',{name:'Primary workspace'}).getByRole('link',{name:'Practice'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-workspace','practice');
  await expect(page.locator('#mainContent')).toBeVisible();
  await expect(page.locator('.toolbar')).toBeVisible();
  await expect(page.locator('.hero')).toBeHidden();

  await page.getByRole('navigation',{name:'Primary workspace'}).getByRole('link',{name:'Exams'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-workspace','exams');
  await expect(page.locator('#workspaceExamEntry')).toBeVisible();
  await page.locator('#workspaceExamStart').click();
  await expect(page.locator('#examDialog')).toBeVisible();
});

test('focused reader deep link remains source-scoped, progress and PWA controls intact', async ({page}) => {
  await page.goto(lectureUrl,{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveAttribute('data-workspace','lecture',{timeout:20000});
  await expect(page.locator('#lectureFilter')).toHaveValue(urologyLecture,{timeout:20000});
  await expect(page.locator('#lecture-'+urologyLecture+' .lecture-title')).toBeVisible({timeout:20000});
  await expect(page.locator('#exportProgressBtn')).toBeAttached();
  await expect(page.locator('#importProgressBtn')).toBeAttached();
  const screenshot = await page.evaluate(() => ({
    layoutOverflow: document.documentElement.scrollWidth-innerWidth,
    currentLocation: location.hash
  }));
  expect(screenshot.layoutOverflow).toBeLessThanOrEqual(1);
  expect(screenshot.currentLocation).toContain(urologyLecture);
});

for (const width of [320,390,768,1440]) {
  test('workspace navigation has no overflow at '+width+'px', async ({page}) => {
    await page.setViewportSize({width,height:width<500?844:900});
    await page.goto('/#/library',{waitUntil:'domcontentloaded'});
    const nav=page.getByRole('navigation',{name:'Primary workspace'});
    await expect(nav).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const links=nav.getByRole('link');
    expect(await links.count()).toBe(5);
    for(let i=0;i<await links.count();i++){
      const box=await links.nth(i).boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test('unknown workspace hashes fall back safely to home rather than rendering empty pages', async ({page}) => {
  await page.goto('/#/non-existent',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveAttribute('data-workspace','home');
  await expect(page.locator('.hero')).toBeVisible();
});