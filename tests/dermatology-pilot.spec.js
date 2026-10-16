import {test, expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

const courseId='internal-medicine-ii';
const lectureId='dermatology-introduction-to-dermatology';
const medicalCounts={cases:11,coreShorts:45,imageQuestions:10,detailedShorts:19,rapid:38};

async function openDermatology(page){
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#courseSelector')).toBeVisible();
  await page.locator('#courseSelector').selectOption(courseId);
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
  await expect(page.locator('#lectureFilter option[value="'+lectureId+'"]')).toHaveCount(1,{timeout:15000});
  await page.locator('#lectureFilter').selectOption(lectureId);
  await expect(page.locator('#lecture-'+lectureId+' .lecture-title')).toHaveText('Introduction to Dermatology',{timeout:15000});
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false');
}

test('new Internal Medicine II course loads only its source-traced dermatology lecture',async({page})=>{
  await openDermatology(page);
  const source=await page.evaluate(id=>{
    const value=lectures.find(x=>x.id===id);
    return {
      course:value.courseId,subject:value.subjectKey,title:value.title,notes:value.sourceNote,
      counts:Object.fromEntries(['cases','coreShorts','imageQuestions','detailedShorts','rapid']
        .map(key=>[key,value[key].length])),
      explanation:value.studyGuide?.explanation?.length,
      mcqs:value.studyGuide?.mcqs?.length
    };
  },lectureId);
  expect(source.course).toBe(courseId);
  expect(source.subject).toBe('dermatology');
  expect(source.notes).toContain('Dermatology Department book 2022.pdf');
  expect(source.counts).toEqual(medicalCounts);
  expect(source.explanation).toBe(12);
  expect(source.mcqs).toBe(25);
  await expect(page.locator('#lecture-'+lectureId+' .learning-companion')).toBeVisible();
  await expect(page.locator('#lecture-'+lectureId+' .study-guide-part')).toHaveCount(3);
});

test('all ten source-linked spot illustrations and infographic are resolvable local assets',async({page})=>{
  await openDermatology(page);
  const answer=await page.evaluate(async id=>{
    const lecture=lectures.find(x=>x.id===id);
    const paths=[
      ...lecture.imageQuestions.map(x=>x.image),
      lecture.studyGuide.infographic.image
    ];
    const loaded=await Promise.all(paths.map(async path=>{
      const url=new URL(path,location.href);
      const response=await fetch(url);
      return {path,status:response.status,mime:response.headers.get('content-type')||'',bytes:(await response.arrayBuffer()).byteLength};
    }));
    return {loaded,pages:lecture.imageQuestions.map(x=>x.page)};
  },lectureId);
  expect(answer.loaded).toHaveLength(11);
  for(const asset of answer.loaded){
    expect(asset.status).toBe(200);
    expect(asset.bytes).toBeGreaterThan(100);
    expect(asset.path).toMatch(/^\.\/assets\/dermatology-intro\//);
  }
  expect(answer.pages.every(page=>page.startsWith('PDF page '))).toBe(true);

  await page.locator('#lecture-'+lectureId+' .study-guide-part')
    .filter({has:page.locator('summary', {hasText:'Infographic'})}).locator('summary').click();
  await expect(page.locator('#lecture-'+lectureId+' .study-guide-figure img')).toBeVisible();
});

test('source-backed Arabic explanation and MCQ behave without polluting existing ratings',async({page})=>{
  await openDermatology(page);
  const guide=page.locator('#lecture-'+lectureId+' .learning-companion');
  await guide.locator('summary',{hasText:'Explanation'}).click();
  await expect(guide.getByText('Basal cell layer',{exact:false}).first()).toBeVisible();
  await expect(guide.getByText('Understanding Aid — Not an additional exam fact').first()).toBeVisible();
  await guide.locator('summary',{hasText:'MCQ practice'}).click();
  const first=guide.locator('.study-guide-mcq').first();
  await expect(first.locator('input[type="radio"]')).toHaveCount(4);
  await first.locator('input[type="radio"]').first().check();
  await first.getByRole('button',{name:'Reveal explanation'}).click();
  await expect(first.locator('.study-guide-answer')).toContainText('Your answer is correct.');
  await expect(first.locator('.study-guide-answer')).toContainText('1/7');
  const saved=await page.evaluate(()=>globalThis.MEQProgressStore.exportAll());
  expect(Object.keys(saved)).toHaveLength(0);
});

test('adding dermatology leaves published Surgery bank and saved progress intact',async({page})=>{
  const protectedKey='urology-bladder-cancer::case::bc-c01';
  await page.addInitScript(key=>{
    localStorage.setItem('medicalBankStatusV2',JSON.stringify({[key]:'mastered'}));
  },protectedKey);
  await openDermatology(page);
  await page.locator('#courseSelector').selectOption('surgery');
  await expect(page.locator('#lectureFilter option[value="urology-bladder-cancer"]')).toHaveCount(1);
  const stored=await page.evaluate(key=>globalThis.MEQProgressStore.exportAll().then(value=>value[key]),protectedKey);
  expect(stored).toBe('mastered');
});

test('dermatology reading and diagram load stay within 320px viewport',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await openDermatology(page);
  await page.locator('#darkBtn').click();
  const guide=page.locator('#lecture-'+lectureId+' .learning-companion');
  await guide.locator('summary',{hasText:'Infographic'}).click();
  const size=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth}));
  expect(size.documentWidth).toBeLessThanOrEqual(size.viewport+1);
  await expect(guide.getByRole('img',{name:/Source-derived lesion morphology chart/})).toBeVisible();
});
