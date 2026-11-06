import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

const visibleQuestions='#mainContent .study-item:visible, #mainContent .study-guide-mcq:visible, #mainContent .rapid-item:visible';
async function openPractice(page) {
  await page.goto('/#/practice',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveAttribute('data-workspace','practice');
  await expect(page.locator('#practiceSession')).toBeVisible({timeout:20000});
  await expect(page.locator('.practice-current')).toBeVisible({timeout:20000});
}

test('Practice opens a source-authored question, never a giant lecture overview',async({page})=>{
  await openPractice(page);
  await expect(page.locator('.lecture-overview-panel')).toHaveCount(0);
  await expect(page.locator(visibleQuestions)).toHaveCount(1);
  await expect(page.locator('#practiceQuestionCounter')).toContainText('Question 1 of');
  await expect(page.locator('#practicePrevious')).toBeDisabled();
  await expect(page.locator('#practiceNext')).toBeEnabled();
  const original=await page.locator('.practice-current').evaluate(node=>node.id||node.dataset.practiceIdentity);
  await page.locator('#practiceNext').click();
  const next=await page.locator('.practice-current').evaluate(node=>node.id||node.dataset.practiceIdentity);
  expect(next).not.toBe(original);
  await expect(page.locator('#practiceQuestionCounter')).toContainText('Question 2 of');
  await expect(page.locator(visibleQuestions)).toHaveCount(1);
  await page.locator('#practicePrevious').click();
  const returned=await page.locator('.practice-current').evaluate(node=>node.id||node.dataset.practiceIdentity);
  expect(returned).toBe(original);
});

test('revealing an answer is not automatic Weak; manual rating persists across questions',async({page})=>{
  await openPractice(page);
  const current=page.locator('.practice-current');
  const reveal=current.locator('.toggle');
  await expect(reveal).toBeVisible();
  await reveal.click();
  await expect(current.locator('.status.active')).toHaveCount(0);
  const weak=current.locator('.status.weak');
  const key=await weak.getAttribute('data-key');
  expect(key).toMatch(/^v2::/);
  await weak.click();
  await expect(weak).toHaveClass(/active/);
  await expect.poll(async()=>page.evaluate(async k=>{
    await globalThis.MEQProgressStore.ready;
    return (await globalThis.MEQProgressStore.exportAll())[k];
  },key)).toBe('weak');
  await page.locator('#practiceNext').click();
  await page.locator('#practicePrevious').click();
  await expect(page.locator('.practice-current .status.weak')).toHaveClass(/active/);
});

test('Practice only shows a source-reviewed MCQ and does not mark Weak on reveal',async({page})=>{
  await page.goto('/#/library',{waitUntil:'domcontentloaded'});
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
  await page.getByRole('navigation',{name:'Primary workspace'}).getByRole('link',{name:'Practice'}).click();
  await expect(page.locator('#practiceSession')).toBeVisible({timeout:20000});
  await page.locator('#desktopFiltersToggle').click();
  await page.locator('#typeFilter').selectOption('mcq');
  await expect(page.locator(visibleQuestions)).toHaveCount(1,{timeout:20000});
  const current=page.locator('.study-guide-mcq.practice-current');
  await expect(current).toBeVisible();
  await expect(page.locator('.cases-section:visible')).toHaveCount(0);
  await current.getByRole('button',{name:'Reveal explanation'}).click();
  await expect(current.locator('.study-guide-answer')).toBeVisible();
  await expect(current.locator('.status.weak')).not.toHaveClass(/active/);
  await page.locator('#practiceNext').click();
  await expect(page.locator('.study-guide-mcq:visible')).toHaveCount(1);
});

test('Practice handles a specialty with no published lectures honestly',async({page})=>{
  await page.goto('/#/library',{waitUntil:'domcontentloaded'});
  await page.locator('#courseSelector').selectOption('internal-medicine');
  await expect(page.locator('#subjectSelector')).toHaveValue('cardiology');
  await page.getByRole('navigation',{name:'Primary workspace'}).getByRole('link',{name:'Practice'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-workspace','practice');
  await expect(page.locator('#practiceEmpty')).toBeVisible({timeout:15000});
  await expect(page.locator('#practiceEmpty')).toContainText('No lectures have been published');
  await expect(page.locator('.practice-current')).toHaveCount(0);
  await page.locator('#practiceEmpty').getByRole('link',{name:'Browse Library'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-workspace','library');
});

test('Practice navigation is touch-friendly without horizontal overflow at 320px',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await openPractice(page);
  await expect(page.locator(visibleQuestions)).toHaveCount(1);
  for(const id of ['practicePrevious','practiceNext']){
    const box=await page.locator('#'+id).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('Review and Exams remain separate from the focused Practice session',async({page})=>{
  await openPractice(page);
  const nav=page.getByRole('navigation',{name:'Primary workspace'});
  await nav.getByRole('link',{name:'Review'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-workspace','review');
  await expect(page.locator('#myReviewDisclosure')).toHaveAttribute('open','');
  await expect(page.locator('#practiceSession')).toBeHidden();
  await nav.getByRole('link',{name:'Exams'}).click();
  await expect(page.locator('#workspaceExamEntry')).toBeVisible();
  await expect(page.locator('#practiceSession')).toBeHidden();
  await page.locator('#workspaceExamStart').click();
  await expect(page.locator('#examDialog')).toBeVisible();
});


test('Practice toolbar reveals only current answer and Random picks one visible question',async({page})=>{
  await openPractice(page);
  await page.locator('#desktopFiltersToggle').click();
  await expect(page.locator('#revealBtn')).toHaveText('Reveal current answer');
  const first=page.locator('.practice-current');
  await expect(first.locator('.toggle')).toBeVisible();
  await page.locator('#revealBtn').click();
  await expect(first).toHaveClass(/open/);
  await expect(page.locator(visibleQuestions)).toHaveCount(1);
  await page.locator('#practiceNext').click();
  await expect(page.locator('.practice-current')).not.toHaveClass(/open/);
  const before=await page.locator('.practice-current').evaluate(item=>item.id||item.dataset.practiceIdentity);
  await expect(page.locator('#randomBtn')).toHaveText('Random question');
  await page.locator('#randomBtn').click();
  const after=await page.locator('.practice-current').evaluate(item=>item.id||item.dataset.practiceIdentity);
  expect(after).not.toBe(before);
  await expect(page.locator(visibleQuestions)).toHaveCount(1);
});
