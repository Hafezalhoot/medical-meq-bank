import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

async function openLibrary(page) {
  await page.goto('/#/library', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
  await expect(page.locator('.lecture-overview-panel')).toBeVisible({timeout:20000});
}

test('library indexes real lectures in searchable compact rows, without loading their answers', async ({page}) => {
  await openLibrary(page);
  const search=page.getByRole('searchbox',{name:'Find a lecture'});
  await expect(search).toBeVisible();
  await expect(page.locator('.lecture-overview-card')).toHaveCount(8);
  await search.fill('renal');
  await expect(page.locator('.lecture-overview-card:visible')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Open lecture: Renal Tumors'})).toBeVisible();
  await expect(page.locator('#libraryLectureResultsStatus')).toContainText('1 of 8');
  await search.fill('xyzzy-unfound');
  await expect(page.locator('.lecture-overview-card:visible')).toHaveCount(0);
  await expect(page.getByText('No lectures match your search')).toBeVisible();
  await search.fill('');
  await expect(page.locator('.lecture-overview-card:visible')).toHaveCount(8);
  await expect(page.locator('#lecture-urology-renal-tumors')).toHaveCount(0);
});

test('library rail switches specialties, and empty specialties explain what is missing', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await openLibrary(page);
  const rail=page.locator('.lecture-sidebar');
  await expect(rail.getByRole('heading',{name:'Specialties'})).toBeVisible();
  const nav=rail.getByRole('navigation',{name:'Specialties in selected course'});
  await expect(nav.getByRole('button',{name:'Urology'})).toHaveAttribute('aria-current','page');
  await nav.getByRole('button',{name:'Neurosurgery'}).click();
  await expect(page.locator('#subjectSelector')).toHaveValue('neurosurgery');
  await expect(page.locator('#lectureFilter')).toHaveValue('all',{timeout:20000});
  await expect(page.getByRole('button',{name:'Open lecture: Traumatic Brain Injury'})).toBeVisible({timeout:20000});
  await nav.getByRole('button',{name:'General Surgery'}).click();
  await expect(page.locator('#lectureFilter')).toHaveValue('all',{timeout:20000});
  await expect(page.getByText('No lectures have been published for General Surgery yet.')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-workspace','library');
});

test('optional chapter groups organize lectures without changing study IDs', async ({page}) => {
  await openLibrary(page);
  await page.evaluate(() => {
    subjects.find(subject=>subject.id==='urology').chapters=[
      {id:'renal',label:'Renal',order:1},
      {id:'bladder',label:'Bladder',order:2}
    ];
    lectures.find(l=>l.id==='urology-renal-tumors').chapterId='renal';
    lectures.find(l=>l.id==='urology-bladder-cancer').chapterId='bladder';
    render();
  });
  await expect(page.locator('#libraryChapter-renal h3')).toHaveText('Renal');
  await expect(page.locator('#libraryChapter-bladder h3')).toHaveText('Bladder');
  await expect(page.locator('#libraryChapter-unassigned h3')).toContainText('Other lectures');
  await expect(page.locator('.lecture-overview-card')).toHaveCount(8);
  await expect(page.locator('#libraryChapter-renal').getByRole('button',{name:'Open lecture: Renal Tumors'})).toBeVisible();
  await expect(page.locator('#libraryChapter-bladder').getByRole('button',{name:'Open lecture: Bladder Cancer'})).toBeVisible();
  const search=page.getByRole('searchbox',{name:'Find a lecture'});
  await search.fill('Bladder');
  await expect(page.locator('.lecture-overview-card:visible')).toHaveCount(1);
  await page.getByRole('button',{name:'Open lecture: Bladder Cancer'}).click();
  await expect(page).toHaveURL(/#\/lecture\/urology-bladder-cancer\?/);
  await expect(page.locator('#lectureFilter')).toHaveValue('urology-bladder-cancer');
});

test('library search and chapter navigation remain useful at 320px', async ({page}) => {
  await page.setViewportSize({width:320,height:700});
  await openLibrary(page);
  await expect(page.getByRole('searchbox',{name:'Find a lecture'})).toBeVisible();
  await expect(page.locator('.lecture-overview-card')).toHaveCount(8);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole('searchbox',{name:'Find a lecture'}).fill('BPH');
  await expect(page.getByRole('button',{name:'Open lecture: BPH & Prostate Carcinoma'})).toBeVisible();
});