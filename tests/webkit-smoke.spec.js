import {test, expect} from '@playwright/test';

async function waitForBank(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {
    name: 'Medical MEQ Review Bank'
  })).toBeVisible();
  await expect(page.locator('#reviewFilter')).toBeAttached();
  await expect.poll(
    () => page.evaluate(() => document.querySelector('main')?.getAttribute('aria-busy'))
  ).toBe('false');
  await expect(page.locator('.study-item').first()).toBeAttached();
}

async function expectControlToBeTopmost(locator) {
  const receivesPointer = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
    return target === element || element.contains(target);
  });
  expect(receivesPointer).toBe(true);
}

test('WebKit opens the active subject and loads another subject on demand', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'webkit-desktop', 'Desktop Safari scenario');

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await waitForBank(page);
  await expect.poll(
    () => page.evaluate(() => globalThis.MEQLectureLoader?.loadedLectureIds.size)
  ).toBe(1);

  await page.locator('#subjectSelector').selectOption('neurosurgery');
  await expect(page.locator('#lecture-neurosurgery-traumatic-brain-injury')).toBeVisible();
  await expect.poll(
    () => page.evaluate(() =>
      globalThis.MEQLectureLoader?.isLoaded('neurosurgery-traumatic-brain-injury')
    )
  ).toBe(true);
  await expect.poll(
    () => page.evaluate(() => globalThis.MEQLectureLoader?.loadedLectureIds.size)
  ).toBe(2);

  expect(pageErrors).toEqual([]);
});

test('iPhone WebKit can expand, search and reset mobile filters', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'webkit-mobile', 'iPhone WebKit scenario');

  await waitForBank(page);

  const toggle = page.locator('#mobileFiltersToggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobileFilterBackdrop')).toBeVisible();
  await expect(page.locator('#studyToolbar')).toHaveAttribute('role', 'dialog');

  await page.locator('#search').fill('testicular');
  await expect(page.locator('#activeFilterChips')).toContainText('Search: testicular');
  await expect(page.locator('#globalSearchResults')).toBeVisible();
  await expect(page.locator('#globalSearchResults .global-search-result').first()).toBeVisible();

  const resetButton = page.locator('#resetFiltersBtn');
  await expect(resetButton).toBeVisible();
  await expectControlToBeTopmost(resetButton);
  await resetButton.click();
  await expect(page.locator('#search')).toHaveValue('');
  await expect(page.locator('#activeFilterChips')).toBeHidden();
  await expect(page.locator('#globalSearchResults')).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});


test('Safari desktop and iPhone study the new Dermatology lecture with source-linked MCQ and original lecture photos', async ({page}, testInfo) => {
  const lectureId = 'internal-medicine-ii-dermatology-introduction';
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#courseSelector')).toBeVisible();
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');

  if (testInfo.project.name === 'webkit-mobile') {
    await page.locator('#mobileFiltersToggle').click();
    await expect(page.locator('#mobileFilterBackdrop')).toBeVisible();
  }
  const lectureFilter = page.locator('#lectureFilter');
  await expect(lectureFilter.locator('option[value="'+lectureId+'"]')).toHaveCount(1,{timeout:15000});
  await lectureFilter.selectOption(lectureId);
  await expect(page.locator('#lecture-'+lectureId)).toBeVisible({timeout:15000});

  if (testInfo.project.name === 'webkit-mobile') {
    await page.locator('#closeMobileFiltersBtn').click();
    await expect(page.locator('#mobileFiltersToggle')).toHaveAttribute('aria-expanded','false');
  }
  const guide=page.locator('#lecture-'+lectureId+' .learning-companion');
  await expect(guide).toBeVisible();
  await expect(guide.locator('.study-guide-part')).toHaveCount(3);

  // Verify mobile sticky filters do not obstruct the real tap target.
  const openStudyPart=async part=>{
    if(await part.evaluate(el=>el.open))return;
    const summary=part.locator('summary');
    if(testInfo.project.name==='webkit-mobile'){
      await summary.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
      await expect.poll(()=>summary.evaluate(el=>{
        const r=el.getBoundingClientRect();
        if(!r.width||!r.height||r.top<0||r.bottom>innerHeight)return false;
        const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        return hit===el||el.contains(hit);
      }),{timeout:10000}).toBe(true);
    }
    await summary.click();
  };
  const mcqPanel=guide.locator('.study-guide-part').nth(1);
  await openStudyPart(mcqPanel);
  await expect(mcqPanel).toHaveAttribute('open', '');
  const mcq=mcqPanel.locator('.study-guide-mcq').first();
  await expect(mcq).toBeVisible();
  await expect(mcq.locator('input[type="radio"]')).toHaveCount(4);
  // The visible label is what students actually tap on iPhone Safari.
  const correctChoice=mcq.locator('.study-guide-choices label').nth(1);
  await expect(correctChoice).toBeVisible();
  await correctChoice.click();
  await expect(mcq.locator('input[type="radio"]').nth(1)).toBeChecked();
  await mcq.getByRole('button',{name:'Reveal explanation'}).click();
  await expect(mcq.locator('.study-guide-answer')).toContainText('Your answer is correct');

  await openStudyPart(guide.locator('.study-guide-part').nth(2));
  await expect(guide.locator('.original-guide-copy')).toContainText('original printed lecture photographs');
  await expect(guide.locator('.original-atlas-item')).toHaveCount(14);
  const figures=guide.locator('.original-atlas-item img');
  await expect(figures).toHaveCount(14);
  await expect(page.locator('#originalFigureTools')).toBeHidden();
  const first=figures.first();
  await first.scrollIntoViewIfNeeded();
  await expect.poll(()=>first.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  // V4 must work in both desktop Safari and iPhone WebKit, not only Chromium.
  const originalLink=guide.locator('.original-atlas-item .source-figure-full').first();
  await originalLink.click();
  const viewer=page.locator('#sourceFigureViewer');
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('img')).toHaveAttribute('src',/assets\/lectures\/dermatology.+\.jpg/);
  await viewer.locator('[data-source-in]').click();
  await expect(viewer.locator('.source-viewer-zoom output')).toHaveText('150%');
  await viewer.locator('[data-source-close]').click();
  await expect(viewer).toBeHidden();
  await expect(guide.locator('.study-guide-figure img')).toHaveCount(0);

  if (testInfo.project.name === 'webkit-mobile') {
    const sizes=await page.evaluate(()=>({
      page:document.documentElement.scrollWidth,
      viewport:document.documentElement.clientWidth
    }));
    expect(sizes.page).toBeLessThanOrEqual(sizes.viewport + 1);
  }
  expect(pageErrors).toEqual([]);
  await testInfo.attach('dermatology-'+testInfo.project.name,{
    body:await page.screenshot({animations:'disabled'}),
    contentType:'image/png'
  });
});
