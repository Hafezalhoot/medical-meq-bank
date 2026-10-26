import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

async function openBank(page,width=1440,height=900){
  await page.setViewportSize({width,height});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
}

test('progress is scoped to the current specialty while My Review spans all courses',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('medicalBankStatusV2',JSON.stringify({
      'neurosurgery-traumatic-brain-injury::case::tbi-m01':'weak'
    }));
  });
  await openBank(page);
  await expect(page.locator('#subjectSelector')).toHaveValue('urology');
  await expect(page.locator('#myReviewCount')).toContainText('1 to revisit');
  await expect(page.locator('.my-review-scope')).toHaveText('All courses');
  await expect(page.locator('.insights-title')).toContainText('Specialty progress');
  await expect(page.locator('#insightsHeadline')).toHaveText('0% rated • 0 mastered');
  await page.locator('#subjectSelector').selectOption('neurosurgery');
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
  await expect(page.locator('#myReviewCount')).toContainText('1 to revisit');
  await expect(page.locator('.insights-title')).toContainText('Specialty progress');
  // A valid migration can clear the legacy localStorage key. Check the
  // actual question rating rather than insisting that the old key survives.
  await page.locator('#lectureFilter').selectOption('neurosurgery-traumatic-brain-injury');
  const savedWeak=page.locator('#neurosurgery-traumatic-brain-injury-case-tbi-m01 .status.weak');
  await expect(savedWeak).toHaveClass(/active/,{timeout:20000});
});

test('320px dark progress scope is readable without overflow',async({page})=>{
  await openBank(page,320,720);
  await expect(page.locator('.my-review-scope')).toBeVisible();
  await expect(page.locator('#studyInsights .insights-title')).toContainText('Specialty progress');
  await expect(page.locator('#insightsHeadline')).toContainText('rated');
  await page.locator('#darkBtn').click();
  await expect(page.locator('body')).toHaveClass(/dark/);
  const height=(await page.locator('#studyInsights > summary').boundingBox()).height;
  expect(height).toBeLessThanOrEqual(75);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
