const subjects = [
  {
    "id": "urology",
    "label": "Urology"
  },
  {
    "id": "general",
    "label": "General Surgery"
  },
  {
    "id": "git",
    "label": "GIT Surgery"
  },
  {
    "id": "neurosurgery",
    "label": "Neurosurgery"
  }
];
const lectures = [];
const $=id=>document.getElementById(id);
const storage={get(k){try{return window.localStorage.getItem(k)}catch(e){return null}},set(k,v){try{window.localStorage.setItem(k,v)}catch(e){}}};
const state=(()=>{try{const value=JSON.parse(storage.get('medicalBankStatusV2')||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch(e){return {}}})();
let revealAll=false;
let storedSubject=storage.get('medicalBankSubjectV4')||storage.get('medicalBankSubjectV3')||'urology';
let activeSubject=storedSubject==='urosurgery'?'urology':storedSubject;
let activeSubtopic='all';

function lectureCount(lecture, keyName){
  const expected=lecture?.expectedCounts?.[keyName];
  if(Number.isFinite(expected))return expected;
  return Array.isArray(lecture?.[keyName])?lecture[keyName].length:0
}
function lectureIsLoaded(lecture){return Boolean(lecture&&!lecture.__metadataOnly)}
function lectureProgressPercent(lecture){
  const total=['cases','coreShorts','imageQuestions','detailedShorts']
    .reduce((sum,keyName)=>sum+lectureCount(lecture,keyName),0);
  if(!total)return 0;
  let done=0;
  Object.entries(state).forEach(([statusKey,value])=>{
    if(!value)return;
    const parsed=progressKeyParts(statusKey);
    if(parsed.lectureId!==lecture.id||!['case','core','image','extra'].includes(parsed.type))return;
    if(parsed.version===2&&(
      parsed.courseId!==(lecture.courseId||activeCourseId())||
      parsed.subjectKey!==lecture.subjectKey
    ))return;
    done+=1
  });
  return Math.min(100,Math.round(done/total*100))
}
function subjectProgressCounts(scope){
  const ids=new Set(scope.map(lecture=>lecture.id));
  const totals=scope.reduce((out,lecture)=>{
    out.cases+=lectureCount(lecture,'cases');
    out.coreShorts+=lectureCount(lecture,'coreShorts');
    out.imageQuestions+=lectureCount(lecture,'imageQuestions');
    out.detailedShorts+=lectureCount(lecture,'detailedShorts');
    return out
  },{cases:0,coreShorts:0,imageQuestions:0,detailedShorts:0});
  const coreTotal=totals.cases+totals.coreShorts+totals.imageQuestions;
  const overallTotal=coreTotal+totals.detailedShorts;
  let coreDone=0,overallDone=0,mastered=0;
  Object.entries(state).forEach(([statusKey,value])=>{
    if(!value)return;
    const parsed=progressKeyParts(statusKey),lectureId=parsed.lectureId,type=parsed.type;
    if(parsed.version===2&&(parsed.courseId!==activeCourseId()||parsed.subjectKey!==activeSubject))return;
    if(!ids.has(lectureId))return;
    if(['case','core','image'].includes(type)){
      coreDone+=1;
      if(value==='mastered')mastered+=1
    }
    if(['case','core','image','extra'].includes(type))overallDone+=1
  });
  return {totals,coreTotal,overallTotal,coreDone,overallDone,mastered}
}

function esc(s){return String(s).replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]))}
const migratingProgressKeys=new Set();
function legacyKey(lecture,type,id){return lecture+'::'+type+'::'+id}
function progressKeyParts(statusKey){
  const parts=String(statusKey).split('::');
  if(parts[0]==='v2'&&parts.length>=6)return {version:2,courseId:parts[1],subjectKey:parts[2],lectureId:parts[3],type:parts[4],itemId:parts.slice(5).join('::')};
  return {version:1,lectureId:parts[0]||'',type:parts[1]||'',itemId:parts.slice(2).join('::')}
}
function key(lecture,type,id){
  const lectureRecord=lectures.find(item=>item.id===lecture);
  const subjectKey=lectureRecord?.subjectKey||activeSubject||'unknown-subject';
  const registry=globalThis.MEQCourseRegistry;
  const courseId=registry?.courseForSubject(subjectKey)||'legacy-course';
  const scoped=registry?.itemScope?.(lecture,subjectKey,type,id);
  const canonical=scoped?'v2::'+scoped.split('/').join('::'):['v2',courseId,subjectKey,lecture,type,id].join('::');
  const legacy=legacyKey(lecture,type,id);
  if(!(canonical in state)&&state[legacy]&&!migratingProgressKeys.has(legacy)){
    const value=state[legacy];
    state[canonical]=value;
    delete state[legacy];
    const store=globalThis.MEQProgressStore;
    if(store?.set){
      migratingProgressKeys.add(legacy);
      Promise.resolve(store.ready)
        .then(()=>store.set(canonical,value))
        .then(()=>store.set(legacy,''))
        .catch(error=>console.warn('Could not migrate legacy progress key:',error))
        .finally(()=>migratingProgressKeys.delete(legacy))
    }
  }
  return canonical
}
function activeCourseId(){return globalThis.MEQCourseRegistry?.activeCourse||''}
function visibleLectures(){
  const courseId=activeCourseId();
  return lectures.filter(l=>
    l.subjectKey===activeSubject&&
    (!courseId||!l.courseId||l.courseId===courseId)
  )
}
function currentLecture(){const id=$('lectureFilter').value;if(id&&id!=='all'){const lecture=lectures.find(l=>l.id===id)||null;return lectureIsLoaded(lecture)?lecture:null}const list=visibleLectures().filter(lectureIsLoaded);return list.length===1?list[0]:null}
function lectureItems(l){return [...l.cases.map(x=>({type:'case',x})),...l.coreShorts.map(x=>({type:'core',x})),...l.imageQuestions.map(x=>({type:'image',x})),...l.detailedShorts.map(x=>({type:'extra',x}))]}
function allItems(scopeLectures=lectures){return scopeLectures.flatMap(l=>lectureItems(l).map(o=>({l,...o})))}
function coreItems(scopeLectures=lectures){return scopeLectures.flatMap(l=>[...l.cases.map(x=>({l,type:'case',x})),...l.coreShorts.map(x=>({l,type:'core',x})),...l.imageQuestions.map(x=>({l,type:'image',x}))])}
function answerHtml(a){const arr=Array.isArray(a)?a:[a];return `<ul>${arr.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`}
function itemSubtopics(item){return Array.isArray(item.subtopics)?item.subtopics:[]}
function setSubtopicData(el,item){el.dataset.subtopics=itemSubtopics(item).join(' ');return el}

function validateBank(){
  const errors=[];
  const subjectIds=new Set(subjects.map(s=>s.id));
  const lectureIds=new Set();
  lectures.forEach(l=>{
    if(lectureIds.has(l.id))errors.push(`Duplicate lecture id: ${l.id}`);lectureIds.add(l.id);
    if(!subjectIds.has(l.subjectKey))errors.push(`Unknown subjectKey in ${l.title}: ${l.subjectKey}`);
    const validSubtopics=new Set(l.subtopics.map(s=>s.id));
    if(validSubtopics.size!==l.subtopics.length)errors.push(`Duplicate subtopic id in ${l.title}`);
    const seen=new Set();
    lectureItems(l).forEach(({type,x})=>{
      const itemKey=type+'::'+x.id;if(seen.has(itemKey))errors.push(`Duplicate item id: ${l.id}/${itemKey}`);seen.add(itemKey);
      if(!x.id)errors.push(`Missing item id in ${l.title}`);
      if(!itemSubtopics(x).length)errors.push(`No explicit subtopic mapping: ${l.id}/${itemKey}`);
      itemSubtopics(x).forEach(s=>{if(!validSubtopics.has(s))errors.push(`Unknown subtopic ${s}: ${l.id}/${itemKey}`)});
      if(type==='image'&&!hasImageVisual(x))errors.push(`Missing image or lecture-page reference: ${l.id}/${x.id}`);
    });
  });
  const alert=$('dataAlert');
  if(errors.length){alert.hidden=false;alert.innerHTML='<b>Data integrity warning:</b><br>'+errors.map(esc).join('<br>');console.error('Bank validation errors',errors)}
  else{alert.hidden=true;console.info('Bank validation passed')}
  return errors;
}

function actions(lid,type,id,label){return `<div class="actions"><button class="toggle">${label}</button><div class="status-group"><button class="status mastered" data-key="${key(lid,type,id)}" data-status="mastered">Mastered</button><button class="status review" data-key="${key(lid,type,id)}" data-status="review">Review</button><button class="status weak" data-key="${key(lid,type,id)}" data-status="weak">Weak</button></div></div>`}
function caseCard(l,c,i){const a=document.createElement('article');a.className='case study-item';a.id=l.id+'-case-'+c.id;a.dataset.type='case';a.dataset.lecture=l.id;a.dataset.topic=c.topic;a.dataset.priority=c.priority;a.dataset.search=(l.title+' '+c.title+' '+c.scenario+' '+c.questions.join(' ')+' '+c.answer.join(' ')).toLowerCase();a.innerHTML=`<div class="case-head"><div><h3 class="case-title">${i+1}. ${esc(c.title)}</h3><div class="meta"><span class="pill ${c.priority==='High'?'high':'core'}">${c.priority} priority</span><span class="pill">${esc(c.topic)}</span><span class="pill marks">${c.marks} marks</span></div></div></div><div class="case-body"><div class="scenario"><b>Scenario:</b> ${esc(c.scenario)}<div class="arabic">${esc(c.ar)}</div></div><ol class="q-list">${c.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ol><div class="answer-area"><div class="answer-grid"><div class="answer-card"><h4>Model answer</h4><ul>${c.answer.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="answer-card marking"><h4>Suggested marking scheme</h4><ul>${c.marking.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div><div class="exam-trap"><b>Exam trap:</b> ${esc(c.trap)}</div><div class="memory">Memory trigger: ${esc(c.memory)}</div></div></div>${actions(l.id,'case',c.id,'Show model answer')}`;return setSubtopicData(a,c)}
function shortCard(l,q,i,type,label){const a=document.createElement('article');a.className='short-card study-item';a.id=l.id+'-'+type+'-'+q.id;a.dataset.type=type;a.dataset.lecture=l.id;a.dataset.topic=q.topic;a.dataset.priority=q.priority;a.dataset.search=(l.title+' '+q.q+' '+(Array.isArray(q.a)?q.a.join(' '):q.a)).toLowerCase();a.innerHTML=`<div class="short-top"><div class="short-num">${label} ${i+1}</div><div class="short-q">${esc(q.q)}</div><div class="meta"><span class="pill ${q.priority==='High'?'high':'core'}">${q.priority}</span><span class="pill">${esc(q.topic)}</span><span class="pill marks">${q.marks} mark${q.marks>1?'s':''}</span></div><div class="short-answer"><b>Model answer:</b>${answerHtml(q.a)}</div></div>${actions(l.id,type,q.id,'Show answer')}`;return setSubtopicData(a,q)}
function imageSource(item){return typeof item?.image==='string'?item.image.trim():''}
function imagePage(item){const value=item?.page;return value===0?'0':(value==null?'':String(value).trim())}
function hasImageVisual(item){return Boolean(imageSource(item)||imagePage(item))}
function imagePlaceholderHtml(q){const page=imagePage(q);const reference=page?`Lecture page ${page}`:'Lecture source';return `<div class="visual-placeholder" role="img" aria-label="${esc(q.title)} figure reference"><span class="visual-placeholder-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="8.5" cy="9" r="1.5"></circle><path d="m5 17 4.5-4.5 3 3 2-2L19 18"></path></svg></span><strong>${esc(q.title)}</strong><span>${esc(reference)} is referenced for this spot question; the figure is not embedded in the bank.</span></div>`}
function imageVisualHtml(q){const source=imageSource(q);return source?`<img src="${esc(source)}" alt="${esc(q.title)}" loading="lazy" decoding="async" fetchpriority="low">`:imagePlaceholderHtml(q)}
function imageCard(l,q,i){const a=document.createElement('article');const source=imageSource(q);a.className='image-card study-item';a.id=l.id+'-image-'+q.id;a.dataset.type='image';a.dataset.lecture=l.id;a.dataset.topic=q.topic;a.dataset.priority=q.priority;a.dataset.visualSource=source?'embedded':'lecture-reference';a.dataset.search=(l.title+' '+q.title+' '+q.prompt+' '+q.questions.join(' ')+' '+q.answer.join(' ')).toLowerCase();a.innerHTML=`<div class="case-head"><div><h3 class="case-title">${i+1}. ${esc(q.title)}</h3><div class="meta"><span class="pill ${q.priority==='High'?'high':'core'}">${q.priority}</span><span class="pill">${esc(q.topic)}</span><span class="pill marks">${q.marks} marks</span><span class="pill page">${esc(imagePage(q)||'Lecture source')}</span></div></div></div><div class="visual">${imageVisualHtml(q)}</div><div class="case-body"><div class="visual-prompt">${esc(q.prompt)}</div><ol class="q-list">${q.questions.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><div class="answer-area"><div class="answer-card"><h4>Model answer</h4>${answerHtml(q.answer)}</div></div></div>${actions(l.id,'image',q.id,'Show answer')}`;const image=a.querySelector('img');image?.addEventListener('error',()=>{const visual=a.querySelector('.visual');if(visual){visual.innerHTML=imagePlaceholderHtml(q);a.dataset.visualSource='lecture-reference'}});return setSubtopicData(a,q)}

function populateSubjectSelector(){const s=$('subjectSelector');s.innerHTML=subjects.map(x=>`<option value="${x.id}">${esc(x.label)}</option>`).join('');if(!subjects.some(x=>x.id===activeSubject))activeSubject='urology';s.value=activeSubject}
function populateLectureFilter(){
  const lf=$('lectureFilter'),old=lf.value,list=visibleLectures();
  if(!list.length){lf.innerHTML='<option value="all">No lectures yet</option>';lf.value='all';lf.disabled=true;delete lf.dataset.explicitAll;return}
  lf.disabled=false;
  if(list.length===1){
    lf.innerHTML=`<option value="${list[0].id}">01. ${esc(list[0].title)}</option>`;
    lf.value=list[0].id;
    delete lf.dataset.explicitAll;
    return
  }
  lf.innerHTML='<option value="all">All lecture overviews</option>'+list.map(l=>`<option value="${l.id}">${String(l.order).padStart(2,'0')}. ${esc(l.title)}</option>`).join('');
  const courseId=activeCourseId();
  const remembered=storage.get(`medicalBankLectureV2:${courseId}:${activeSubject}`)||
    storage.get(`medicalBankLectureV1:${activeSubject}`);
  const explicitAll=old==='all'&&lf.dataset.explicitAll==='1';
  const candidate=explicitAll
    ?'all'
    :list.some(l=>l.id===old&&old!=='all')
      ?old
      :list.some(l=>l.id===remembered)
        ?remembered
        :list[0].id;
  lf.value=candidate
}
function selectLecture(id,scroll=true){
  const lf=$('lectureFilter');
  lf.value=id;
  activeSubtopic='all';
  if(id==='all'){
    lf.dataset.explicitAll='1';
    updateTopicOptions();
    render();
    return
  }
  delete lf.dataset.explicitAll;
  storage.set(`medicalBankLectureV2:${activeCourseId()}:${activeSubject}`,id);
  updateTopicOptions();
  render();
  const loader=globalThis.MEQLectureLoader?.loadLecture;
  if(typeof loader!=='function'){
    if(scroll)document.getElementById('lecture-'+id)?.scrollIntoView({behavior:scrollBehavior(),block:'start'});
    return
  }
  loader(id,{refresh:false}).then(()=>{
    if($('lectureFilter').value!==id)return;
    updateTopicOptions();
    render();
    validateBank();
    if(scroll)document.getElementById('lecture-'+id)?.scrollIntoView({behavior:scrollBehavior(),block:'start'})
  }).catch(()=>{})
}
function selectSubtopic(lectureId,subtopicId){if($('lectureFilter').value!==lectureId)$('lectureFilter').value=lectureId;activeSubtopic=subtopicId;updateTopicOptions();renderLectureNav();renderSubtopicNav();applyFilters();const first=[...document.querySelectorAll(`.study-item[data-lecture="${lectureId}"]`)].find(it=>!it.classList.contains('hidden'));first?.scrollIntoView({behavior:scrollBehavior(),block:'center'})}
function renderLectureNav(){
  const nav=$('lectureNav'),list=visibleLectures(),selected=$('lectureFilter').value;nav.innerHTML='';
  if(!list.length){nav.innerHTML='<div class="sidebar-empty">No lectures have been added to this subject yet.</div>';return}
  if(list.length>1){
    const all=document.createElement('button');
    all.className='lecture-link '+(selected==='all'?'active':'');
    if(selected==='all')all.setAttribute('aria-current','page');
    all.innerHTML=`<strong>All lectures</strong><small>${list.length} lecture overviews</small>`;
    all.onclick=()=>selectLecture('all',false);
    nav.appendChild(all)
  }
  list.forEach(l=>{
    const b=document.createElement('button');
    b.className='lecture-link '+(selected===l.id?'active':'');
    if(selected===l.id)b.setAttribute('aria-current','page');
    b.innerHTML=`<strong>${String(l.order).padStart(2,'0')}. ${esc(l.title)}</strong><small>${lectureCount(l,'cases')} cases • ${lectureCount(l,'coreShorts')} core shorts</small><div class="subnav"><span>MEQ</span><span>Shorts</span><span>Images</span><span>Rapid</span></div>`;
    b.onclick=()=>selectLecture(l.id,true);
    nav.appendChild(b)
  })
}
function metricHtml(counts){const bits=[];if(counts.case)bits.push(`<span class="subtopic-metric">C ${counts.case}</span>`);if(counts.core)bits.push(`<span class="subtopic-metric">S ${counts.core}</span>`);if(counts.image)bits.push(`<span class="subtopic-metric">I ${counts.image}</span>`);return bits.join('')||'<span class="subtopic-metric">0</span>'}
function subtopicCounts(l,sid){const out={case:0,core:0,image:0,extra:0};lectureItems(l).forEach(({type,x})=>{if(itemSubtopics(x).includes(sid))out[type]++});return out}
function renderSubtopicSet(nav,l,grouped=false){
  const wrap=document.createElement('div');if(grouped)wrap.className='lecture-group';
  if(grouped){const h=document.createElement('div');h.className='lecture-group-title';h.innerHTML=`<span>${String(l.order).padStart(2,'0')}. ${esc(l.title)}</span><button type="button">Open lecture</button>`;h.querySelector('button').onclick=()=>selectLecture(l.id,true);wrap.appendChild(h)}
  if(!grouped){const all=document.createElement('button');all.className='subtopic-link '+(activeSubtopic==='all'?'active':'');if(activeSubtopic==='all')all.setAttribute('aria-current','location');const total={case:l.cases.length,core:l.coreShorts.length,image:l.imageQuestions.length};all.innerHTML=`<div class="subtopic-line"><strong>All subtopics</strong><span class="subtopic-metrics">${metricHtml(total)}</span></div>`;all.onclick=()=>{activeSubtopic='all';renderSubtopicNav();applyFilters()};wrap.appendChild(all)}
  l.subtopics.forEach(s=>{const counts=subtopicCounts(l,s.id);const b=document.createElement('button');b.className='subtopic-link '+(!grouped&&activeSubtopic===s.id?'active':'');if(!grouped&&activeSubtopic===s.id)b.setAttribute('aria-current','location');b.innerHTML=`<div class="subtopic-line"><strong>${esc(s.label)}</strong><span class="subtopic-metrics">${metricHtml(counts)}</span></div>`;b.onclick=()=>selectSubtopic(l.id,s.id);wrap.appendChild(b)});nav.appendChild(wrap)
}
function renderSubtopicNav(){
  const nav=$('subtopicNav'),list=visibleLectures(),selected=$('lectureFilter').value,l=currentLecture();nav.innerHTML='';
  if(!list.length){nav.innerHTML='<div class="sidebar-empty">No subtopics are available yet.</div>';return}
  if(selected==='all'){
    nav.innerHTML='<div class="sidebar-empty">Choose a lecture to load its subtopics. The overview intentionally keeps lecture payloads unloaded.</div>';
    return
  }
  if(l){renderSubtopicSet(nav,l,false);return}
  nav.innerHTML='<div class="sidebar-empty">Subtopics will appear when this lecture finishes loading.</div>'
}

function renderLectureOverview(container,list){
  const section=document.createElement('section');
  section.className='lecture-overview-panel';
  section.innerHTML='<div class="section-head"><div><h2>Lecture overview</h2><p>Choose one lecture to load its full study content. This keeps the bank fast as more lectures are added.</p></div></div><div class="lecture-overview-grid"></div>';
  const grid=section.querySelector('.lecture-overview-grid');
  list.forEach(lecture=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='lecture-overview-card';
    const progress=lectureProgressPercent(lecture);
    button.innerHTML=`<strong>${String(lecture.order).padStart(2,'0')}. ${esc(lecture.title)}</strong><span>${lectureCount(lecture,'cases')} MEQ cases • ${lectureCount(lecture,'coreShorts')} core shorts • ${lectureCount(lecture,'imageQuestions')} image questions</span><span class="lecture-overview-progress"><span><b>${progress}%</b> rated</span><span class="mini-progress" aria-hidden="true"><i style="width:${progress}%"></i></span></span><span class="lecture-overview-action">${progress?'Continue lecture':'Start lecture'}</span>`;
    button.onclick=()=>selectLecture(lecture.id,true);
    grid.appendChild(button)
  });
  container.appendChild(section)
}
function render(){
  const container=$('lectureContainer');container.innerHTML='';const list=visibleLectures();
  if(!list.length){renderLectureNav();renderSubtopicNav();updateStatus();applyFilters();return}
  const selected=$('lectureFilter').value;
  if(selected==='all'){
    renderLectureOverview(container,list);
    renderLectureNav();
    renderSubtopicNav();
    updateStatus();
    $('empty').classList.remove('show');
    return
  }
  const l=list.find(lecture=>lecture.id===selected);
  if(!l||!lectureIsLoaded(l)){
    renderLectureNav();
    renderSubtopicNav();
    updateStatus();
    $('empty').classList.add('show');
    $('emptyMessage').textContent=l?`Loading ${l.title}…`:'Choose a lecture to begin.';
    return
  }
  const sec=document.createElement('section');sec.className='lecture';sec.id='lecture-'+l.id;sec.dataset.lecture=l.id;
  sec.innerHTML=`<header class="lecture-head"><div><div class="lecture-kicker">Lecture ${String(l.order).padStart(2,'0')} • ${esc(l.subject)}</div><h2 class="lecture-title">${esc(l.title)}</h2><div class="lecture-summary">${esc(l.subtitle)}</div><details class="source-boundary"><summary>Lecture source boundary</summary><div>${esc(l.sourceNote)}</div></details></div><div class="lecture-side"><div class="lecture-counts"><span class="count-pill">${l.cases.length} MEQ cases</span><span class="count-pill">${l.coreShorts.length} high-yield shorts</span><span class="count-pill">${l.imageQuestions.length} image questions</span><span class="count-pill">${l.detailedShorts.length} detailed practice</span></div><div class="quick-views"><button class="quick-view-btn" data-view="case" data-lecture="${l.id}"><span class="quick-view-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"></path><path d="M4 10h16"></path><path d="M10 5v14"></path></svg></span><span>Cases</span></button><button class="quick-view-btn" data-view="core" data-lecture="${l.id}"><span class="quick-view-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"></path><path d="M8 8h8"></path><path d="M8 12h8"></path><path d="M8 16h5"></path></svg></span><span>Short Questions</span></button><button class="offline-lecture-btn" type="button" data-lecture="${l.id}">Save lecture offline</button><button class="quick-reset" data-view="all" data-lecture="${l.id}">Show all content</button></div></div></header>
  <div class="content-section cases-section" data-section-type="case"><div class="section-head" id="${l.id}-cases"><div><h2>MEQ Cases</h2><p>Progressive scenarios, model answers, marking schemes and exam traps.</p></div><span class="section-badge">Start here for application</span></div><div class="study-grid cases-grid"></div></div>
  <div class="content-section core-section" data-section-type="core"><div class="section-head" id="${l.id}-core"><div><h2>High-Yield Short Questions</h2><p>The essential short notes, enumerations and comparisons.</p></div><span class="section-badge">Core exam list</span></div><div class="study-grid shorts core-grid"></div></div>
  <div class="content-section image-section" data-section-type="image"><div class="section-head" id="${l.id}-images"><div><h2>Image & Spot Questions</h2><p>Original lecture figures embedded inside the bank.</p></div><span class="section-badge">Visual revision</span></div><div class="study-grid images image-grid"></div></div>
  <div class="content-section extra-section" data-section-type="extra"><div class="section-head"><div><h2>Detailed Practice</h2><p>The original direct questions are preserved for deeper repetition.</p></div></div><details class="practice-details"><summary>Open detailed practice questions (${l.detailedShorts.length})</summary><div class="practice-body"><div class="study-grid shorts extra-grid"></div></div></details></div>
  <div class="content-section rapid-section" data-section-type="rapid"><div class="section-head" id="${l.id}-rapid"><div><h2>Rapid Recall</h2><p>Click each card to reveal the one-line answer.</p></div></div><section class="rapid"><div class="rapid-grid"></div></section></div>`;
  container.appendChild(sec);
  l.cases.forEach((c,i)=>sec.querySelector('.cases-grid').appendChild(caseCard(l,c,i)));
  l.coreShorts.forEach((q,i)=>sec.querySelector('.core-grid').appendChild(shortCard(l,q,i,'core','High-Yield Short')));
  l.imageQuestions.forEach((q,i)=>sec.querySelector('.image-grid').appendChild(imageCard(l,q,i)));
  l.detailedShorts.forEach((q,i)=>sec.querySelector('.extra-grid').appendChild(shortCard(l,q,i,'extra','Detailed Question')));
  const rg=sec.querySelector('.rapid-grid');l.rapid.forEach(([q,a],i)=>{const d=document.createElement('button');d.type='button';d.className='rapid-item';d.setAttribute('aria-expanded','false');d.innerHTML=`<strong>${i+1}. ${esc(q)}</strong><span class="rapid-answer">${esc(a)}</span>`;d.onclick=()=>{const open=d.classList.toggle('open');d.setAttribute('aria-expanded',open?'true':'false')};rg.appendChild(d)});
  bind();renderLectureNav();renderSubtopicNav();updateStatus();applyFilters()
}

function bind(){
  document.querySelectorAll('.toggle').forEach(b=>b.onclick=()=>{const item=b.closest('.study-item');item.classList.toggle('open');b.textContent=item.classList.contains('open')?'Hide answer':(item.dataset.type==='case'?'Show model answer':'Show answer')});
  document.querySelectorAll('.status').forEach(b=>b.onclick=()=>{const k=b.dataset.key,s=b.dataset.status,next=state[k]===s?'':s;if(next)state[k]=next;else delete state[k];const progressStore=globalThis.MEQProgressStore;if(progressStore?.set)progressStore.set(k,next).catch(error=>{console.warn('Could not save progress item in IndexedDB; using legacy fallback:',error);storage.set('medicalBankStatusV2',JSON.stringify(state))});else storage.set('medicalBankStatusV2',JSON.stringify(state));updateStatus()});
  document.querySelectorAll('.quick-view-btn,.quick-reset').forEach(b=>b.onclick=()=>{const view=b.dataset.view;$('typeFilter').value=view;activeSubtopic='all';renderSubtopicNav();applyFilters();const suffix=view==='case'?'cases':view==='core'?'core':'';if(suffix)document.getElementById(b.dataset.lecture+'-'+suffix)?.scrollIntoView({behavior:scrollBehavior(),block:'start'});else document.getElementById('lecture-'+b.dataset.lecture)?.scrollIntoView({behavior:scrollBehavior(),block:'start'})});
  document.querySelectorAll('.offline-lecture-btn').forEach(button=>{
    const lectureId=button.dataset.lecture;
    const api=globalThis.MEQOfflineCache;
    if(!api||!lectureId){button.hidden=true;return}
    const sync=()=>api.isLectureCached(lectureId).then(cached=>{
      if(!button.isConnected)return;
      button.dataset.cached=cached?'1':'0';
      button.setAttribute('aria-pressed',cached?'true':'false');
      button.textContent=cached?'Remove offline copy':'Save lecture offline'
    }).catch(()=>{});
    sync();
    button.onclick=async()=>{
      button.disabled=true;
      button.setAttribute('aria-busy','true');
      const previous=button.textContent;
      button.textContent='Updating offline copy…';
      try{
        const cached=await api.isLectureCached(lectureId);
        if(cached)await api.removeLecture(lectureId);else await api.cacheLecture(lectureId);
        await sync()
      }catch(error){
        console.warn('Could not update offline lecture cache:',error);
        button.textContent=previous;
        const message=api.describeError?.(error)||'Could not update this offline copy.';
        document.getElementById('appToast')?.replaceChildren(document.createTextNode(message));
        document.getElementById('appToast')?.classList.add('show');
        clearTimeout(window.__meqOfflineToastTimer);
        window.__meqOfflineToastTimer=setTimeout(()=>document.getElementById('appToast')?.classList.remove('show'),3200)
      }finally{button.disabled=false;button.removeAttribute('aria-busy')}
    }
  })
}
function syncQuickButtons(){const type=$('typeFilter').value;document.querySelectorAll('.quick-view-btn,.quick-reset').forEach(b=>{const active=b.dataset.view===type;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active?'true':'false')})}
function updateStudyBreadcrumb(){
  const nav=$('studyBreadcrumb');
  if(!nav)return;
  const course=globalThis.MEQCourseRegistry?.courses?.find?.(item=>item.id===activeCourseId());
  const subject=subjects.find(item=>item.id===activeSubject);
  const lecture=currentLecture();
  const selected=$('lectureFilter')?.value;
  const metadata=visibleLectures().find(item=>item.id===selected);
  const current=selected==='all'?'Lecture overview':lecture?.title||metadata?.title||'Choose a lecture';
  nav.innerHTML=`<ol>
    <li><span>Course</span><strong>${esc(course?.label||'Medical course')}</strong></li>
    <li aria-hidden="true" class="breadcrumb-separator">/</li>
    <li><span>Specialty</span><strong>${esc(subject?.label||'Subject')}</strong></li>
    <li aria-hidden="true" class="breadcrumb-separator">/</li>
    <li aria-current="page"><span>Location</span><strong>${esc(current)}</strong></li>
  </ol>`
}
function updateStatus(){
  document.querySelectorAll('.status').forEach(b=>b.classList.toggle('active',state[b.dataset.key]===b.dataset.status));
  const scope=visibleLectures(),progress=subjectProgressCounts(scope);
  const {totals,coreTotal,overallTotal,coreDone,overallDone,mastered}=progress;
  $('lectureCount').textContent=scope.length;
  $('caseCount').textContent=totals.cases;
  $('coreCount').textContent=totals.coreShorts;
  $('imageCount').textContent=totals.imageQuestions;
  $('masteredCount').textContent=mastered;
  const cp=coreTotal?Math.round(coreDone/coreTotal*100):0,op=overallTotal?Math.round(overallDone/overallTotal*100):0;
  $('coreProgressText').textContent=cp+'%';$('coreProgressFill').style.width=cp+'%';$('coreProgressBar')?.setAttribute('aria-valuenow',String(cp));
  $('overallProgressText').textContent=op+'%';$('overallProgressFill').style.width=op+'%';$('overallProgressBar')?.setAttribute('aria-valuenow',String(op));
  const subject=subjects.find(s=>s.id===activeSubject);
  $('heroTags').innerHTML=`<span class="hero-tag">${esc(subject?.label||'Subject')}</span><span class="hero-tag">${scope.length} Lecture${scope.length===1?'':'s'}</span><span class="hero-tag">${totals.cases} MEQ Cases</span><span class="hero-tag">${totals.coreShorts} Core Shorts</span><span class="hero-tag">Saved Progress</span>`;
  updateStudyBreadcrumb()
}
function updateTopicOptions(){const lecture=currentLecture();const list=lecture?[lecture]:[];const topics=[...new Set(list.flatMap(l=>[...l.cases.map(c=>c.topic),...l.coreShorts.map(q=>q.topic),...l.imageQuestions.map(q=>q.topic),...l.detailedShorts.map(q=>q.topic)]))].sort();const old=$('topicFilter').value;$('topicFilter').innerHTML='<option value="all">All topics</option>'+topics.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');$('topicFilter').value=topics.includes(old)?old:'all'}
function applyFilters(){
  const q=$('search').value.toLowerCase().trim(),lf=$('lectureFilter').value,tf=$('typeFilter').value,topic=$('topicFilter').value,prio=$('priorityFilter').value;let visible=0;
  document.querySelectorAll('.study-item').forEach(it=>{const subOk=activeSubtopic==='all'||(it.dataset.subtopics||'').split(' ').includes(activeSubtopic);const show=(!q||it.dataset.search.includes(q))&&(lf==='all'||it.dataset.lecture===lf)&&(tf==='all'||it.dataset.type===tf)&&(topic==='all'||it.dataset.topic===topic)&&(prio==='all'||it.dataset.priority===prio)&&subOk;it.classList.toggle('hidden',!show);if(show)visible++});
  document.querySelectorAll('.lecture').forEach(l=>{const lectureAllowed=lf==='all'||l.dataset.lecture===lf;const any=[...l.querySelectorAll('.study-item')].some(x=>!x.classList.contains('hidden'));l.classList.toggle('hidden',!(lectureAllowed&&any))});
  document.querySelectorAll('.content-section').forEach(sec=>{const any=[...sec.querySelectorAll('.study-item')].some(x=>!x.classList.contains('hidden'));if(sec.dataset.sectionType==='rapid'){const clean=tf==='all'&&!q&&topic==='all'&&prio==='all'&&activeSubtopic==='all';sec.classList.toggle('hidden',!clean)}else sec.classList.toggle('hidden',!any)});
  const noSubjectLectures=visibleLectures().length===0;$('empty').classList.toggle('show',visible===0);$('emptyMessage').textContent=noSubjectLectures?`No lectures have been added to ${subjects.find(s=>s.id===activeSubject)?.label||'this subject'} yet.`:'No study items match the current filters.';syncQuickButtons()
}

function setSidebarState(){const layout=$('mainLayout');const hideL=storage.get('medicalBankHideLecturesV4')==='1',hideS=storage.get('medicalBankHideSubtopicsV4')==='1';layout.classList.toggle('hide-lectures',hideL);layout.classList.toggle('hide-subtopics',hideS);$('toggleLectures').classList.toggle('active',!hideL);$('toggleSubtopics').classList.toggle('active',!hideS)}
function toggleSidebar(kind){const k=kind==='lectures'?'medicalBankHideLecturesV4':'medicalBankHideSubtopicsV4';storage.set(k,storage.get(k)==='1'?'0':'1');setSidebarState()}

populateSubjectSelector();populateLectureFilter();updateTopicOptions();render();validateBank();setSidebarState();
$('subjectSelector').addEventListener('change',()=>{activeSubject=$('subjectSelector').value;storage.set('medicalBankSubjectV4',activeSubject);activeSubtopic='all';delete $('lectureFilter').dataset.explicitAll;populateLectureFilter();updateTopicOptions();render();validateBank()});
$('lectureFilter').addEventListener('change',()=>selectLecture($('lectureFilter').value,false));
['search','typeFilter','topicFilter','priorityFilter'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{applyFilters();syncQuickButtons()}));
$('revealBtn').setAttribute('aria-pressed','false');
$('revealBtn').onclick=()=>{revealAll=!revealAll;$('revealBtn').setAttribute('aria-pressed',revealAll?'true':'false');document.querySelectorAll('.study-item:not(.hidden)').forEach(it=>{it.classList.toggle('open',revealAll);const b=it.querySelector('.toggle');if(b)b.textContent=revealAll?'Hide answer':(it.dataset.type==='case'?'Show model answer':'Show answer')});$('revealBtn').textContent=revealAll?'Hide all':'Reveal all'};
$('randomBtn').onclick=()=>{let list=[...document.querySelectorAll('.study-item:not(.hidden)')];if($('typeFilter').value==='all'){const core=list.filter(x=>x.dataset.type!=='extra');if(core.length)list=core}if(!list.length)return;const it=list[Math.floor(Math.random()*list.length)];const parentDetails=it.closest('details');if(parentDetails)parentDetails.open=true;it.scrollIntoView({behavior:scrollBehavior(),block:'center'});if(!reduceMotion())it.animate([{outline:'5px solid #f79009'},{outline:'0 solid transparent'}],{duration:1300})};
function syncThemeButton(){
  const button=$('darkBtn');
  if(!button)return;
  const dark=document.body.classList.contains('dark');
  const label=button.querySelector('[data-theme-label]');
  if(label)label.textContent=dark?'Light mode':'Dark mode';
  button.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode')
}
$('darkBtn').onclick=()=>{document.body.classList.toggle('dark');storage.set('medicalBankDarkV4',document.body.classList.contains('dark')?'1':'0');syncThemeButton()};
$('toggleLectures').onclick=()=>toggleSidebar('lectures');$('toggleSubtopics').onclick=()=>toggleSidebar('subtopics');
$('emptyResetBtn').onclick=()=>{
  const reset=document.getElementById('resetFiltersBtn');
  if(reset){reset.click();return}
  $('search').value='';
  if([...$('lectureFilter').options].some(option=>option.value==='all'))$('lectureFilter').value='all';
  $('typeFilter').value='all';
  $('priorityFilter').value='all';
  const review=document.getElementById('reviewFilter');
  if(review)review.value='all';
  activeSubtopic='all';
  updateTopicOptions();
  $('topicFilter').value='all';
  renderSubtopicNav();
  applyFilters()
};
if(storage.get('medicalBankDarkV4')==='1'||storage.get('medicalBankDarkV3')==='1')document.body.classList.add('dark');
syncThemeButton()
