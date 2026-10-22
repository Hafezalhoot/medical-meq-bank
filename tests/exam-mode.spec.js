import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

const derm='internal-medicine-ii-dermatology-introduction';

async function openExam(page,course='internal-medicine-ii'){
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#examModeBtn')).toBeVisible();
  if(course==='internal-medicine-ii'){
    await page.locator('#courseSelector').selectOption(course);
    await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
    await expect(page.locator('#lectureFilter option[value="'+derm+'"]')).toHaveCount(1,{timeout:15000});
  }
  await page.locator('#examModeBtn').click();
  await expect(page.locator('#examDialog')).toBeVisible();
  await expect(page.locator('#examSetup')).toBeVisible();
}

async function questionKey(page){
  return page.locator('#examQuestionHeading').textContent();
}

async function currentMcq(page){
  const question=await questionKey(page);
  return page.evaluate(({question,derm})=>{
    const lecture=lectures.find(item=>item.id===derm);
    return lecture.studyGuide.mcqs.find(item=>item.question===question);
  },{question,derm});
}

test('exam instantly marks wrong source-authored MCQ Weak, locks answer and shows rationale',async({page})=>{
  await openExam(page);
  await page.locator('#examFormat').selectOption('mcq');
  await page.locator('#examCount').selectOption('10');
  await page.locator('#examBegin').click();
  await expect(page.locator('#examQuestionHeading')).toBeVisible();
  const mcq=await currentMcq(page);
  expect(mcq).toBeTruthy();
  const wrong=(mcq.answerIndex+1)%mcq.options.length;
  await page.locator('.exam-option[data-choice="'+wrong+'"]').click();
  await expect(page.locator('#examFeedback')).toContainText('Incorrect · Weak');
  await expect(page.locator('#examFeedback')).toContainText(mcq.options[mcq.answerIndex]);
  await expect(page.locator('#examFeedback')).toContainText(mcq.rationale);
  for(const option of await page.locator('.exam-option').all())await expect(option).toBeDisabled();
  const rated=await page.evaluate(({derm,id})=>{
    const value=key(derm,'mcq',id);
    return {value:state[value],button:document.querySelector('.study-guide-mcq .status.weak')?.classList.contains('active')};
  },{derm,id:mcq.id});
  expect(rated.value).toBe('weak');
  const stored=await page.evaluate(async({derm,id})=>{
    const saved=await globalThis.MEQProgressStore.exportAll();
    return saved[key(derm,'mcq',id)];
  },{derm,id:mcq.id});
  expect(stored).toBe('weak');
  await page.locator('#examClose').click();
  await expect(page.locator('#myReviewCount')).toContainText('1 to revisit');
});

test('correct MCQ is automatically Mastered and completed exam separates auto and self marks',async({page})=>{
  await openExam(page);
  await page.locator('#examFormat').selectOption('mcq');
  await page.locator('#examBegin').click();
  const mcq=await currentMcq(page);
  await page.locator('.exam-option[data-choice="'+mcq.answerIndex+'"]').click();
  await expect(page.locator('#examFeedback')).toContainText('Correct · Mastered');
  await expect.poll(()=>page.evaluate(({derm,id})=>state[key(derm,'mcq',id)],{derm,id:mcq.id})).toBe('mastered');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#examFinish').click();
  await expect(page.locator('#examResults')).toBeVisible();
  await expect(page.locator('#examResultContent')).toContainText('Auto MCQ accuracy');
  await expect(page.locator('#examResultContent')).toContainText('100%');
  await expect(page.locator('#examRetry')).toBeDisabled();
});

test('written clinical exam reveals model answer then self-rating Weak with no invented choice scoring',async({page})=>{
  await openExam(page,'surgery');
  await page.locator('#examFormat').selectOption('written');
  await page.locator('#examScope').selectOption('lecture');
  await page.locator('#examCount').selectOption('10');
  await page.locator('#examBegin').click();
  await expect(page.locator('#examQuestionHeading')).toBeVisible();
  await expect(page.locator('.exam-option')).toHaveCount(0);
  await page.getByRole('button',{name:'Reveal model answer'}).click();
  await expect(page.locator('.exam-model')).toBeVisible();
  await page.getByRole('button',{name:'Needs review · Weak'}).click();
  await expect(page.locator('#examFeedback')).toContainText('Self-rated Weak');
  await expect(page.locator('.exam-option')).toHaveCount(0);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#examFinish').click();
  await expect(page.locator('#examResultContent')).toContainText('Self-graded correct');
  await expect(page.locator('#examRetry')).toBeEnabled();
  await page.locator('#examRetry').click();
  await expect(page.locator('#examPosition')).toHaveText('Question 1 / 1');
});

test('unfinished attempt survives reload and expired time does not mark unanswered questions Weak',async({page})=>{
  await openExam(page);
  await page.locator('#examFormat').selectOption('mcq');
  await page.locator('#examDuration').selectOption('10');
  await page.locator('#examCount').selectOption('10');
  await page.locator('#examBegin').click();
  await expect(page.locator('#examQuestionHeading')).toBeVisible();
  const before=await questionKey(page);
  await page.locator('#examClose').click();
  await page.reload();
  await page.locator('#examModeBtn').click();
  await expect(page.locator('#examQuestionHeading')).toHaveText(before);
  await expect(page.locator('#examTimer')).toContainText(':');
  await page.evaluate(()=>{
    const key='medicalBankExamSessionV1';
    const saved=JSON.parse(localStorage.getItem(key));
    saved.deadline=Date.now()-3000;
    localStorage.setItem(key,JSON.stringify(saved));
  });
  await page.locator('#examClose').click();
  await page.reload();
  await page.locator('#examModeBtn').click();
  await expect(page.locator('#examResults')).toBeVisible();
  await expect(page.locator('#examResultContent')).toContainText('0 / 10');
  await expect(page.locator('#examResultContent')).toContainText('Time is up');
});

test('320px exam is keyboard-usable without horizontal overflow or hidden close action',async({page},testInfo)=>{
  await page.setViewportSize({width:320,height:720});
  await openExam(page);
  await testInfo.attach('exam-setup-320px',{body:await page.screenshot(),contentType:'image/png'});
  const dimensions=await page.evaluate(()=>{
    const modal=document.getElementById('examDialog').getBoundingClientRect();
    return {width:modal.width,screen:innerWidth,scroll:document.getElementById('examDialog').scrollWidth};
  });
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.screen);
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.screen+1);
  await expect(page.locator('#examClose')).toBeVisible();
  await page.locator('#examFormat').selectOption('mcq');
  await page.locator('#examBegin').click();
  await expect(page.locator('.exam-option')).toHaveCount(4);
  const hasPlaceholder=await page.locator('.exam-option').evaluateAll(options=>options.some(option=>
    [...option.childNodes].some(child=>child.nodeType===3&&child.textContent.trim()==='null')));
  expect(hasPlaceholder).toBe(false);
  await testInfo.attach('exam-question-320px',{body:await page.screenshot(),contentType:'image/png'});
  await page.locator('.exam-option').first().focus();
  await page.keyboard.press('1');
  await expect(page.locator('#examFeedback')).not.toBeHidden();
});

test('MCQ-only mode refuses lectures with no verified MCQs rather than fabricating distractors',async({page})=>{
  await openExam(page,'surgery');
  await page.locator('#examFormat').selectOption('mcq');
  await page.locator('#examBegin').click();
  await expect(page.locator('#examAlert')).toContainText('no source-verified MCQs');
  await expect(page.locator('#examResults')).toBeHidden();
});

test('change exam confirms unsaved attempt replacement and preserves Weak progress across reload',async({page})=>{
  await openExam(page);
  await page.locator('#examFormat').selectOption('mcq');
  await page.locator('#examBegin').click();
  const item=await currentMcq(page);
  const wrong=(item.answerIndex+1)%item.options.length;
  await page.locator('.exam-option[data-choice="'+wrong+'"]').click();
  await expect(page.locator('#examFeedback')).toContainText('Incorrect · Weak');
  await expect(page.locator('#examChange')).toBeVisible();
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('#examChange').click();
  await expect(page.locator('#examPlay')).toBeVisible();
  await expect(page.locator('#examFeedback')).toContainText('Incorrect · Weak');

  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#examChange').click();
  await expect(page.locator('#examSetup')).toBeVisible();
  await expect(page.locator('#examBegin')).toBeFocused();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('medicalBankExamSessionV1')))).toBeNull();

  await page.reload();
  await page.locator('#examModeBtn').click();
  await expect(page.locator('#examSetup')).toBeVisible();
  const progress=await page.evaluate(async id=>{
    const rows=await globalThis.MEQProgressStore.exportAll();
    return Object.entries(rows).find(([k])=>k.endsWith('::mcq::'+id))?.[1];
  },item.id);
  expect(progress).toBe('weak');
});

test('a blocked local exam session save warns visibly without losing the independently saved Weak rating',async({page})=>{
  await openExam(page);
  await page.locator('#examFormat').selectOption('mcq');
  await page.locator('#examBegin').click();
  const item=await currentMcq(page);
  await page.evaluate(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==='medicalBankExamSessionV1')throw new DOMException('Storage is full','QuotaExceededError');
      return original.call(this,key,value);
    };
  });
  await page.locator('.exam-option[data-choice="'+((item.answerIndex+1)%item.options.length)+'"]').click();
  await expect(page.locator('#examFeedback')).toContainText('Incorrect · Weak');
  await expect(page.locator('#examAlert')).toBeVisible();
  await expect(page.locator('#examAlert')).toContainText('could not be saved for reload');
  const progress=await page.evaluate(async id=>{
    const rows=await globalThis.MEQProgressStore.exportAll();
    return Object.entries(rows).find(([k])=>k.endsWith('::mcq::'+id))?.[1];
  },item.id);
  expect(progress).toBe('weak');
});
