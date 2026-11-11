import {test, expect} from '@playwright/test';

test.use({serviceWorkers:'block'});
const derm='internal-medicine-ii-dermatology-introduction';
const bladder='urology-bladder-cancer';

test('R02 authored explanation sections are deep-linkable without losing any source section', async ({page})=>{
  await page.goto('/#/lecture/'+derm+'?course=internal-medicine-ii&subject=dermatology&tab=explanation&section=e-4');
  const root=page.locator('#lecture-'+derm);
  await expect(root).toBeVisible();
  await expect(root.locator('#readerTopicSelect')).toHaveValue('e-4');
  await expect(root.locator('.study-guide-explanation')).toHaveCount(11);
  await expect(root.locator('.study-guide-explanation:visible')).toHaveCount(1);
  await expect(root.locator('.study-guide-explanation:visible h3'))
    .toContainText('Dermis, Hypodermis and skin appendages');
  await root.locator('#readerNextTopic').click();
  await expect(root.locator('#readerTopicSelect')).toHaveValue('e-5');
  expect(await page.evaluate(()=>location.hash)).toContain('section=e-5');
  await page.reload();
  await expect(page.locator('#lecture-'+derm+' #readerTopicSelect')).toHaveValue('e-5');
  expect(await page.evaluate(()=>globalThis.MEQStudyContext.get().sectionId)).toBe('e-5');
});

test('R02 authored question subtopics filter only their mapped source items; never invent MCQ topic tags',async({page})=>{
  await page.goto('/#/lecture/'+bladder+'?course=surgery&subject=urology&tab=cases&topic=investigations');
  const root=page.locator('#lecture-'+bladder);
  await expect(root).toBeVisible();
  await expect(root.locator('#readerTopicBar')).toBeVisible();
  await expect(root.locator('#readerTopicSelect')).toHaveValue('q-investigations');
  const cases=root.locator('#readerPane-cases .study-item');
  expect(await cases.count()).toBeGreaterThan(5);
  const selected=await cases.evaluateAll(items=>({
    shown:items.filter(el=>getComputedStyle(el).display!=='none').length,
    allMapped:items.filter(el=>getComputedStyle(el).display!=='none')
      .every(el=>(el.dataset.subtopics||'').split(' ').includes('investigations'))
  }));
  expect(selected.shown).toBeGreaterThan(0);
  expect(selected.shown).toBeLessThan(await cases.count());
  expect(selected.allMapped).toBe(true);
  expect(await page.evaluate(()=>globalThis.MEQStudyContext.get().topicId)).toBe('investigations');
  await root.locator('#readerTopicSelect').selectOption('q-all');
  expect(await page.evaluate(()=>location.hash.includes('topic='))).toBe(false);
  await expect(root.locator('#readerTopicPosition')).toContainText('questions');
});

test('R02 MCQ practice without authored subtopic links preserves every MCQ',async({page})=>{
  await page.goto('/#/lecture/'+derm);
  const root=page.locator('#lecture-'+derm);
  await root.getByRole('tab',{name:'MCQ practice',exact:true}).click();
  await expect(root.locator('#readerTopicBar')).toBeHidden();
  await expect(root.locator('.study-guide-mcq')).toHaveCount(30);
  await expect(root.locator('.study-guide-mcq:visible')).toHaveCount(30);
});
