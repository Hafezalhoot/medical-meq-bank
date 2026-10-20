import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';

// One actual source-grounded lecture pilot: no remote source scan is hosted.
test.use({serviceWorkers: 'block'});
const lectureId='internal-medicine-ii-dermatology-introduction';

async function openDermatology(page) {
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#courseSelector')).toBeVisible();
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
  const mobileToggle=page.locator('#mobileFiltersToggle');
  if(await mobileToggle.isVisible()){
    await mobileToggle.click();
    await expect(page.locator('#mobileFilterBackdrop')).toBeVisible();
  }
  await expect(page.locator('#lectureFilter option[value="'+lectureId+'"]')).toHaveCount(1, {timeout:15000});
  await page.locator('#lectureFilter').selectOption(lectureId);
  const closeMobileFilters=page.locator('#closeMobileFiltersBtn');
  if(await closeMobileFilters.isVisible()) await closeMobileFilters.click();
  await expect(page.locator('main')).toHaveAttribute('aria-busy','false',{timeout:15000});
  await expect(page.locator('#lecture-'+lectureId)).toBeVisible();
  await expect(page.locator('#dataAlert')).toBeHidden();
}

test('Internal Medicine II / Dermatology loads the complete 10-page source-based lecture', async ({page}) => {
  await openDermatology(page);
  const info=await page.evaluate(id=>{
    const l=lectures.find(item=>item.id===id);
    return {course:l.courseId,subject:l.subjectKey,counts:{
      cases:l.cases.length,core:l.coreShorts.length,image:l.imageQuestions.length,
      detailed:l.detailedShorts.length,rapid:l.rapid.length
    },guide:{explanation:l.studyGuide.explanation.length,mcqs:l.studyGuide.mcqs.length,
      infographic:Boolean(l.studyGuide.infographic)}};
  },lectureId);
  expect(info).toEqual({course:'internal-medicine-ii',subject:'dermatology',
    counts:{cases:16,core:70,image:14,detailed:17,rapid:41},
    guide:{explanation:11,mcqs:30,infographic:false}});
  await expect(page.locator('.learning-companion .study-guide-part')).toHaveCount(3);
  await page.locator('.learning-companion summary').first().click();
  await expect(page.getByText('Dermatology هو فرع الطب',{exact:false})).toBeVisible();
  await expect(page.locator('.study-guide-explanation p').first()).toHaveAttribute('dir','rtl');
  await expect(page.getByText('PDF p. 1',{exact:false}).first()).toBeVisible();
  await expect(page.locator('.study-guide-understanding strong').first())
    .toHaveText('Understanding Aid — Not an additional exam fact');
  await page.locator('.learning-companion summary').nth(1).click();
  const firstMCQ=page.locator('.study-guide-mcq').first();
  await expect(firstMCQ.locator('input[type="radio"]')).toHaveCount(4);
  await firstMCQ.locator('input[type="radio"]').nth(1).check();
  await firstMCQ.getByRole('button',{name:'Reveal explanation'}).click();
  await expect(firstMCQ.locator('.study-guide-answer')).toContainText('Your answer is correct.');
});

test('Dermatology uses only source figures and never substituted clinical graphics', async ({page}) => {
  await openDermatology(page);
  await expect(page.locator('#lecture-'+lectureId+' .image-card')).toHaveCount(14);
  await expect(page.locator('#lecture-'+lectureId+' .image-card[data-original-figure-id]')).toHaveCount(14);
  await expect(page.locator('#originalFigureTools')).toBeVisible();
  await expect(page.locator('.learning-companion .study-guide-part')).toHaveCount(3);
  await page.locator('.learning-companion summary').nth(2).click();
  await expect(page.locator('.original-guide-link')).toBeVisible();
  await expect(page.locator('.study-guide-figure img')).toHaveCount(0);
  const status=await page.evaluate(id=>{
    const l=lectures.find(item=>item.id===id);
    return {images:l.imageQuestions.map(q=>q.image??null),hashes:l.imageQuestions.map(q=>q.imageSha256),pages:l.imageQuestions.map(q=>q.page),infographic:Boolean(l.studyGuide.infographic)};
  },lectureId);
  expect(status.images.every(img=>img===null)).toBe(true);
  expect(status.hashes).toHaveLength(14);
  expect(status.hashes.every(hash=>/^[a-f0-9]{64}$/.test(hash))).toBe(true);
  expect(status.pages.every(page=>/PDF p/.test(page))).toBe(true);
  expect(status.infographic).toBe(false);
});

test('Dermatology progress remains isolated from the original Surgery course', async ({page}) => {
  await page.addInitScript(()=>{
    localStorage.setItem('medicalBankStatusV2',JSON.stringify({'urology-bladder-cancer::case::bc-c01':'mastered'}));
  });
  await openDermatology(page);
  await expect(page.locator('#courseSelector')).toHaveValue('internal-medicine-ii');
  await page.locator('#courseSelector').selectOption('surgery');
  await expect(page.locator('#subjectSelector')).toHaveValue('urology');
  const preserved=await page.evaluate(async()=>{
    const data=await globalThis.MEQProgressStore.exportAll();
    return data['urology-bladder-cancer::case::bc-c01'];
  });
  expect(preserved).toBe('mastered');
  await expect(page.locator('#dataAlert')).toBeHidden();
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
  await expect(page.locator('#dataAlert')).toBeHidden();
});



test('source-only gallery has 14 printed-PDF slots and explains authenticity', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await openDermatology(page);
  await expect(page.locator('#originalFigureTools')).toBeVisible();
  await expect(page.locator('#originalFigureImportBtn')).toContainText('ZIP');
  await page.locator('.learning-companion summary').nth(2).click();
  const gallery=page.locator('.original-atlas-grid');
  await expect(gallery).toBeVisible();
  await expect(gallery.locator('.original-atlas-item')).toHaveCount(14);
  await expect(gallery.locator('.original-atlas-missing')).toHaveCount(14);
  await expect(page.locator('.image-card[data-original-figure-id]')).toHaveCount(14);
  await expect(page.locator('.study-guide-figure img')).toHaveCount(0);
  const size=await page.evaluate(()=>document.documentElement.scrollWidth);
  expect(size).toBeLessThanOrEqual(392);
});

test('rejects renamed non-source images and never incorrectly calls them original', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await openDermatology(page);
  const figure=page.locator('.image-card[data-original-figure-id="derm-image-003"]');
  await expect(figure.locator('.original-source-placeholder')).toHaveCount(1);
  await page.locator('#originalFigureFiles').setInputFiles({
    name:'derm-image-003.jpg',mimeType:'image/jpeg',buffer:readFileSync('icons/icon-192.png')
  });
  await expect(page.locator('#originalFigureStatus')).toContainText('No original source files were accepted');
  await expect(figure.locator('.source-figure-full img')).toHaveCount(0);
  await page.reload();
  await openDermatology(page);
  await expect(page.locator('.image-card[data-original-figure-id="derm-image-003"] .original-source-placeholder')).toHaveCount(1);
  await expect(page.locator('#originalFigureStatus')).toContainText('0/14 verified');
});

test('unpacks ZIP locally but rejects substituted photo bytes by SHA-256', async ({page}) => {
  await openDermatology(page);
  const filename=Buffer.from('original-figures/derm-image-003.jpg');
  // A fake JPEG envelope is used to exercise ZIP decompression. Its checksum
  // must NOT match the genuine book photograph; copyrighted photos are not in CI.
  const original=Buffer.concat([Buffer.from([0xff,0xd8,0xff]),Buffer.alloc(600,0x45)]);
  const payload=deflateRawSync(original);
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);
  local.writeUInt16LE(20,4);
  local.writeUInt16LE(8,8);
  local.writeUInt32LE(payload.length,18);
  local.writeUInt32LE(original.length,22);
  local.writeUInt16LE(filename.length,26);
  const central=Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50,0);
  central.writeUInt16LE(20,4);
  central.writeUInt16LE(20,6);
  central.writeUInt16LE(8,10);
  central.writeUInt32LE(payload.length,20);
  central.writeUInt32LE(original.length,24);
  central.writeUInt16LE(filename.length,28);
  const centralOffset=local.length+filename.length+payload.length;
  const ending=Buffer.alloc(22);
  ending.writeUInt32LE(0x06054b50,0);
  ending.writeUInt16LE(1,8);
  ending.writeUInt16LE(1,10);
  ending.writeUInt32LE(central.length+filename.length,12);
  ending.writeUInt32LE(centralOffset,16);
  const zip=Buffer.concat([local,filename,payload,central,filename,ending]);
  await page.locator('#originalFigureFiles').setInputFiles({
    name:'source-photos.zip',mimeType:'application/zip',buffer:zip
  });
  await expect(page.locator('#originalFigureStatus')).toContainText('No original source files were accepted');
  await expect(page.locator('.image-card[data-original-figure-id="derm-image-003"] .source-figure-full')).toHaveCount(0);
});


test('source-only lecture renders its image atlas without optional study guide', async ({page}) => {
  await openDermatology(page);
  await page.evaluate(id=>{
    const lecture=lectures.find(item=>item.id===id);
    if(!lecture)throw new Error('Missing tested lecture');
    delete lecture.studyGuide;
    render();
  },lectureId);
  await expect(page.locator('.learning-companion')).toBeVisible();
  await expect(page.locator('.learning-companion .study-guide-part')).toHaveCount(1);
  await page.locator('.learning-companion summary').click();
  await expect(page.locator('.original-atlas-item')).toHaveCount(14);
  await expect(page.locator('#originalFigureTools')).toBeVisible();
  await expect(page.locator('.image-card[data-original-figure-id]')).toHaveCount(14);
  await expect(page.locator('.image-section .section-head p')).toContainText('Printed original figures');
});

test('source-figure reader accepts a new ID and fingerprint supplied as lecture metadata, without hardcoded Dermatology IDs', async ({page}) => {
  await openDermatology(page);
  // A non-clinical gray canvas is created only inside this isolated browser test.
  // It is never added to source JSON, the site assets, or a real lecture.
  const fixture=await page.evaluate(async id=>{
    const canvas=document.createElement('canvas');
    canvas.width=64;canvas.height=64;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#aaaaaa';ctx.fillRect(0,0,64,64);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));
    const bytes=new Uint8Array(await blob.arrayBuffer());
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
    const lecture=lectures.find(item=>item.id===id);
    const original=lecture.imageQuestions[2];
    original.id='cross-course-original-source-fixture';
    original.imageSha256=hash;
    render();
    return {base64:btoa(String.fromCharCode(...bytes)),hash};
  },lectureId);
  expect(fixture.hash).toMatch(/^[a-f0-9]{64}$/);
  const sourceId='cross-course-original-source-fixture';
  const card=page.locator('.image-card[data-original-figure-id="'+sourceId+'"]');
  await expect(card.locator('.original-source-placeholder')).toHaveCount(1);
  await page.locator('#originalFigureFiles').setInputFiles({
    name:sourceId+'.jpg',mimeType:'image/jpeg',buffer:Buffer.from(fixture.base64,'base64')
  });
  await expect(card.locator('.source-figure-full img')).toBeVisible();
  await expect(card).toHaveAttribute('data-visual-source','original-pdf');
  await expect(page.locator('#originalFigureStatus')).toContainText('1/14 verified');

  // Switching medical courses must reclaim temporary Blob URLs but retain
  // the verified original photo in durable IndexedDB for the next visit.
  await page.locator('#courseSelector').selectOption('surgery');
  await expect(page.locator('#originalFigureTools')).toBeHidden();
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
  await expect(page.locator('#lectureFilter option[value="'+lectureId+'"]')).toHaveCount(1);
  await page.locator('#lectureFilter').selectOption(lectureId);
  await expect(page.locator('.image-card[data-original-figure-id="'+sourceId+'"] .source-figure-full img')).toBeVisible();
  await expect(page.locator('#originalFigureStatus')).toContainText('1/14 verified');
});

test('original-photo importer is collapsed while reading, opens with keyboard, and keeps the status visible', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await openDermatology(page);
  const original=page.locator('#originalFigureTools');
  await expect(original).toBeVisible();
  await expect(original).not.toHaveAttribute('open','');
  await expect(original.locator('#originalFigureStatus')).toContainText('0/14 verified');
  await expect(page.locator('#originalFigureImportBtn')).toBeHidden();
  const summary=original.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(original).toHaveAttribute('open','');
  await expect(page.locator('#originalFigureImportBtn')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(original).not.toHaveAttribute('open','');
  const widths=await page.evaluate(()=>({
    page:document.documentElement.scrollWidth,
    viewport:document.documentElement.clientWidth
  }));
  expect(widths.page).toBeLessThanOrEqual(widths.viewport+1);
});
