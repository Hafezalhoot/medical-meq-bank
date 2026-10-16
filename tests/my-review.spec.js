import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

async function openBank(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#courseSelector')).toBeVisible();
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy', 'false', {timeout: 15_000});
}

test('My Review is compact and explains its empty state', async ({page}) => {
  await openBank(page);
  const disclosure=page.locator('#myReviewDisclosure');
  await expect(disclosure).not.toHaveAttribute('open', '');
  await expect(page.locator('#myReviewCount')).toContainText('Nothing to revisit');
  await disclosure.locator('summary').click();
  await expect(page.locator('#myReviewStatus')).toContainText('No questions are marked Weak or Review');
  await expect(page.locator('.my-review-card')).toHaveCount(0);
  await disclosure.locator('summary').click();
  await expect(disclosure).not.toHaveAttribute('open', '');
});

test('My Review collects saved ratings from multiple subjects without loading all lecture payloads', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('medicalBankStatusV2', JSON.stringify({
      'urology-congenital-anomalies::case::pujo': 'review',
      'neurosurgery-traumatic-brain-injury::case::tbi-m01': 'weak'
    }));
  });
  const fetchedData=[];
  page.on('request',request=>{
    if(new URL(request.url()).pathname.startsWith('/lectures/data/'))fetchedData.push(request.url());
  });
  await openBank(page);
  await expect(page.locator('#myReviewCount')).toContainText('2 to revisit');
  await page.locator('#myReviewDisclosure summary').click();
  await expect(page.locator('#myReviewList .my-review-card')).toHaveCount(2);
  await expect(page.locator('#myReviewStatus')).toContainText('2 saved questions');
  // The review queue obtains lecture metadata only; no second lecture payload until opened.
  expect(new Set(fetchedData.map(url=>new URL(url).pathname)).size).toBeLessThanOrEqual(1);
  await page.getByRole('button',{name:'Open 1 weak questions in Traumatic Brain Injury'}).click();
  await expect(page.locator('#subjectSelector')).toHaveValue('neurosurgery');
  await expect(page.locator('#lectureFilter')).toHaveValue('neurosurgery-traumatic-brain-injury');
  await expect(page.locator('#reviewFilter')).toHaveValue('weak');
  const target=page.locator('#neurosurgery-traumatic-brain-injury-case-tbi-m01');
  await expect(target).toBeVisible();
  await expect(target.locator('.status.weak')).toHaveClass(/active/);
  await expect(page.locator('#myReviewDisclosure')).not.toHaveAttribute('open', '');
});

test('newly rated questions appear in My Review and can be reopened without losing progress', async ({page}) => {
  await openBank(page);
  const target=page.locator('#mainContent .case.study-item').first();
  await target.locator('.status.review').click();
  await expect(page.locator('#myReviewCount')).toContainText('1 to revisit');
  await page.locator('#myReviewDisclosure summary').click();
  await expect(page.locator('#myReviewList .my-review-card')).toHaveCount(1);
  await page.locator('#myReviewDisclosure summary').click();
  await target.locator('.status.review').click();
  await expect(page.locator('#myReviewCount')).toContainText('Nothing to revisit');
});

test('My Review actions fit narrow phones and remain keyboard-visible in dark mode', async ({page}) => {
  await page.setViewportSize({width: 320, height: 700});
  await page.addInitScript(() => {
    localStorage.setItem('medicalBankStatusV2', JSON.stringify({
      'neurosurgery-traumatic-brain-injury::case::tbi-m01': 'weak'
    }));
  });
  await openBank(page);
  await page.locator('#darkBtn').click();
  await page.locator('#myReviewDisclosure summary').click();
  const action=page.getByRole('button',{name:'Open 1 weak questions in Traumatic Brain Injury'});
  await expect(action).toBeVisible();
  const sizing=await page.evaluate(() => ({
    docWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth
  }));
  expect(sizing.docWidth).toBeLessThanOrEqual(sizing.viewportWidth+1);
  const size=await action.boundingBox();
  expect(size.height).toBeGreaterThanOrEqual(44);
  await action.focus();
  await expect(action).toBeFocused();
});
