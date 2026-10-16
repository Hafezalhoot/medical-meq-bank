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
  await expect(page.locator('.course-library-card')).toHaveCount(2);
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

  await openWorkspace(page, 390, 844);
  await attachScreenshot(page, testInfo, 'phone-study');
  await page.locator('#darkBtn').click();
  await expect(page.locator('body')).toHaveClass(/dark/);
  await attachScreenshot(page, testInfo, 'phone-dark-mode');
});
