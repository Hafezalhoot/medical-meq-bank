import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

async function openBank(page,width,height){
  await page.setViewportSize({width,height});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
}

test('mobile presents active lecture context without repeating course and specialty',async ({page})=>{
  await openBank(page,390,844);
  await expect(page.locator('#courseSelector')).toBeVisible();
  await expect(page.locator('#subjectSelector')).toBeVisible();
  const path=page.locator('#studyBreadcrumb');
  await expect(path.locator('li[aria-current="page"]')).toBeVisible();
  await expect(path.locator('li:not([aria-current="page"])').first()).toBeHidden();
  await expect(path.locator('li[aria-current="page"] strong')).toContainText('Congenital Anomalies');
  const breadcrumb=await path.boundingBox();
  expect(breadcrumb.height).toBeLessThanOrEqual(56);
  const summary=page.locator('#studyInsights > summary');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('Specialty progress');
  await expect(summary).toContainText('rated');
  expect((await summary.boundingBox()).height).toBeLessThanOrEqual(75);
  await summary.click();
  await expect(page.locator('#studyInsights')).toHaveAttribute('open','');
  await expect(page.locator('#coreProgressText')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('long Psychiatry lecture title wraps cleanly on a narrow phone',async ({page})=>{
  await openBank(page,320,720);
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await page.locator('#subjectSelector').selectOption('psychiatry');
  await page.locator('#mobileFiltersToggle').click();
  await page.locator('#lectureFilter').selectOption('internal-medicine-ii-psychiatry-psychiatric-history-mse');
  await page.locator('#applyMobileFiltersBtn').click();
  await expect(page.locator('#mobileFilterBackdrop')).toBeHidden();
  const name=page.locator('#studyBreadcrumb li[aria-current="page"] strong');
  await expect(name).toContainText('Psychiatric History');
  await expect(name).toBeVisible();
  await expect(page.locator('#courseSelector')).toBeVisible();
  await expect(page.locator('#subjectSelector')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('desktop retains complete course/specialty/lecture breadcrumb and progress track',async ({page})=>{
  await openBank(page,1440,900);
  const path=page.locator('#studyBreadcrumb');
  await expect(path.locator('li')).toHaveCount(5);
  await expect(path).toContainText('Course');
  await expect(path).toContainText('Specialty');
  await expect(path).toContainText('Location');
  await expect(path.locator('li').first()).toBeVisible();
  await expect(page.locator('.insights-summary-track')).toBeVisible();
  await expect(page.locator('#resumeStudyBtn')).toBeVisible();
});
