import {test, expect} from '@playwright/test';
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {deepStrictEqual} from 'node:assert';
import {execFileSync} from 'node:child_process';

test.use({serviceWorkers:'block'});
const baseline=JSON.parse(readFileSync('tests/fixtures/study-baseline.json','utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
function snapshot(){
  const catalog=JSON.parse(readFileSync('lectures/catalog.json','utf8'));
  const payloads={}, identities=[]; let mcqs=0;
  for(const entry of catalog.lectures){
    const bytes=readFileSync(join('lectures',entry.file)), lecture=JSON.parse(bytes);
    payloads[lecture.id]=hash(bytes);
    expect(JSON.parse(readFileSync(join('dist/lectures',entry.file),'utf8'))).toEqual({...lecture, schemaVersion:entry.schemaVersion, courseId:entry.courseId, canonicalId:entry.courseId+'/'+lecture.subjectKey+'/'+lecture.id});
    mcqs+=lecture.studyGuide?.mcqs?.length||0;
    for(const [key,type] of Object.entries({cases:'case',coreShorts:'core',imageQuestions:'image',detailedShorts:'extra'}))
      for(const item of lecture[key]||[])identities.push([entry.courseId,lecture.subjectKey,lecture.id,type,item.id].join('::'));
    for(const item of lecture.studyGuide?.mcqs||[])
      identities.push([entry.courseId,lecture.subjectKey,lecture.id,'mcq',item.id,item.answerIndex].join('::'));
  }
  const assets=readdirSync('assets/lectures',{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile()).map(entry=>join(entry.parentPath,entry.name)).sort()
    .map(path=>[path,hash(readFileSync(path))]);
  return {publishedLectures:catalog.lectures.length,mcqs,
    payloads:Object.fromEntries(Object.entries(payloads).sort()),
    identityHash:hash(JSON.stringify(identities.sort())),originalAssetsHash:hash(JSON.stringify(assets))};
}

test('R00 preserves all baseline lecture bytes, item identities, MCQ keys and source media',()=>{
  const {sourceSha,...expected}=baseline;
  deepStrictEqual(snapshot(),expected);
  // The existing validator additionally normalizes embedded offline photographs
  // before comparing the full standalone lecture bank to the source JSON.
  execFileSync('python3',['scripts/validate_build.py'],{stdio:'pipe'});
});

test('R00 rejects a changed disposable baseline without editing clinical source',()=>{
  const actual=snapshot(),mutated=structuredClone(actual);
  mutated.payloads['urology-bladder-cancer']='0'.repeat(64);
  expect(()=>deepStrictEqual(actual,mutated)).toThrow();
  mutated.payloads=actual.payloads;mutated.identityHash='0'.repeat(64);
  expect(()=>deepStrictEqual(actual,mutated)).toThrow();
});

test('R00 preserves saved grades and a real unfinished exam through workspace navigation and reload',async({page})=>{
  await page.goto('/#/exams');
  await page.evaluate(async()=>{await globalThis.MEQProgressStore.ready;});
  const ratings={'v2::surgery::urology::urology-bladder-cancer::core::synthetic-preservation':'review'};
  await page.evaluate(async value=>globalThis.MEQProgressStore.replaceAll(value),ratings);
  await page.locator('#workspaceExamStart').click();
  await page.locator('#examFormat').selectOption('written');
  await page.locator('#examCount').selectOption('10');
  await page.locator('#examBegin').click();
  await expect(page.locator('#examQuestionHeading')).toBeVisible();
  const saved=await page.evaluate(()=>localStorage.getItem('medicalBankExamSessionV1'));
  expect(JSON.parse(saved).questions.length).toBeGreaterThan(0);
  await page.locator('#examClose').click();
  for(const view of ['library','review','exams']){
    await page.getByRole('navigation',{name:'Primary workspace'}).getByRole('link',{name:view==='library'?'Library':view==='review'?'Review':'Exams',exact:true}).click();
    await expect(page.locator('body')).toHaveAttribute('data-workspace',view);
  }
  await page.reload();
  await page.evaluate(async()=>{await globalThis.MEQProgressStore.ready;});
  expect(await page.evaluate(()=>localStorage.getItem('medicalBankExamSessionV1'))).toBe(saved);
  expect(await page.evaluate(()=>globalThis.MEQProgressStore.exportAll())).toEqual(ratings);
});
