import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
const derm='internal-medicine-ii-dermatology-introduction';
async function openNotebook(page){
  const panel=page.locator('#myReviewDisclosure');
  if(!(await panel.evaluate(element=>element.open)))await panel.locator('summary').click();
  await page.locator('#mistakeNotebookBtn').click();
}
async function startMcq(page){
  await page.goto('/');
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await expect(page.locator('#lectureFilter option[value="'+derm+'"]')).toHaveCount(1);
  await page.locator('#examModeBtn').click();
  await page.locator('#examFormat').selectOption('mcq');
  await page.locator('#examBegin').click();
  const prompt=await page.locator('#examQuestionHeading').textContent();
  const mcq=await page.evaluate(({prompt,derm})=>lectures.find(l=>l.id===derm).studyGuide.mcqs.find(q=>q.question===prompt),{prompt,derm});
  return mcq;
}
test('Daily Weak 15 uses saved weak questions, and notebook records auto-scored mistakes after reload',async({page})=>{
  const mcq=await startMcq(page);
  const wrong=(mcq.answerIndex+1)%mcq.options.length;
  await page.locator('.exam-option[data-choice="'+wrong+'"]').click();
  await expect(page.locator('#examFeedback')).toContainText('Incorrect');
  await page.locator('#examClose').click();
  await openNotebook(page);
  await expect(page.locator('#examNotebookList .exam-notebook-item')).toHaveCount(1);
  await expect(page.locator('#examNotebookList')).toContainText('Auto-scored');
  await page.locator('#examNotebookList button:has-text("View source answer")').click();
  await expect(page.locator('#examNotebookList')).toContainText(mcq.options[mcq.answerIndex]);
  await page.locator('#examClose').click();
  await page.reload();
  await page.locator('#myReviewDisclosure summary').click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#dailyWeakBtn').click();
  await expect(page.locator('#examQuestionHeading')).toContainText(mcq.question);
  await expect(page.locator('#examPosition')).toHaveText('Question 1 / 1');
});
test('Daily review empty state never starts an exam or fabricates weak questions',async({page})=>{
  await page.goto('/');
  await page.locator('#myReviewDisclosure summary').click();
  await page.locator('#dailyWeakBtn').click();
  await expect(page.locator('#dailyReviewStatus')).toContainText('No saved Weak / Review questions yet');
  await expect(page.locator('#examDialog')).not.toBeVisible();
});
test('Notebook retry does not erase mistake history and marks successful retry Mastered',async({page})=>{
  const mcq=await startMcq(page);
  await page.locator('.exam-option[data-choice="'+((mcq.answerIndex+1)%mcq.options.length)+'"]').click();
  await page.locator('#examClose').click();
  await openNotebook(page);
  page.once('dialog',d=>d.accept());
  await page.locator('#examNotebookList button:has-text("Retry question")').click();
  await page.locator('.exam-option[data-choice="'+mcq.answerIndex+'"]').click();
  await expect(page.locator('#examFeedback')).toContainText('Mastered');
  await page.locator('#examClose').click();
  await openNotebook(page);
  await expect(page.locator('#examNotebookList')).toContainText('Now Mastered');
  await expect(page.locator('#examNotebookList')).toContainText('1 mistake');
});

test('Notebook history retains more than 500 distinct prior records without erasing old mistakes',async({page})=>{
  await page.addInitScript(()=>{
    const rows={};
    for(let i=0;i<600;i++){
      const id='historic-'+i;
      rows['urology-congenital-anomalies::core::'+id]={
        lectureId:'urology-congenital-anomalies',type:'core',id,
        attempts:1,mistakes:1,lastSeen:Date.now()-i*1000
      };
    }
    localStorage.setItem('medicalBankReviewLogV1',JSON.stringify(rows));
  });
  const mcq=await startMcq(page);
  await page.locator('.exam-option[data-choice="'+((mcq.answerIndex+1)%mcq.options.length)+'"]').click();
  const count=await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('medicalBankReviewLogV1'))).length);
  expect(count).toBe(601);
});

test('Daily Weak 15 skips obsolete saved question IDs without erasing Weak progress',async({page})=>{
  const mcq=await startMcq(page);
  await page.locator('.exam-option[data-choice="'+((mcq.answerIndex+1)%mcq.options.length)+'"]').click();
  await expect(page.locator('#examFeedback')).toContainText('Incorrect');
  await page.locator('#examClose').click();
  const ghost=derm+'::mcq::removed-source-question';
  await page.evaluate(ghost=>{
    state[ghost]='weak';
    const saved=JSON.parse(localStorage.getItem('medicalBankStatusV2')||'{}');
    saved[ghost]='weak';
    localStorage.setItem('medicalBankStatusV2',JSON.stringify(saved));
  },ghost);
  const review=page.locator('#myReviewDisclosure');
  if(!(await review.evaluate(element=>element.open)))await review.locator('summary').click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#dailyWeakBtn').click();
  await expect(page.locator('#examQuestionHeading')).toContainText(mcq.question);
  await expect(page.locator('#examPosition')).toHaveText('Question 1 / 1');
  await expect(page.locator('#dailyReviewStatus')).toContainText('1 unavailable saved question(s) skipped');
  const retained=await page.evaluate(ghost=>JSON.parse(localStorage.getItem('medicalBankStatusV2')||'{}')[ghost],ghost);
  expect(retained).toBe('weak');
});
