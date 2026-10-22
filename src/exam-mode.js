/* Medical MEQ Exam Mode: only source-authored MCQs are automatically graded.
   Written/clinical questions require the student's explicit self-assessment. */
(() => {
  'use strict';
  const dialog=document.getElementById('examDialog');
  const launcher=document.getElementById('examModeBtn');
  const root=document.getElementById('examRoot');
  if(!dialog||!launcher||!root)return;

  const SESSION='medicalBankExamSessionV1';
  const HISTORY='medicalBankExamHistoryV1';
  const REVIEW_LOG='medicalBankReviewLogV1';
  const DAILY_LIMIT=15;
  const TYPES={mcq:'Source MCQ',case:'Clinical MEQ',core:'Short question',image:'Image / spot',extra:'Detailed practice'};
  const allowedTypes=new Set(Object.keys(TYPES));
  const el=id=>document.getElementById(id);
  const node=(tag,cls,text)=>{
    const item=document.createElement(tag);
    if(cls)item.className=cls;
    if(text!==undefined&&text!==null)item.textContent=String(text);
    return item;
  };
  const appendText=(parent,tag,cls,value)=>{
    const item=node(tag,cls,value);
    item.dir='auto';
    parent.append(item);
    return item;
  };
  const safelyParse=(k)=>{
    try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}
  };
  const safelyWrite=(k,value)=>{
    try{localStorage.setItem(k,JSON.stringify(value));return true}catch{return false}
  };
  const identifier=q=>q.lectureId+'::'+q.type+'::'+q.id;
  const validQuestion=q=>Boolean(q&&typeof q.lectureId==='string'&&typeof q.id==='string'&&allowedTypes.has(q.type));
  // One compact, backed-up activity record per source question; never copy medical answers.
  const readReviewLog=()=>{
    const saved=safelyParse(REVIEW_LOG);
    if(!saved||typeof saved!=='object'||Array.isArray(saved))return {};
    return Object.fromEntries(Object.entries(saved).filter(([id,record])=>
      typeof id==='string'&&id.length<320&&record&&typeof record==='object'&&!Array.isArray(record)&&
      typeof record.lectureId==='string'&&typeof record.id==='string'&&allowedTypes.has(record.type)
    ).slice(0,500));
  };
  const writeReviewLog=log=>safelyWrite(REVIEW_LOG,Object.fromEntries(
    Object.entries(log).sort((a,b)=>(Number(b[1].lastSeen)||0)-(Number(a[1].lastSeen)||0)).slice(0,500)
  ));
  const recordAnswer=(q,correct,manual)=>{
    const log=readReviewLog(),id=identifier(q),old=log[id]||{},now=Date.now();
    log[id]={
      lectureId:q.lectureId,type:q.type,id:q.id,
      courseId:q.courseId||session?.course||old.courseId||'',
      subjectKey:q.subjectKey||session?.subject||old.subjectKey||'',
      lastSeen:now,attempts:Math.min(9999,(Number(old.attempts)||0)+1),
      mistakes:Math.min(9999,(Number(old.mistakes)||0)+(correct?0:1)),
      lastMistake:correct?Number(old.lastMistake)||0:now,
      lastWrongKind:correct?old.lastWrongKind||'':(manual?'self':'auto')
    };
    return writeReviewLog(log);
  };
  const history=()=>{
    const saved=safelyParse(HISTORY);
    return Array.isArray(saved)?saved.filter(x=>x&&Number.isFinite(x.answered)).slice(0,12):[];
  };
  const savedSession=safelyParse(SESSION);
  let session=savedSession&&savedSession.schema===1&&Array.isArray(savedSession.questions)&&
      savedSession.questions.length<=100&&savedSession.questions.every(validQuestion)&&
      savedSession.answers&&typeof savedSession.answers==='object'&&!Array.isArray(savedSession.answers)
        ?savedSession:null;
  if(session&&(!Number.isInteger(session.index)||session.index<0||session.index>=session.questions.length))session.index=0;
  let busy=false;
  let clock=null;

  root.innerHTML=[
    '<header class="exam-header"><div><span class="exam-eyebrow">MEQ · ASSESSMENT SPACE</span>',
    '<h2 id="examTitle">Exam mode</h2><p>Source-verified answers. Real revision progress.</p></div>',
    '<button type="button" class="exam-close" id="examClose" aria-label="Save and close exam">Save &amp; close <span aria-hidden="true">×</span></button></header>',
    '<div id="examAlert" class="exam-alert" role="alert" hidden></div>',
    '<section id="examSetup" class="exam-setup" aria-label="Set up exam">',
    '<p class="exam-intro">Choose a lecture or specialty. MCQs are checked immediately; descriptive questions are graded only after you compare your answer with the source model answer.</p>',
    '<div class="exam-settings">',
    '<label>Question source<select id="examScope"><option value="lecture">Selected lecture</option><option value="subject">Entire specialty</option></select></label>',
    '<label>Question format<select id="examFormat"><option value="mixed">Smart mix · MCQ + written</option><option value="mcq">MCQs · auto graded</option><option value="written">MEQ / shorts · self graded</option></select></label>',
    '<label>Number of questions<select id="examCount"><option value="10">10 questions</option><option value="20" selected>20 questions</option><option value="30">30 questions</option><option value="50">50 questions</option></select></label>',
    '<label>Time limit<select id="examDuration"><option value="0">No timer</option><option value="10">10 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select></label>',
    '</div><label class="exam-check"><input id="examWeakOnly" type="checkbox"><span>Focus on saved Weak / Review questions only</span></label>',
    '<p class="exam-disclaimer">Automatic scoring is available only for MCQs whose correct answers are present in the uploaded lecture. No distractors or clinical answers are generated.</p>',
    '<div class="exam-setup-actions"><button id="examBegin" type="button" class="exam-primary">Start exam</button>',
    '<button id="examResume" type="button" class="exam-secondary" hidden>Resume saved exam</button></div>',
    '<p id="examHistory" class="exam-history" aria-live="polite"></p></section>',
    '<section id="examPlay" class="exam-play" aria-label="Exam questions" hidden>',
    '<div class="exam-progress"><div><strong id="examPosition">Question 1</strong><span id="examCounts"></span></div><strong id="examTimer" class="exam-timer" aria-live="off">Untimed</strong></div>',
    '<div class="exam-track" role="progressbar" aria-label="Questions answered" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="examProgress"><span id="examProgressFill"></span></div>',
    '<div id="examQuestion" class="exam-question"></div>',
    '<div id="examFeedback" class="exam-feedback" role="status" aria-live="polite" hidden></div>',
    '<nav class="exam-nav" aria-label="Exam navigation"><button id="examPrevious" class="exam-secondary" type="button">Previous</button>',
    '<button id="examNext" class="exam-primary" type="button">Next question</button>',
    '<button id="examChange" class="exam-secondary" type="button">Change exam</button>',
    '<button id="examFinish" class="exam-secondary" type="button">Finish exam</button></nav></section>',
    '<section id="examResults" class="exam-results" aria-label="Exam results" hidden>',
    '<div id="examResultContent"></div><div class="exam-result-actions">',
    '<button id="examRetry" type="button" class="exam-primary">Retry missed questions</button>',
    '<button id="examNew" type="button" class="exam-secondary">New exam</button>',
    '<button id="examViewNotebook" type="button" class="exam-secondary">Mistake notebook</button></div></section>',
    '<section id="examNotebook" class="exam-notebook" aria-label="Mistake notebook" hidden>',
    '<h3>Mistake notebook</h3><p class="exam-intro">Your missed source MCQs and written questions marked Needs review. The first mistake stays recorded after a correct retry; manual Weak ratings also remain in My Review.</p>',
    '<div class="exam-notebook-tools"><label>Show<select id="examNotebookFilter"><option value="all">All recorded mistakes</option><option value="weak">Still Weak / Review</option><option value="mastered">Now Mastered</option></select></label>',
    '<button id="examNotebookBack" type="button" class="exam-secondary">Back to study</button></div>',
    '<p id="examNotebookSummary" role="status" aria-live="polite"></p><div id="examNotebookList" class="exam-notebook-list"></div></section>'
  ].join('');

  const showPanel=kind=>{
    for(const id of ['examSetup','examPlay','examResults','examNotebook'])el(id).hidden=id!==kind;
    el('examTitle').textContent=kind==='examNotebook'?'Mistake notebook':session?.daily?'Daily Weak 15':'Exam mode';
    el('examAlert').hidden=true;
  };
  const alertUser=text=>{
    el('examAlert').textContent=text;
    el('examAlert').hidden=!text;
  };
  const persist=()=>safelyWrite(SESSION,session);
  const lectureFor=q=>lectures.find(l=>l.id===q.lectureId&&!l.__metadataOnly);
  const sourceFor=q=>{
    const lecture=lectureFor(q);
    if(!lecture)return null;
    const group=q.type==='mcq'?lecture.studyGuide?.mcqs:
      ({case:lecture.cases,core:lecture.coreShorts,image:lecture.imageQuestions,extra:lecture.detailedShorts})[q.type];
    const item=Array.isArray(group)?group.find(x=>x.id===q.id):null;
    if(!item)return null;
    if(q.type==='mcq'&&(!Array.isArray(item.options)||item.options.length<2||
       !Number.isInteger(item.answerIndex)||item.answerIndex<0||item.answerIndex>=item.options.length))return null;
    return {lecture,item};
  };
  const selectedLectureId=()=>el('lectureFilter')?.value||'';
  const previewScope=()=>{
    const current=selectedLectureId();
    const currentOption=el('examScope').querySelector('option[value="lecture"]');
    const allowed=current&&current!=='all';
    currentOption.disabled=!allowed;
    currentOption.textContent=allowed?'Selected lecture · '+(lectures.find(l=>l.id===current)?.title||current):'Select a lecture first';
    if(!allowed)el('examScope').value='subject';
  };
  const shuffle=items=>{
    const list=items.slice();
    for(let index=list.length-1;index>0;index--){
      const other=Math.floor(Math.random()*(index+1));
      [list[index],list[other]]=[list[other],list[index]];
    }
    return list;
  };
  const cardPool=lecture=>{
    const items=[];
    const add=(type,rows)=>{
      if(!Array.isArray(rows))return;
      for(const item of rows){
        if(!item?.id)continue;
        if(type==='mcq'&&(!Array.isArray(item.options)||item.options.length<2||
           !Number.isInteger(item.answerIndex)||item.answerIndex<0||item.answerIndex>=item.options.length))continue;
        items.push({lectureId:lecture.id,type,id:item.id});
      }
    };
    add('mcq',lecture.studyGuide?.mcqs);
    add('case',lecture.cases);
    add('core',lecture.coreShorts);
    add('image',lecture.imageQuestions);
    add('extra',lecture.detailedShorts);
    return items;
  };
  const selectPool=(pool,format,maximum)=>{
    const mcq=shuffle(pool.filter(q=>q.type==='mcq'));
    const written=shuffle(pool.filter(q=>q.type!=='mcq'));
    const count=Math.min(maximum,pool.length);
    if(format==='mcq')return mcq.slice(0,count);
    if(format==='written')return written.slice(0,count);
    const mcqCount=Math.min(mcq.length,Math.ceil(count/2));
    const selected=mcq.slice(0,mcqCount).concat(written.slice(0,count-mcqCount));
    if(selected.length<count)selected.push(...mcq.slice(mcqCount,mcqCount+count-selected.length));
    return shuffle(selected);
  };
  const saveLevel=async(q,level)=>{
    const canonical=key(q.lectureId,q.type,q.id);
    const previous=state[canonical];
    try{
      const store=globalThis.MEQProgressStore;
      if(store?.set)await store.set(canonical,level);
      else{
        state[canonical]=level;
        if(!safelyWrite('medicalBankStatusV2',state))throw new Error('Local storage unavailable');
      }
    }catch(error){
      if(previous)state[canonical]=previous;else delete state[canonical];
      updateStatus();
      alertUser('Your answer was not saved. Check browser storage settings, then choose again.');
      return false;
    }
    updateStatus();
    document.dispatchEvent(new CustomEvent('meq:exam-rating-changed',{detail:{key:canonical,level}}));
    return true;
  };
  const current=()=>session?.questions?.[session.index];
  const answerFor=q=>session?.answers?.[identifier(q)];
  const answeredCount=()=>session.questions.filter(q=>Boolean(answerFor(q))).length;
  const score=()=>{
    const auto=session.questions.filter(q=>q.type==='mcq'&&Boolean(answerFor(q)));
    const correct=auto.filter(q=>answerFor(q).correct).length;
    const self=session.questions.filter(q=>q.type!=='mcq'&&Boolean(answerFor(q)));
    const selfKnown=self.filter(q=>answerFor(q).correct).length;
    return {auto:auto.length,correct,self:self.length,selfKnown,answered:answeredCount(),
      wrong:session.questions.filter(q=>answerFor(q)?.correct===false).length};
  };
  const deadline=()=>Number(session?.deadline)||0;
  const timeRemaining=()=>deadline()?Math.max(0,deadline()-Date.now()):null;
  const timerText=()=>{
    const ms=timeRemaining();
    if(ms===null)return 'Untimed';
    const seconds=Math.ceil(ms/1000);
    return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  };
  const refreshTimer=()=>{
    if(!session||session.finished||!dialog.open)return;
    el('examTimer').textContent=timerText();
    if(deadline()&&timeRemaining()===0)finish(true);
  };
  const startClock=()=>{
    if(clock)clearInterval(clock);
    clock=setInterval(refreshTimer,1000);
    refreshTimer();
  };
  const stopClock=()=>{if(clock)clearInterval(clock);clock=null};

  const modelAnswer=(parent,q,source)=>{
    const item=source.item;
    const lines=q.type==='case'||q.type==='image'?item.answer:
      Array.isArray(item.a)?item.a:[item.a];
    appendText(parent,'h4','exam-answer-title','Model answer · source based');
    const list=node('ul','exam-answer-list');
    (Array.isArray(lines)?lines:[lines]).filter(x=>x!=null).forEach(line=>appendText(list,'li','',line));
    parent.append(list);
    if(q.type==='case'&&Array.isArray(item.marking)&&item.marking.length){
      appendText(parent,'h4','exam-answer-title','Suggested marking scheme');
      const marks=node('ul','exam-answer-list');
      item.marking.forEach(x=>appendText(marks,'li','',x));
      parent.append(marks);
    }
  };
  const imageFor=(parent,item)=>{
    if(!item.image)return;
    const src=String(item.image);
    let safe=false;
    try{const u=new URL(src,location.href);safe=u.origin===location.origin||src.startsWith('data:image/')}catch{}
    if(!safe)return;
    const img=node('img','exam-figure');
    img.src=src;
    img.alt='Original lecture figure: '+(item.title||'Image question');
    img.loading='lazy';
    img.decoding='async';
    img.addEventListener('error',()=>img.replaceWith(node('p','exam-image-fallback','Source image is unavailable on this device. Open the lecture to inspect the original image.')),{once:true});
    parent.append(img);
  };
  const currentHeading=(q,source)=>{
    const item=source.item;
    return q.type==='mcq'?item.question:
      q.type==='case'||q.type==='image'?(item.title||item.prompt||'Clinical question'):item.q;
  };
  const answeredFeedback=(q,source)=>{
    const result=answerFor(q);
    if(!result){el('examFeedback').hidden=true;return}
    const box=el('examFeedback');
    box.className='exam-feedback '+(result.correct?'is-correct':'is-wrong');
    box.replaceChildren();
    appendText(box,'strong','',result.manual
      ?(result.correct?'Self-rated Mastered ✓':'Self-rated Weak ✕')
      :(result.correct?'Correct · Mastered ✓':'Incorrect · Weak ✕'));
    if(q.type==='mcq'){
      appendText(box,'p','',result.correct?'Your answer matches the lecture key.':'Correct answer: '+source.item.options[source.item.answerIndex]);
      if(source.item.rationale)appendText(box,'p','exam-rationale',source.item.rationale);
      if(source.item.sourcePage)appendText(box,'small','',source.item.sourcePage);
    }else appendText(box,'p','',result.correct?'You marked your written answer as correct.':'You marked this item for review. It is saved as Weak.');
    box.hidden=false;
  };
  const renderQuestion=()=>{
    if(!session||session.finished)return showResults();
    showPanel('examPlay');
    if(deadline()&&timeRemaining()===0)return finish(true);
    const q=current(),source=sourceFor(q);
    if(!source){alertUser('A lecture question changed or could not be loaded. Finish this attempt and start a fresh exam.');return}
    const result=answerFor(q),item=source.item;
    const completed=answeredCount();
    el('examPosition').textContent='Question '+(session.index+1)+' / '+session.questions.length;
    el('examCounts').textContent=completed+' answered · '+(session.questions.length-completed)+' remaining';
    el('examProgress').setAttribute('aria-valuenow',String(Math.round(completed/session.questions.length*100)));
    el('examProgressFill').style.width=(100*completed/session.questions.length)+'%';
    el('examTimer').textContent=timerText();
    const area=el('examQuestion');area.replaceChildren();
    const meta=node('div','exam-question-meta');
    appendText(meta,'span','',TYPES[q.type]+' · '+source.lecture.title);
    if(item.sourcePage)appendText(meta,'span','',item.sourcePage);
    else if(item.page)appendText(meta,'span','', 'Lecture page '+item.page);
    area.append(meta);
    const heading=appendText(area,'h3','exam-prompt',currentHeading(q,source));
    heading.id='examQuestionHeading';
    if(q.type==='case'){
      appendText(area,'p','exam-case-scenario',item.scenario);
      if(item.ar)appendText(area,'p','exam-case-ar',item.ar);
      if(Array.isArray(item.questions)&&item.questions.length){
        const ol=node('ol','exam-subquestions');item.questions.forEach(text=>appendText(ol,'li','',text));area.append(ol);
      }
    }else if(q.type==='image'){
      imageFor(area,item);
      if(item.prompt)appendText(area,'p','',item.prompt);
      if(Array.isArray(item.questions)&&item.questions.length){
        const ol=node('ol','exam-subquestions');item.questions.forEach(text=>appendText(ol,'li','',text));area.append(ol);
      }
    }
    if(q.type==='mcq'){
      const options=node('div','exam-options');
      options.setAttribute('role','group');
      options.setAttribute('aria-label','Choose one answer');
      item.options.forEach((option,index)=>{
        const b=node('button','exam-option',null);
        b.type='button';
        b.dataset.choice=String(index);
        b.disabled=Boolean(result);
        b.setAttribute('aria-pressed',String(result?.choice===index));
        const mark=node('span','exam-option-letter',String.fromCharCode(65+index));
        mark.setAttribute('aria-hidden','true');
        const optionText=node('span','exam-option-text',option);optionText.dir='auto';
        b.append(mark,optionText);
        if(result){
          if(index===item.answerIndex)b.classList.add('is-correct');
          else if(index===result.choice)b.classList.add('is-wrong');
        }
        b.addEventListener('click',()=>void chooseMCQ(index));
        options.append(b);
      });
      area.append(options);
      if(!result)appendText(area,'p','exam-guidance','Choose one answer to check it instantly. Your first choice is final for this attempt.');
    }else{
      if(!result){
        appendText(area,'p','exam-guidance','Try answering without looking. Written answers cannot be auto-graded reliably.');
        const reveal=node('button','exam-secondary exam-reveal','Reveal model answer');
        reveal.type='button';
        const answer=node('div','exam-model');answer.hidden=true;
        modelAnswer(answer,q,source);
        const grade=node('div','exam-selfgrade');grade.hidden=true;
        const know=node('button','exam-primary','I got it · Mastered');
        const weak=node('button','exam-secondary','Needs review · Weak');
        know.type=weak.type='button';
        know.addEventListener('click',()=>void gradeWritten(true));
        weak.addEventListener('click',()=>void gradeWritten(false));
        grade.append(know,weak);
        reveal.addEventListener('click',()=>{answer.hidden=false;grade.hidden=false;reveal.hidden=true;know.focus()});
        area.append(reveal,answer,grade);
      }else{
        const answer=node('div','exam-model');modelAnswer(answer,q,source);area.append(answer);
      }
    }
    answeredFeedback(q,source);
    el('examPrevious').disabled=session.index===0;
    el('examNext').disabled=session.index===session.questions.length-1;
    el('examNext').textContent=session.index===session.questions.length-1?'Last question':'Next question';
  };
  const chooseMCQ=async index=>{
    const q=current(),source=sourceFor(q);
    if(busy||!q||q.type!=='mcq'||answerFor(q)||!source||!Number.isInteger(index))return;
    if(index<0||index>=source.item.options.length)return;
    busy=true;
    const correct=index===source.item.answerIndex;
    const saved=await saveLevel(q,correct?'mastered':'weak');
    let retained=true;
    if(saved){
      session.answers[identifier(q)]={choice:index,correct,manual:false,at:Date.now()};
      retained=persist();
    }
    busy=false;
    if(saved){
      const recorded=recordAnswer(q,correct,false);
      renderQuestion();
      if(!retained)alertUser('Exam session could not be saved for reload. Ratings remain in the study-progress store.');
      else if(!recorded)alertUser('Your rating was saved, but mistake history could not be updated. Check browser storage.');
    }
  };
  const gradeWritten=async correct=>{
    const q=current();
    if(busy||!q||q.type==='mcq'||answerFor(q))return;
    busy=true;
    const saved=await saveLevel(q,correct?'mastered':'weak');
    let retained=true;
    if(saved){
      session.answers[identifier(q)]={correct,manual:true,at:Date.now()};
      retained=persist();
    }
    busy=false;
    if(saved){
      const recorded=recordAnswer(q,correct,true);
      renderQuestion();
      if(!retained)alertUser('Exam session could not be saved for reload. Ratings remain in the study-progress store.');
      else if(!recorded)alertUser('Your rating was saved, but mistake history could not be updated. Check browser storage.');
    }
  };
  const recordHistory=()=>{
    const data=score();
    const entry={date:new Date().toISOString(),subject:session.subject,
      questions:session.questions.length,answered:data.answered,
      correct:data.correct,auto:data.auto,self:data.self,selfKnown:data.selfKnown,
      wrong:data.wrong,timedOut:Boolean(session.timedOut)};
    safelyWrite(HISTORY,[entry,...history()].slice(0,12));
  };
  const finish=timedOut=>{
    if(!session||session.finished)return;
    session.finishedAt=Date.now();
    session.finished=true;
    session.timedOut=Boolean(timedOut);
    persist();
    recordHistory();
    stopClock();
    if(dialog.open)showResults();
  };
  const showResults=()=>{
    if(!session)return showSetup();
    showPanel('examResults');
    const results=el('examResultContent');results.replaceChildren();
    const count=score();
    appendText(results,'span','exam-eyebrow','EXAM COMPLETED');
    appendText(results,'h3','exam-result-title',session.timedOut?'Time is up · your results':session.daily?'Daily review results':'Your exam results');
    const metrics=node('div','exam-result-grid');
    const entries=[
      [count.auto?Math.round(100*count.correct/count.auto)+'%':'—','Auto MCQ accuracy'],
      [count.answered+' / '+session.questions.length,'Questions answered'],
      [count.wrong,'Saved as Weak'],
      [count.selfKnown+' / '+count.self,'Self-graded correct']
    ];
    entries.forEach(([value,label])=>{
      const card=node('div','exam-result-metric');
      card.append(node('strong','',value),node('span','',label));
      metrics.append(card);
    });
    results.append(metrics);
    appendText(results,'p','exam-result-note','Only verified MCQs count toward automatic accuracy. Written answers are labelled self-graded. Unanswered questions do not change existing ratings.');
    const missed=session.questions.filter(q=>answerFor(q)?.correct===false);
    el('examRetry').disabled=!missed.length;
    if(missed.length){
      appendText(results,'h4','exam-mistakes-heading','Questions to revisit');
      const list=node('ol','exam-mistakes');
      missed.forEach(q=>{
        const source=sourceFor(q);
        const li=node('li','');
        appendText(li,'strong','',source?currentHeading(q,source):q.id);
        appendText(li,'small','',TYPES[q.type]+(source?.item?.sourcePage?' · '+source.item.sourcePage:''));
        if(q.type==='mcq'&&source)appendText(li,'p','', 'Correct: '+source.item.options[source.item.answerIndex]);
        li.append(node('span','exam-weak-tag','Weak'));
        list.append(li);
      });
      results.append(list);
    }
    const currentHistory=history()[0];
    if(currentHistory)appendText(results,'p','exam-history','Session saved locally · '+new Date(currentHistory.date).toLocaleString());
  };
  const showSetup=()=>{
    showPanel('examSetup');
    previewScope();
    el('examResume').hidden=!session||session.finished;
    const recent=history()[0];
    el('examHistory').textContent=recent
      ?'Last attempt: '+recent.answered+' / '+recent.questions+' answered · '+recent.wrong+' weak · '+new Date(recent.date).toLocaleDateString()
      :'No completed exams on this device yet.';
  };
  const loadQuestions=async items=>{
    const ids=[...new Set(items.map(q=>q.lectureId))];
    const loader=globalThis.MEQLectureLoader;
    if(loader){
      const scopes=new Map();
      items.forEach(q=>{
        const lecture=lectures.find(l=>l.id===q.lectureId);
        const subject=q.subjectKey||lecture?.subjectKey||session?.subject;
        const course=q.courseId||lecture?.courseId||session?.course;
        if(subject&&course)scopes.set(course+'::'+subject,{subject,course});
      });
      await Promise.all([...scopes.values()].map(scope=>loader.loadSubjectMetadata(scope.subject,scope.course)));
      await Promise.all(ids.map(id=>loader.loadLecture(id,{refresh:false,busy:false})));
    }
    if(items.some(q=>!sourceFor(q)))throw new Error('A source question is unavailable. Your previous exam and saved ratings were not changed.');
  };
  const begin=async()=>{
    if(busy)return;
    if(session&&!session.finished&&!window.confirm('Start a new exam? Your current session will be replaced. Already saved question ratings remain unchanged.'))return;
    busy=true;
    const button=el('examBegin');button.disabled=true;button.textContent='Preparing questions…';
    try{
      await Promise.resolve(globalThis.MEQProgressStore?.ready);
      const loader=globalThis.MEQLectureLoader;
      const course=activeCourseId(),subject=activeSubject;
      if(loader)await loader.loadSubjectMetadata(subject,course);
      const scope=el('examScope').value;
      const selected=selectedLectureId();
      const rows=visibleLectures().filter(l=>scope==='subject'||l.id===selected);
      if(!rows.length)throw new Error('Choose a published lecture with questions first.');
      if(loader)await Promise.all(rows.map(l=>loader.loadLecture(l.id,{refresh:false,busy:false})));
      let pool=rows.flatMap(l=>cardPool(lectures.find(x=>x.id===l.id)||l));
      if(el('examWeakOnly').checked)pool=pool.filter(q=>['weak','review'].includes(state[key(q.lectureId,q.type,q.id)]));
      const format=el('examFormat').value;
      pool=pool.filter(q=>format==='mcq'?q.type==='mcq':format==='written'?q.type!=='mcq':true);
      const count=Number(el('examCount').value)||10;
      const questions=selectPool(pool,format,count);
      if(!questions.length)throw new Error(format==='mcq'
        ?'This selection has no source-verified MCQs yet. Select Smart mix or Written practice.':el('examWeakOnly').checked
        ?'No questions are marked Weak / Review in this selection. Turn off the filter to start.'
        :'No published questions are available for this selection.');
      const duration=Number(el('examDuration').value)||0;
      session={schema:1,course,subject,startedAt:Date.now(),deadline:duration?Date.now()+duration*60_000:0,
        questions,answers:{},index:0,finished:false,timedOut:false};
      const retained=persist();
      renderQuestion();
      startClock();
      if(!retained)alertUser('Exam session could not be saved for reload. Your ratings will still use the study-progress store.');
    }catch(error){showSetup();alertUser(String(error.message||error))}
    finally{busy=false;button.disabled=false;button.textContent='Start exam'}
  };
  const resume=async()=>{
    if(!session)return showSetup();
    busy=true;
    try{
      await Promise.resolve(globalThis.MEQProgressStore?.ready);
      await loadQuestions(session.questions);
      if(session.finished)showResults();
      else{renderQuestion();startClock()}
    }catch(error){
      showSetup();
      alertUser(String(error.message||error)+' Your saved study ratings were not changed.');
    }finally{busy=false}
  };
  const retryWrong=()=>{
    const missed=session?.questions.filter(q=>answerFor(q)?.correct===false)||[];
    if(!missed.length)return;
    session={...session,startedAt:Date.now(),deadline:0,questions:shuffle(missed),
      answers:{},index:0,finished:false,timedOut:false,finishedAt:null};
    persist();
    renderQuestion();
    startClock();
  };
  const changeExam=()=>{
    if(!session||session.finished||busy)return;
    if(!window.confirm('Change exam settings? This unfinished attempt will be discarded. Saved Weak / Mastered ratings will stay.'))return;
    if(!safelyWrite(SESSION,null)){
      alertUser('Cannot replace the saved exam. Check browser storage settings and try again.');
      return;
    }
    session=null;
    stopClock();
    showSetup();
    el('examBegin').focus();
  };
  // Daily selection works from saved ratings plus catalog metadata, not fabricated clinical scoring.
  const dailyCandidates=()=>{
    const unique=new Map(),log=readReviewLog();
    for(const [statusKey,level] of Object.entries(state)){
      if(level!=='weak'&&level!=='review')continue;
      const parts=progressKeyParts(statusKey);
      if(!allowedTypes.has(parts.type)||!parts.itemId||!parts.lectureId)continue;
      const lecture=lectures.find(l=>l.id===parts.lectureId);
      if(!lecture)continue;
      if(parts.version===2&&(parts.courseId!==lecture.courseId||parts.subjectKey!==lecture.subjectKey))continue;
      const q={lectureId:lecture.id,type:parts.type,id:parts.itemId,courseId:lecture.courseId,subjectKey:lecture.subjectKey};
      const id=identifier(q),previous=unique.get(id);
      if(!previous||parts.version===2)unique.set(id,{q,level,record:log[id]||{}});
    }
    const day=new Date().toLocaleDateString('en-CA');
    const dailyOrder=id=>{
      let hash=0;for(const char of day+id)hash=(Math.imul(hash,31)+char.charCodeAt(0))|0;
      return hash>>>0;
    };
    return [...unique.values()].sort((a,b)=>
      Number(b.level==='weak')-Number(a.level==='weak')||
      (Number(a.record.lastSeen)||0)-(Number(b.record.lastSeen)||0)||
      (Number(b.record.mistakes)||0)-(Number(a.record.mistakes)||0)||
      dailyOrder(identifier(a.q))-dailyOrder(identifier(b.q))
    );
  };
  const startDaily=async()=>{
    const button=el('dailyWeakBtn'),message=el('dailyReviewStatus');
    if(busy)return;
    if(session&&!session.finished&&!window.confirm('Start Daily Weak 15? Your unfinished exam session will be replaced, but saved ratings remain.'))return;
    busy=true;button.disabled=true;message.textContent='Preparing saved review questions across courses…';
    try{
      await Promise.resolve(globalThis.MEQProgressStore?.ready);
      const loader=globalThis.MEQLectureLoader,registry=globalThis.MEQCourseRegistry;
      if(!loader||!registry)throw new Error('The course library is not ready. Try again.');
      const scopes=registry.allSubjectScopes();
      const checked=await Promise.allSettled(scopes.map(scope=>loader.loadSubjectMetadata(scope.subjectKey,scope.courseId)));
      const questions=dailyCandidates().slice(0,DAILY_LIMIT).map(row=>row.q);
      if(!questions.length){
        message.textContent='No saved Weak / Review questions yet. Mark questions in a lecture or take an exam first.';
        return;
      }
      await loadQuestions(questions);
      session={schema:1,course:'mixed',subject:'Across courses',daily:true,startedAt:Date.now(),deadline:0,
        questions,answers:{},index:0,finished:false,timedOut:false};
      const retained=persist();
      if(!dialog.open)dialog.showModal();
      renderQuestion();startClock();
      message.textContent=questions.length+' review questions selected · Weak first, then oldest attempts. Repeated mistakes break ties.';
      if(checked.some(result=>result.status==='rejected'))alertUser('Some course catalogs were unavailable. This review uses the accessible saved questions.');
      if(!retained)alertUser('Daily session could not be saved for reload. Saved question ratings remain unchanged.');
    }catch(error){message.textContent='Could not prepare Daily Weak 15: '+String(error.message||error)}
    finally{busy=false;button.disabled=false}
  };
  const recordedRating=q=>{
    const canonical=key(q.lectureId,q.type,q.id);
    return state[canonical]||state[q.lectureId+'::'+q.type+'::'+q.id]||'unrated';
  };
  const renderNotebookList=()=>{
    const list=el('examNotebookList');list.replaceChildren();
    const filter=el('examNotebookFilter').value;
    const rows=Object.values(readReviewLog())
      .filter(record=>Number(record.mistakes)>0)
      .sort((a,b)=>(Number(b.lastMistake)||0)-(Number(a.lastMistake)||0));
    const visible=rows.filter(record=>{
      const rating=recordedRating(record);
      return filter==='all'||(filter==='weak'?rating==='weak'||rating==='review':rating==='mastered');
    });
    el('examNotebookSummary').textContent=rows.length
      ?visible.length+' of '+rows.length+' recorded mistakes · Source answers load from the published lecture.'
      :'No exam mistakes recorded on this device yet. Wrong MCQs and written questions you self-rate Weak will appear here.';
    for(const record of visible){
      const q={lectureId:record.lectureId,type:record.type,id:record.id,
        courseId:record.courseId,subjectKey:record.subjectKey};
      const source=sourceFor(q),rating=recordedRating(record);
      const card=node('article','exam-notebook-item');
      const heading=appendText(card,'h4','',source?currentHeading(q,source):record.id);
      heading.className='exam-notebook-heading';
      const meta=(source?.lecture?.title||record.lectureId)+' · '+record.mistakes+
        (record.mistakes===1?' mistake':' mistakes')+' · '+(record.lastWrongKind==='self'?'Self-rated':'Auto-scored')+
        ' · '+(rating==='mastered'?'Now Mastered':rating==='weak'?'Still Weak':rating==='review'?'Needs Review':'Unrated');
      appendText(card,'p','exam-notebook-meta',meta);
      if(Number(record.lastMistake))appendText(card,'small','exam-notebook-date','Last mistake: '+new Date(record.lastMistake).toLocaleString());
      const actions=node('div','exam-notebook-actions');
      const view=node('button','exam-secondary','View source answer');view.type='button';view.disabled=!source;
      const retry=node('button','exam-primary','Retry question');retry.type='button';retry.disabled=!source;
      const answer=node('div','exam-model');answer.hidden=true;
      view.addEventListener('click',()=>{
        const opening=answer.hidden;answer.hidden=!opening;
        view.textContent=opening?'Hide source answer':'View source answer';
        if(opening&&!answer.childElementCount){
          if(q.type==='mcq'){
            appendText(answer,'strong','','Correct: '+source.item.options[source.item.answerIndex]);
            if(source.item.rationale)appendText(answer,'p','',source.item.rationale);
          }else modelAnswer(answer,q,source);
          if(source.item.sourcePage)appendText(answer,'small','',source.item.sourcePage);
          else if(source.item.page)appendText(answer,'small','','Lecture page '+source.item.page);
        }
      });
      retry.addEventListener('click',()=>{
        if(session&&!session.finished&&!window.confirm('Retry this question? Your unfinished exam session will be replaced. Saved ratings and mistake counts remain.'))return;
        session={schema:1,course:q.courseId,subject:q.subjectKey,startedAt:Date.now(),deadline:0,
          questions:[q],answers:{},index:0,finished:false,timedOut:false};
        const retained=persist();renderQuestion();startClock();
        if(!retained)alertUser('Retry session could not be saved for reload. Your saved ratings remain unchanged.');
      });
      actions.append(view,retry);
      card.append(actions,answer);list.append(card);
    }
    if(!visible.length&&rows.length)appendText(list,'p','exam-notebook-empty','No mistakes match this filter.');
  };
  const openNotebook=async()=>{
    if(!dialog.open)dialog.showModal();
    showPanel('examNotebook');
    el('examNotebookSummary').textContent='Loading source questions…';
    el('examNotebookList').replaceChildren();
    const records=Object.values(readReviewLog()).filter(record=>Number(record.mistakes)>0);
    const loader=globalThis.MEQLectureLoader;
    if(loader){
      const scopes=new Map();
      records.forEach(q=>{if(q.courseId&&q.subjectKey)scopes.set(q.courseId+'::'+q.subjectKey,q)});
      await Promise.allSettled([...scopes.values()].map(q=>loader.loadSubjectMetadata(q.subjectKey,q.courseId)));
      const ids=[...new Set(records.map(q=>q.lectureId))].filter(id=>lectures.some(l=>l.id===id));
      await Promise.allSettled(ids.map(id=>loader.loadLecture(id,{refresh:false,busy:false})));
    }
    if(el('examNotebook').hidden||!dialog.open)return;
    renderNotebookList();
  };
  const open=()=>{
    if(!dialog.open)dialog.showModal();
    if(session)void resume();else showSetup();
  };
  launcher.addEventListener('click',open);
  el('dailyWeakBtn')?.addEventListener('click',()=>void startDaily());
  el('mistakeNotebookBtn')?.addEventListener('click',()=>void openNotebook());
  el('examViewNotebook').addEventListener('click',()=>void openNotebook());
  el('examNotebookFilter').addEventListener('change',renderNotebookList);
  el('examNotebookBack').addEventListener('click',()=>{
    if(session)void resume();else showSetup();
  });
  document.addEventListener('click',event=>{
    if(!(event.target instanceof Element))return;
    const button=event.target.closest('.status[data-key]');
    if(!button)return;
    queueMicrotask(()=>{
      const parts=progressKeyParts(button.dataset.key||'');
      if(!parts.lectureId||!parts.itemId||!allowedTypes.has(parts.type))return;
      const id=parts.lectureId+'::'+parts.type+'::'+parts.itemId;
      const log=readReviewLog(),old=log[id]||{},lecture=lectures.find(l=>l.id===parts.lectureId);
      log[id]={...old,lectureId:parts.lectureId,type:parts.type,id:parts.itemId,
        courseId:lecture?.courseId||old.courseId||'',subjectKey:lecture?.subjectKey||old.subjectKey||'',lastSeen:Date.now()};
      writeReviewLog(log);
    });
  });
  el('examClose').addEventListener('click',()=>dialog.close());
  el('examBegin').addEventListener('click',()=>void begin());
  el('examResume').addEventListener('click',()=>void resume());
  el('examPrevious').addEventListener('click',()=>{
    if(session&&session.index>0){session.index--;persist();renderQuestion()}
  });
  el('examNext').addEventListener('click',()=>{
    if(session&&session.index<session.questions.length-1){session.index++;persist();renderQuestion()}
  });
  el('examChange').addEventListener('click',changeExam);
  el('examFinish').addEventListener('click',()=>{
    if(!session)return;
    const remaining=session.questions.length-answeredCount();
    if(remaining&& !window.confirm('Finish this exam with '+remaining+' unanswered question(s)?'))return;
    finish(false);
  });
  el('examRetry').addEventListener('click',retryWrong);
  el('examNew').addEventListener('click',()=>{session=null;persist();showSetup()});
  dialog.addEventListener('close',stopClock);
  dialog.addEventListener('cancel',()=>{persist();stopClock()});
  dialog.addEventListener('keydown',event=>{
    if(el('examPlay').hidden||!session||busy||event.altKey||event.ctrlKey||event.metaKey)return;
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
    const q=current();
    if(q?.type==='mcq'&&!answerFor(q)&&/^[1-4]$/.test(event.key)){
      const index=Number(event.key)-1;
      if(index<sourceFor(q)?.item?.options?.length){event.preventDefault();void chooseMCQ(index)}
    }
  });
  document.addEventListener('meq:open-exam-review',event=>{
    const {lectureId,level}=event.detail||{};
    if(!lectureId)return;
    const lecture=lectures.find(l=>l.id===lectureId);
    if(!lecture)return;
    // The review hub already navigated to the required lecture.
    open();
    if(session?.finished||!session){
      showSetup();
      el('examScope').value='lecture';
      el('examFormat').value='mcq';
      el('examWeakOnly').checked=true;
      appendText(el('examHistory'),'span','', ' · Open Weak/Review MCQ practice from this lecture');
    }
  });
  globalThis.MEQExamMode=Object.freeze({open});
})();
