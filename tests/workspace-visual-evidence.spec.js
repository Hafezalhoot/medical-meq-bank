import {test, expect} from '@playwright/test';

// Screenshots are browser-generated release evidence, not visual regression
// assertions. They ship with the existing Chromium Playwright HTML artifact.
test.use({serviceWorkers: 'block'});

async function openWorkspace(page, width, height) {
  await page.setViewportSize({width, height});
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: 'Medical MEQ Review Bank'})).toBeVisible();
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy', 'false', {timeout: 15_000});
}

async function attachScreenshot(page, testInfo, name) {
  await testInfo.attach(name, {
    body: await page.screenshot({animations: 'disabled', fullPage: false}),
    contentType: 'image/png'
  });
}

test('capture actual V2 reading surfaces across desktop, phone, and dark/focus states', async ({page}, testInfo) => {
  await openWorkspace(page, 1440, 900);
  await attachScreenshot(page, testInfo, 'desktop-study');

  await page.locator('#courseLibraryDisclosure summary').click();
  await expect(page.locator('.course-library-card')).toHaveCount(3);
  await attachScreenshot(page, testInfo, 'desktop-course-library');
  await page.locator('#courseLibraryDisclosure summary').click();

  await page.locator('#studyInsights summary').click();
  await expect(page.locator('#lectureCount')).toBeVisible();
  await attachScreenshot(page, testInfo, 'desktop-detailed-progress');
  await page.locator('#studyInsights summary').click();

  await page.locator('#focusModeBtn').click();
  await expect(page.locator('.app')).toHaveClass(/study-focus/);
  await attachScreenshot(page, testInfo, 'desktop-focus-questions');
  await page.locator('#focusModeBtn').click();

  await openWorkspace(page, 768, 1024);
  await attachScreenshot(page, testInfo, 'tablet-study');

  await openWorkspace(page, 320, 700);
  await attachScreenshot(page, testInfo, 'compact-phone-study');

  await openWorkspace(page, 390, 844);
  await attachScreenshot(page, testInfo, 'phone-study');
  await page.locator('#darkBtn').click();
  await expect(page.locator('body')).toHaveClass(/dark/);
  await attachScreenshot(page, testInfo, 'phone-dark-mode');
});


test('capture source-reviewed Dermatology pilot, explanation and infant reading surface', async ({page}, testInfo) => {
  await openWorkspace(page, 1440, 900);
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
  await expect(page.locator('#lectureFilter option[value="internal-medicine-ii-dermatology-introduction"]')).toHaveCount(1, {timeout:15000});
  await page.locator('#lectureFilter').selectOption('internal-medicine-ii-dermatology-introduction');
  await expect(page.locator('.learning-companion')).toBeVisible();
  await attachScreenshot(page, testInfo, 'dermatology-desktop');
  await page.locator('.learning-companion summary').first().click();
  await attachScreenshot(page, testInfo, 'dermatology-explanation');
  await page.locator('.learning-companion summary').nth(2).click();
  await expect(page.locator('.original-guide-link')).toBeVisible();
  await page.locator('.original-atlas-grid').scrollIntoViewIfNeeded();
  await attachScreenshot(page, testInfo, 'dermatology-original-source-gallery');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#originalFigureTools').scrollIntoViewIfNeeded();
  await attachScreenshot(page, testInfo, 'dermatology-phone-original-source-import');
  await page.locator('.study-guide-explanation').first().scrollIntoViewIfNeeded();
  await attachScreenshot(page, testInfo, 'dermatology-phone');
});
