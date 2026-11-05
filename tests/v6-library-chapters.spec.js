import {test, expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

async function openUrology(page) {
  await page.goto('/#/library',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#lecture-urology-bladder-cancer, .lecture-overview-card[aria-label="Open lecture: Bladder Cancer"]').first()).toBeVisible({timeout:20000});
  await expect(page.locator('.lecture-overview-card')).toHaveCount(8,{timeout:20000});
}

test('library directly lists existing lectures when no chapter grouping is configured', async ({page}) => {
  await openUrology(page);
  await expect(page.getByRole('searchbox',{name:'Find a lecture in this specialty'})).toBeVisible();
  await expect(page.locator('.library-chapter')).toHaveCount(0);
  await expect(page.locator('.lecture-overview-card')).toHaveCount(8);
});

test('search filters lecture metadata without loading extra medical payloads', async ({page}) => {
  await openUrology(page);
  const search=page.getByRole('searchbox',{name:'Find a lecture in this specialty'});
  await search.fill('renal');
  await expect(page.locator('.lecture-overview-card')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Open lecture: Renal Tumors'})).toBeVisible();
  await expect(page.getByRole('status',{name:'Library results'})).toHaveText('1 of 8 lectures');
  await search.fill('no-such-medical-lecture');
  await expect(page.getByText('No lectures match this search.')).toBeVisible();
  await search.fill('');
  await expect(page.locator('.lecture-overview-card')).toHaveCount(8);
});

test('optional Chapters group only assigned lectures while unassigned remain visible', async ({page}) => {
  await openUrology(page);
  await page.evaluate(()=>{
    const pack=globalThis.MEQCourseRegistry.packs.get('surgery');
    pack.subjects.find(item=>item.id==='urology').chapters=[
      {id:'fundamentals',label:'Foundations',order:1},
      {id:'oncology',label:'Urologic Oncology',order:2}
    ];
    for(const id of ['urology-bladder-cancer','urology-renal-tumors'])
      globalThis.MEQLectureLoader.catalogEntry(id).chapterId='oncology';
    globalThis.MEQLectureLoader.catalogEntry('urology-congenital-anomalies').chapterId='fundamentals';
    globalThis.MEQCourseRegistry.activateCourse('surgery',{preserveSubject:true});
  });
  await expect(page.locator('.library-chapter[data-chapter-id="oncology"]')).toBeVisible();
  await expect(page.locator('.library-chapter[data-chapter-id="fundamentals"]')).toBeVisible();
  await expect(page.locator('.library-unassigned')).toBeVisible();
  await expect(page.locator('.library-chapter[data-chapter-id="oncology"] .lecture-overview-card')).toHaveCount(2);
  await expect(page.locator('.library-chapter[data-chapter-id="fundamentals"] .lecture-overview-card')).toHaveCount(1);
  await expect(page.locator('.library-unassigned .lecture-overview-card')).toHaveCount(5);
  await expect(page.locator('.lecture-overview-card')).toHaveCount(8);
  await page.getByRole('searchbox',{name:'Find a lecture in this specialty'}).fill('bladder');
  await expect(page.locator('.lecture-overview-card')).toHaveCount(1);
  await expect(page.locator('.library-chapter[data-chapter-id="fundamentals"]')).toHaveCount(0);
  await expect(page.locator('.library-unassigned')).toHaveCount(0);
});

test('subject change clears stale search and has usable empty-subject state', async ({page}) => {
  await openUrology(page);
  await page.getByRole('searchbox',{name:'Find a lecture in this specialty'}).fill('renal');
  await page.locator('#subjectSelector').selectOption('general');
  await expect(page.getByRole('searchbox',{name:'Find a lecture in this specialty'})).toHaveValue('');
  await expect(page.locator('#emptyMessage')).toContainText('No lectures');
  await page.locator('#subjectSelector').selectOption('urology');
  await expect(page.locator('.lecture-overview-card')).toHaveCount(8,{timeout:20000});
});

test('mobile library search is visible and result items stay inside viewport', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await openUrology(page);
  const search=page.getByRole('searchbox',{name:'Find a lecture in this specialty'});
  await expect(search).toBeVisible();
  await search.fill('bladder');
  await expect(page.locator('.lecture-overview-card')).toHaveCount(1);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
