import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test.use({serviceWorkers:'block'});

const id='internal-medicine-ii-dermatology-introduction';
const derm='/#/lecture/'+id+'?course=internal-medicine-ii&subject=dermatology&tab=mcqs';
const authored=JSON.parse(readFileSync('lectures/data/'+id+'.json','utf8')).studyGuide.mcqs;

for(const width of [320,390]){
  test('U2 focused MCQ Reader shows one question with native next, previous and browse-all at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:844});
    await page.goto(derm,{waitUntil:'domcontentloaded'});
    const questions=page.locator('#readerPane-mcqs .study-guide-mcq');
    await expect(questions).toHaveCount(30);
    await expect(page.locator('#readerTab-mcqs')).toHaveAttribute('aria-selected','true',{timeout:20000});
    await expect(page.locator('#readerPane-mcqs .study-guide-mcq:visible')).toHaveCount(1);
    await expect(page.locator('#readerTopicPosition')).toContainText('Question 1 of 30');
    await expect(page.getByRole('button',{name:'Previous question'})).toBeDisabled();
    await page.getByRole('button',{name:'Next question'}).click();
    await expect(page.locator('#readerPane-mcqs .study-guide-mcq:visible')).toHaveCount(1);
    await expect(questions.nth(1)).toBeVisible();
    await expect(questions.first()).toBeHidden();
    await expect(page).toHaveURL(/question=derm-mcq-002/);
    await expect(page.locator('#readerTopicPosition')).toContainText('Question 2 of 30');
    await page.getByRole('button',{name:'Browse all MCQs'}).click();
    await expect(page.locator('#readerPane-mcqs .study-guide-mcq:visible')).toHaveCount(30);
    await page.getByRole('button',{name:'Show one MCQ'}).click();
    await expect(page.locator('#readerPane-mcqs .study-guide-mcq:visible')).toHaveCount(1);
    await page.locator('#readerTopicSelect').selectOption({label:'Question 30 of 30'});
    await expect(questions.nth(29)).toBeVisible();
    await expect(page.getByRole('button',{name:'Next question'})).toBeDisabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });
}

test('U2 MCQ Reader restores selected authored question after reload and Library Continue without touching grades',async({page})=>{
  await page.goto(derm,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#readerTopicPosition')).toContainText('Question 1 of 30',{timeout:20000});
  const before=await page.evaluate(async()=>{await globalThis.MEQProgressStore.ready;return globalThis.MEQProgressStore.exportAll();});
  await page.getByRole('button',{name:'Next question'}).click();
  await expect.poll(async()=>page.evaluate(async()=>(await globalThis.MEQStudyPosition.read())?.questionId)).toBe(authored[1].id);
  expect(await page.evaluate(async()=>globalThis.MEQProgressStore.exportAll())).toEqual(before);
  await page.reload();
  await expect(page.locator('#readerTopicSelect')).toHaveValue('m-2');
  await expect(page.locator('#readerPane-mcqs .study-guide-mcq').nth(1)).toBeVisible();
  await page.goto('/#/library');
  const resume=page.getByRole('button',{name:/Continue Introduction to Dermatology/i});
  await expect(resume).toBeVisible({timeout:20000});
  await resume.click();
  await expect(page.locator('#readerTopicSelect')).toHaveValue('m-2');
  await expect(page.locator('#readerPane-mcqs .study-guide-mcq').nth(1)).toBeVisible();
  expect(await page.evaluate(async()=>globalThis.MEQProgressStore.exportAll())).toEqual(before);
});

test('U2 reveal feedback uses authored answer and does not auto-rate the question',async({page})=>{
  await page.goto(derm,{waitUntil:'domcontentloaded'});
  const current=page.locator('#readerPane-mcqs .study-guide-mcq:visible').first();
  await expect(current).toBeVisible({timeout:20000});
  const before=await page.evaluate(async()=>{await globalThis.MEQProgressStore.ready;return globalThis.MEQProgressStore.exportAll();});
  await current.locator('input[type=radio]').first().check();
  await current.getByRole('button',{name:'Reveal explanation'}).click();
  await expect(current.locator('.study-guide-answer')).toContainText('Correct answer: '+authored[0].options[authored[0].answerIndex]);
  expect(await page.evaluate(async()=>globalThis.MEQProgressStore.exportAll())).toEqual(before);
  await current.locator('button[data-status="review"]').click();
  const ratingKey='v2::internal-medicine-ii::dermatology::'+id+'::mcq::'+authored[0].id;
  await expect.poll(async()=>page.evaluate(async key=>(await globalThis.MEQProgressStore.exportAll())[key],ratingKey)).toBe('review');
});

test('U2 print includes every authored MCQ despite focused on-screen view',async({page})=>{
  await page.goto(derm,{waitUntil:'domcontentloaded'});
  const questions=page.locator('#readerPane-mcqs .study-guide-mcq');
  await expect(page.locator('#readerPane-mcqs .study-guide-mcq:visible')).toHaveCount(1,{timeout:20000});
  await page.emulateMedia({media:'print'});
  await expect(page.locator('#readerPane-mcqs .study-guide-mcq:visible')).toHaveCount(30);
});

test('U2 unavailable MCQ modes are never invented for Urology source-only cases',async({page})=>{
  await page.goto('/#/lecture/urology-bladder-cancer?course=surgery&subject=urology',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#readerModeTabs')).toBeVisible({timeout:20000});
  await expect(page.getByRole('tab',{name:'MCQ practice'})).toHaveCount(0);
  await expect(page.getByRole('tab',{name:'Cases'})).toBeVisible();
});
