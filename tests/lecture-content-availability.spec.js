import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test.use({serviceWorkers:'block'});

const catalog=JSON.parse(readFileSync('lectures/catalog.json','utf8'));

test('C1 every published lecture declares a source-exact explanation count (never guesses from MCQs)',async()=>{
  expect(catalog.lectures).toHaveLength(12);
  let explained=0;
  for(const entry of catalog.lectures){
    const source=JSON.parse(readFileSync('lectures/'+entry.file,'utf8'));
    const realExplanation=source.studyGuide?.explanation?.length||0;
    const realMcq=source.studyGuide?.mcqs?.length||0;
    expect(entry.explanationCount,entry.id+' explanation metadata').toBe(realExplanation);
    expect(entry.mcqCount||0,entry.id+' authored MCQs').toBe(realMcq);
    if(realExplanation)explained++;
  }
  expect(explained).toBe(3);
});

test('C1 Library distinguishes missing reviewed Explanation/MCQs from source-backed cases and image practice',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/library',{waitUntil:'domcontentloaded'});
  const card=page.getByRole('button',{name:'Open lecture: Bladder Cancer'});
  await expect(card).toBeVisible({timeout:20000});
  await expect(card.locator('.lecture-overview-availability')).toContainText('No published explanation');
  await expect(card.locator('.lecture-overview-availability')).toContainText('No reviewed MCQs');
  await expect(card.locator('.lecture-overview-meta')).toContainText('12 MEQ cases');
  await expect(card.locator('.lecture-overview-meta')).toContainText('8 image questions');
  await expect(card.locator('.lecture-overview-meta')).not.toContainText('0 source MCQs');
  const description=await card.getAttribute('aria-describedby');
  expect(description).toBe('lecture-contents-urology-bladder-cancer');
  await expect(page.locator('#'+description)).toBeVisible();
  await card.click();
  await expect(page.getByRole('tab',{name:'MCQ practice'})).toHaveCount(0);
  await expect(page.getByRole('tab',{name:'Cases'})).toBeVisible();
});

test('C1 reviewed Dermatology lecture advertises actual explanation and source MCQ counts without losing practice',async({page})=>{
  await page.goto('/#/library',{waitUntil:'domcontentloaded'});
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await page.locator('#subjectSelector').selectOption('dermatology');
  const card=page.getByRole('button',{name:'Open lecture: Introduction to Dermatology'});
  await expect(card).toBeVisible({timeout:20000});
  await expect(card.locator('.lecture-overview-availability')).toContainText('11 explanation sections');
  await expect(card.locator('.lecture-overview-availability')).toContainText('30 reviewed MCQs');
  await expect(card.locator('.lecture-overview-availability')).not.toContainText('No published');
  await expect(card.locator('.lecture-overview-meta')).toContainText('16 MEQ cases');
  await expect(card.locator('.lecture-overview-meta')).toContainText('14 image questions');
  const desc=await card.getAttribute('aria-describedby');
  await expect(page.locator('#'+desc)).toBeVisible();
  await card.click();
  await expect(page.getByRole('tab',{name:'Explanation'})).toBeVisible();
  await expect(page.getByRole('tab',{name:'MCQ practice'})).toBeVisible();
});

test('C1 compact content badges stay readable at narrow width and without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.goto('/#/library',{waitUntil:'domcontentloaded'});
  const card=page.getByRole('button',{name:'Open lecture: Bladder Cancer'});
  await expect(card.locator('.lecture-overview-availability')).toBeVisible({timeout:20000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.evaluate(()=>{document.documentElement.style.zoom='200%'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
