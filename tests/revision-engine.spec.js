import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
const derm='internal-medicine-ii-dermatology-introduction';
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
  await page.locator('#mistakeNotebookBtn').click();
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
  await page.locator('#mistakeNotebookBtn').click();
  page.once('dialog',d=>d.accept());
  await page.locator('#examNotebookList button:has-text("Retry question")').click();
  await page.locator('.exam-option[data-choice="'+mcq.answerIndex+'"]').click();
  await expect(page.locator('#examFeedback')).toContainText('Mastered');
  await page.locator('#examClose').click();
  await page.locator('#mistakeNotebookBtn').click();
  await expect(page.locator('#examNotebookList')).toContainText('Now Mastered');
  await expect(page.locator('#examNotebookList')).toContainText('1 mistake');
});
