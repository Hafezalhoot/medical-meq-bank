import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
test('Study progress gives honest per-lecture mastery among rated questions',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('medicalBankStatusV2',JSON.stringify({
      'urology-congenital-anomalies::case::pujo':'weak'
    }));
    localStorage.setItem('medicalBankReviewLogV1',JSON.stringify({
      'urology-congenital-anomalies::case::pujo':{
        lectureId:'urology-congenital-anomalies',type:'case',id:'pujo',mistakes:2
      }
    }));
  });
  await page.goto('/');
  await expect(page.locator('#learningAnalyticsRows tr')).toHaveCount(1,{timeout:15000});
  await page.locator('#studyInsights summary').click();
  const row=page.locator('#learningAnalyticsRows tr').first();
  await expect(row).toContainText('Congenital');
  await expect(row.locator('td[data-rating="weak"]')).toHaveText('1');
  await expect(row.locator('td[data-metric="mastery"]')).toHaveText('0% (1 rated)');
  await expect(row).toContainText('1');
  await expect(page.locator('.learning-analytics-heading').first()).toContainText('not an exam accuracy score');
});
test('Automatic accuracy and written self-ratings have distinct labels',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('medicalBankExamHistoryV1',JSON.stringify([
      {date:'2026-10-22T00:00:00Z',subject:'Urology',questions:6,answered:6,
        auto:4,correct:3,self:2,selfKnown:1,wrong:2}
    ]));
  });
  await page.goto('/');
  await page.locator('#studyInsights summary').click();
  await expect(page.locator('#learningExamHistory')).toContainText('75% auto-scored MCQ accuracy (4 checked)');
  await expect(page.locator('#learningExamHistory')).toContainText('1 / 2 written self-rated correct');
});
test('Empty analytics never invents a percentage',async({page})=>{
  await page.goto('/');
  await page.locator('#studyInsights summary').click();
  await expect(page.locator('#learningAnalyticsEmpty')).toBeVisible();
  await expect(page.locator('#learningAnalyticsTable')).toBeHidden();
  await expect(page.locator('#learningExamHistory')).toContainText('No completed exams');
});
