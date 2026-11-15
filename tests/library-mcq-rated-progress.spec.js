import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test.use({serviceWorkers:'block'});

const lecture=JSON.parse(readFileSync('lectures/data/internal-medicine-ii-dermatology-introduction.json','utf8'));
const prefix='v2::internal-medicine-ii::dermatology::'+lecture.id+'::mcq::';

test('D2 Library lecture rating percentage includes genuine authored MCQ ratings',async({page})=>{
  await page.goto('/#/library',{waitUntil:'domcontentloaded'});
  const ratings=Object.fromEntries(lecture.studyGuide.mcqs.slice(0,6).map(mcq=>[prefix+mcq.id,'review']));
  expect(Object.keys(ratings)).toHaveLength(6);
  await page.evaluate(async value=>{
    await globalThis.MEQProgressStore.ready;
    await globalThis.MEQProgressStore.replaceAll(value);
    localStorage.setItem('medicalBankStatusV2',JSON.stringify(value));
  },ratings);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await page.locator('#subjectSelector').selectOption('dermatology');
  const card=page.getByRole('button',{name:'Open lecture: Introduction to Dermatology'});
  await expect(card).toBeVisible({timeout:20000});
  const written=Object.values(lecture).filter(Array.isArray);
  expect(written.length).toBeGreaterThanOrEqual(1);
  const total=['cases','coreShorts','imageQuestions','detailedShorts'].reduce((n,key)=>n+lecture[key].length,0)+lecture.studyGuide.mcqs.length;
  const expected=Math.round(600/total)+'%';
  await expect(card).toContainText(expected+' rated');
  expect(await page.evaluate(async()=>globalThis.MEQProgressStore.exportAll())).toEqual(ratings);
});
