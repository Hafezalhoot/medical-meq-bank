import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test.use({serviceWorkers:'block'});
const id='urology-bladder-cancer';
const companion=JSON.parse(readFileSync('lectures/companions/urology-bladder-cancer.json','utf8'));

test('Bladder Cancer source MCQs have unique keys and direct printed lecture page references',()=>{
  expect(companion.lectureId).toBe(id);
  const rows=companion.studyGuide.mcqs;
  expect(rows).toHaveLength(31);
  expect(new Set(rows.map(q=>q.id)).size).toBe(31);
  for(const q of rows){
    expect(q.id).toMatch(/^bc-mcq-\d{3}$/);
    expect(q.options).toHaveLength(4);
    expect(new Set(q.options).size).toBe(4);
    expect(q.answerIndex).toBeGreaterThanOrEqual(0);
    expect(q.answerIndex).toBeLessThan(4);
    expect(q.sourcePage).toMatch(/^Bladder cancer 4\(1\)\.pdf p\. (?:[1-9]|1\d|2[0-4])$/);
    expect(q.rationale.length).toBeGreaterThan(25);
  }
});

test('Bladder Cancer MCQs load with original five source formats intact, and wrong answer becomes Weak',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#courseSelector')).toBeVisible();
  await page.locator('#courseSelector').selectOption('surgery');
  await expect(page.locator('#subjectSelector')).toHaveValue('urology');
  await expect(page.locator('#lectureFilter option[value="'+id+'"]')).toHaveCount(1);
  await page.locator('#lectureFilter').selectOption(id);
  await expect(page.locator('#lecture-'+id)).toBeVisible();
  const info=await page.evaluate(id=>{
    const item=lectures.find(l=>l.id===id);
    return {
      legacy:[item.cases.length,item.coreShorts.length,item.imageQuestions.length,
              item.detailedShorts.length,item.rapid.length],
      mcqs:item.studyGuide?.mcqs.length,
      source:item.studyGuide?.mcqs.every(q=>q.sourcePage.includes('.pdf p.')),
    };
  },id);
  expect(info).toEqual({legacy:[12,30,8,59,34],mcqs:31,source:true});
  await page.locator('#examModeBtn').click();
  await page.locator('#examScope').selectOption('lecture');
  await page.locator('#examFormat').selectOption('mcq');
  await page.locator('#examBegin').click();
  await expect(page.locator('#examQuestionHeading')).toBeVisible();
  const question=await page.locator('#examQuestionHeading').textContent();
  const mcq=companion.studyGuide.mcqs.find(q=>q.question===question);
  expect(mcq).toBeTruthy();
  const wrong=(mcq.answerIndex+1)%4;
  await page.locator('.exam-option[data-choice="'+wrong+'"]').click();
  await expect(page.locator('#examFeedback')).toContainText('Incorrect · Weak');
  await expect(page.locator('#examFeedback')).toContainText(mcq.rationale);
  await expect(page.locator('#examFeedback')).toContainText(mcq.sourcePage);
  const saved=await page.evaluate(async ({id,questionId})=>{
    const data=await globalThis.MEQProgressStore.exportAll();
    return data[key(id,'mcq',questionId)];
  },{id,questionId:mcq.id});
  expect(saved).toBe('weak');
});
