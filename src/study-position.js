/* R03 — Device-only reading checkpoints. Separate from exam attempts and graded items. */
(() => {
  'use strict';
  const DB_NAME='medicalLibraryWorkspaceV1';
  const STORE='checkpoints';
  const IDS=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const SECTION=/^e-[1-9][0-9]*$/;
  let databasePromise=null,writeQueue=Promise.resolve(),card=null,button=null,label=null;

  const validId=value=>typeof value==='string'&&value.length<=200&&IDS.test(value);
  function openDatabase(){
    if(!('indexedDB' in globalThis))return Promise.reject(new Error('Device storage is unavailable.'));
    if(databasePromise)return databasePromise;
    databasePromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>{
        if(!request.result.objectStoreNames.contains(STORE))
          request.result.createObjectStore(STORE,{keyPath:'key'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('Could not open reading-position storage.'));
      request.onblocked=()=>reject(new Error('Reading-position storage is blocked by another tab.'));
    }).catch(error=>{databasePromise=null;throw error;});
    return databasePromise;
  }
  async function getRecord(key){
    const db=await openDatabase();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const request=tx.objectStore(STORE).get(key);
      let record=null;
      request.onsuccess=()=>{record=request.result||null;};
      tx.oncomplete=()=>resolve(record);
      tx.onabort=()=>reject(tx.error||new Error('Reading-position lookup was interrupted.'));
      tx.onerror=()=>reject(tx.error||new Error('Reading-position lookup failed.'));
    });
  }
  async function putRecord(record){
    const db=await openDatabase();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      const store=tx.objectStore(STORE);
      store.put({...record,key:'latest'});
      store.put({...record,key:'lecture:'+record.courseId+'::'+record.subjectId+'::'+record.lectureId});
      tx.oncomplete=()=>resolve();
      tx.onabort=()=>reject(tx.error||new Error('Reading-position save was interrupted.'));
      tx.onerror=()=>reject(tx.error||new Error('Reading-position save failed.'));
    });
  }
  const announce=message=>{
    const target=document.getElementById('workspaceNavigationNotice');
    if(!target)return;
    target.textContent=message;target.hidden=!message;
  };
  function validate(record,catalog){
    if(!record||record.schemaVersion!==1||!['lecture','practice'].includes(record.view)||
       !validId(record.courseId)||!validId(record.subjectId)||!validId(record.lectureId))
      return {ok:false,reason:'The saved place is invalid.'};
    const entry=(Array.isArray(catalog)?catalog:catalog?.lectures||[])
      .find(item=>item.id===record.lectureId);
    if(!entry||entry.courseId!==record.courseId||entry.subjectKey!==record.subjectId)
      return {ok:false,reason:'That lecture is no longer available in this library.'};
    const path=record.view==='practice'?'#/practice':'#/lecture/'+record.lectureId;
    if(typeof record.route!=='string'||!record.route.startsWith(path+'?'))
      return {ok:false,reason:'The saved lecture link is invalid.'};
    const query=new URLSearchParams(record.route.slice(record.route.indexOf('?')+1));
    if(query.get('course')!==record.courseId||query.get('subject')!==record.subjectId||
       query.getAll('course').length!==1||query.getAll('subject').length!==1)
      return {ok:false,reason:'The saved lecture scope has changed.'};
    if(record.sectionId&&!SECTION.test(record.sectionId))
      return {ok:false,reason:'The saved section reference is invalid.'};
    if(record.view==='practice'&&(!validId(record.questionId)||
       query.get('lecture')!==record.lectureId||query.get('question')!==record.questionId||
       query.getAll('lecture').length!==1||query.getAll('question').length!==1))
      return {ok:false,reason:'The saved question reference is invalid.'};
    return {ok:true,entry};
  }
  async function read(scope=null){
    // Wait for the latest in-page navigation commit; never read a half-written checkpoint.
    await writeQueue.catch(()=>{});
    if(!scope)return getRecord('latest');
    if(!validId(scope.courseId)||!validId(scope.subjectId)||!validId(scope.lectureId))
      return null;
    return getRecord('lecture:'+scope.courseId+'::'+scope.subjectId+'::'+scope.lectureId);
  }
  function queueRecord(record){
    const task=writeQueue.catch(()=>{}).then(async()=>{
      try{await putRecord(record);return {saved:true};}
      catch(error){return {saved:false,error:error?.message||'Device storage failed.'};}
    });
    writeQueue=task;
    return task;
  }
  function save(context,anchor={}){
    if(context?.view!=='lecture'||!validId(context.courseId)||
       !validId(context.subjectId)||!validId(context.lectureId))
      return Promise.resolve({saved:false,error:'Invalid lecture context.'});
    const tab=anchor.tab||new URLSearchParams(location.hash.split('?')[1]||'').get('tab')||'explanation';
    if(!/^[a-z-]{1,35}$/.test(tab))
      return Promise.resolve({saved:false,error:'Invalid study mode.'});
    const sectionId=anchor.sectionId||null;
    const topicId=anchor.topicId||null;
    if(sectionId&&!SECTION.test(sectionId) || topicId&&!validId(topicId))
      return Promise.resolve({saved:false,error:'Invalid reading position.'});
    const params=new URLSearchParams({
      course:context.courseId,subject:context.subjectId,tab
    });
    if(sectionId)params.set('section',sectionId);
    if(topicId)params.set('topic',topicId);
    const route='#/lecture/'+context.lectureId+'?'+params.toString();
    const index=sectionId?Number(sectionId.slice(2))-1:-1;
    const source=document.getElementById('lecture-'+context.lectureId);
    const heading=source?.querySelectorAll('.study-guide-explanation')[index]
      ?.querySelector('h3')?.textContent?.trim()||null;
    if(sectionId&&!heading)
      return Promise.resolve({saved:false,error:'This section is no longer available.'});
    const record={
      schemaVersion:1,view:'lecture',courseId:context.courseId,
      subjectId:context.subjectId,lectureId:context.lectureId,
      tab,sectionId,topicId,sectionHeading:heading,route,
      updatedAt:new Date().toISOString()
    };
    return queueRecord(record);
  }
  function savePractice(context,questionId){
    if(context?.view!=='practice'||!validId(context.courseId)||
       !validId(context.subjectId)||!validId(context.lectureId)||
       !validId(questionId)||!questionId.startsWith(context.lectureId+'-'))
      return Promise.resolve({saved:false,error:'Invalid Practice question context.'});
    const params=new URLSearchParams({course:context.courseId,subject:context.subjectId,
      lecture:context.lectureId,question:questionId});
    const record={schemaVersion:1,view:'practice',courseId:context.courseId,
      subjectId:context.subjectId,lectureId:context.lectureId,tab:'questions',
      sectionId:null,topicId:null,questionId,
      route:'#/practice?'+params.toString(),updatedAt:new Date().toISOString()};
    return queueRecord(record);
  }
  async function catalogForValidation(){
    if(globalThis.MEQLectureLoader?.loadCatalog)
      return globalThis.MEQLectureLoader.loadCatalog();
    return {lectures:typeof lectures==='undefined'?[]:lectures};
  }
  async function refreshCard(){
    if(!card)return;
    card.hidden=true;
    if(document.body.dataset.workspace!=='library')return;
    try{
      const record=await read();
      const result=validate(record,await catalogForValidation());
      if(!result.ok||document.body.dataset.workspace!=='library')return;
      card.hidden=false;
      button.textContent='Continue '+result.entry.title;
      label.textContent=record.view==='practice'
        ?'Return to your last question on this device.'
        :'Return to your last reading position on this device.';
    }catch(error){
      // Read-only Library stays usable when IndexedDB is denied.
    }
  }
  async function continueReading(){
    button.disabled=true;
    try{
      const record=await read();
      const result=validate(record,await catalogForValidation());
      if(!result.ok){announce(result.reason);card.hidden=true;return;}
      let target=record.route;
      if(record.sectionId&&record.sectionHeading){
        const loader=globalThis.MEQLectureLoader;
        if(loader){
          await loader.loadSubjectMetadata(record.subjectId,record.courseId);
          await loader.loadLecture(record.lectureId,{refresh:false,busy:false});
        }
        const lecture=typeof lectures==='undefined'?null:
          lectures.find(item=>item.id===record.lectureId);
        const actual=lecture?.studyGuide?.explanation?.[Number(record.sectionId.slice(2))-1]?.heading;
        if(actual!==record.sectionHeading){
          const [path,search='']=target.split('?',2);
          const query=new URLSearchParams(search);query.delete('section');
          target=path+'?'+query.toString();
          announce('The source section has changed; the lecture is opened from its start.');
        }
      }
      location.hash=target;
    }catch(error){
      announce('Your reading position could not be restored. Saved ratings are unchanged.');
    }finally{button.disabled=false;}
  }
  function mountCard(){
    const layout=document.getElementById('mainLayout');
    if(!layout||card)return;
    card=document.createElement('section');
    card.id='continueLastStudyCard';
    card.className='study-resume-card';card.hidden=true;
    card.setAttribute('aria-label','Continue studying');
    label=document.createElement('p');
    label.textContent='Continue from your last saved section.';
    button=document.createElement('button');
    button.type='button';button.className='btn btn-primary';
    button.id='continueLastStudy';
    button.addEventListener('click',continueReading);
    card.append(label,button);
    layout.before(card);
    // Route readiness is authoritative; DOMContentLoaded and hashchange alone
    // can run before the catalog/active workspace has settled.
    globalThis.MEQStudyContext?.subscribe(next=>{
      if(next?.view==='library')refreshCard();
      else card.hidden=true;
    });
    refreshCard();
  }
  document.addEventListener('meq:reader-position-changed',event=>{
    const context=globalThis.MEQStudyContext?.get();
    if(context?.view!=='lecture'||context.lectureId!==event.detail?.lectureId)return;
    save(context,event.detail).then(result=>{
      if(!result.saved)announce('Could not save your reading position on this device: '+result.error);
    });
  });
  window.addEventListener('hashchange',()=>queueMicrotask(refreshCard));
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',mountCard,{once:true});
  else mountCard();
  globalThis.MEQStudyPosition=Object.freeze({read,save,savePractice,validate});
})();