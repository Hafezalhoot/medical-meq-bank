import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

async function ready(page,width=1440,height=900){
  await page.setViewportSize({width,height});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
}

test('large specialties filter lecture titles locally without changing saved study selection',async ({page})=>{
  await ready(page);
  const wrap=page.locator('#lectureNavSearchWrap');
  const search=page.locator('#lectureNavSearch');
  await expect(wrap).toBeVisible();
  await expect(page.locator('#lectureNav .lecture-link[data-lecture-id]')).toHaveCount(8);
  await search.fill('bladder');
  const matches=page.locator('#lectureNav .lecture-link[data-lecture-id]');
  await expect(matches).toHaveCount(1);
  await expect(matches.first()).toContainText(/bladder/i);
  await expect(page.locator('#lectureNavResult')).toHaveText('1 of 8 lectures');
  const chosen=await matches.first().getAttribute('data-lecture-id');
  await matches.first().click();
  await expect(page.locator('#lectureFilter')).toHaveValue(chosen);
  await expect(search).toHaveValue('bladder');
  await search.focus();
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(page.locator('#lectureNav .lecture-link[data-lecture-id]')).toHaveCount(8);
  await expect(page.locator('#lectureFilter')).toHaveValue(chosen);
});

test('lecture-search empty state recovers and switching specialties clears stale search',async ({page})=>{
  await ready(page);
  const search=page.locator('#lectureNavSearch');
  await search.fill('no--matching--lecture--2026');
  await expect(page.locator('#lectureNav .lecture-link[data-lecture-id]')).toHaveCount(0);
  await expect(page.locator('#lectureNav .sidebar-empty')).toContainText('No lectures match this search.');
  await page.locator('.lecture-nav-clear').click();
  await expect(search).toHaveValue('');
  await expect(page.locator('#lectureNav .lecture-link[data-lecture-id]')).toHaveCount(8);
  await search.fill('bladder');
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await page.locator('#subjectSelector').selectOption('psychiatry');
  await expect(page.locator('#lectureNavSearchWrap')).toBeHidden();
  await page.locator('#courseSelector').selectOption('surgery');
  await expect(page.locator('#lectureNavSearchWrap')).toBeVisible();
  await expect(search).toHaveValue('');
  await expect(page.locator('#lectureNav .lecture-link[data-lecture-id]')).toHaveCount(8);
});

test('mobile can reveal the same lecture finder and search without horizontal overflow',async ({page})=>{
  await ready(page,390,844);
  const search=page.locator('#lectureNavSearch');
  const toggle=page.locator('#toggleLectures');
  if(!(await search.isVisible()))await toggle.click();
  await expect(search).toBeVisible();
  await search.fill('bladder');
  await expect(page.locator('#lectureNav .lecture-link[data-lecture-id]')).toHaveCount(1);
  await expect(page.locator('#lectureNavResult')).toContainText('1 of 8');
  const chosen=await page.locator('#lectureNav .lecture-link[data-lecture-id]').first().getAttribute('data-lecture-id');
  await page.locator('#lectureNav .lecture-link[data-lecture-id]').first().click();
  await expect(page.locator('#lectureFilter')).toHaveValue(chosen);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
