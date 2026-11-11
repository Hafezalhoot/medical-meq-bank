/* Study recovery R01. One routing boundary; no grade, exam or clinical-data writes.
   Legacy non-route anchors remain an unadvertised compatibility surface until
   their functions migrate. The public root and #/home always open Library. */
(() => {
  const views=new Set(['library','practice','review','exams','manage']);
  const idPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const nav=document.querySelector('[aria-label="Primary workspace"]');
  const status=document.getElementById('workspaceRouteStatus');
  const notice=document.getElementById('workspaceNavigationNotice');
  const examEntry=document.getElementById('workspaceExamEntry');
  const review=document.getElementById('myReviewDisclosure');
  const practiceIntro=document.getElementById('practiceIntro');
  const practiceEmpty=document.getElementById('practiceEmpty');
  const listeners=new Set();
  let sequence=0,context=null,applyingScope=false,catalog=null;

  function parseRoute(hash){
    if(!hash||hash==='#')return {view:'library',params:new URLSearchParams()};
    const oldLecture=/^#lecture-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(hash);
    if(oldLecture)return {view:'lecture',id:oldLecture[1],params:new URLSearchParams()};
    if(!hash.startsWith('#/'))return null;
    const [path,search='']=hash.slice(2).split('?',2),params=new URLSearchParams(search);
    if(path==='home'||views.has(path))return {view:path==='home'?'library':path,params};
    if(/^lecture\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path))
      return {view:'lecture',id:path.slice(8),params};
    return {view:'library',params:new URLSearchParams(),invalid:true};
  }

  const modeForTab=tab=>tab==='original-figures'||tab==='images'?'figures':tab==='rapid'?'rapid':
    ['mcqs','cases','shorts','detailed','questions'].includes(tab)?'questions':'read';

  function resolveContext(route,sourceCatalog){
    const registry=globalThis.MEQCourseRegistry;
    if(!registry)return {ok:false,reason:'Library metadata is not ready.'};
    if(!route)return {ok:true,context:null};
    const params=route.params||new URLSearchParams();
    if(['course','subject','tab'].some(key=>params.getAll(key).length>1))
      return {ok:false,reason:'The link has conflicting selections. Choose a lecture from Library.'};
    const entries=Array.isArray(sourceCatalog)?sourceCatalog:sourceCatalog?.lectures||[];
    const lecture=route.view==='lecture'?entries.find(item=>item.id===route.id):null;
    if(route.view==='lecture'&&!lecture)return {ok:false,reason:'This lecture link is not available. Choose a lecture from Library.'};
    const courseId=params.get('course')||lecture?.courseId||registry.activeCourse;
    const pack=registry.packs.get(courseId);
    if(!pack)return {ok:false,reason:'This course link is not available. Choose a course from Library.'};
    const subjectId=params.get('subject')||lecture?.subjectKey||
      (courseId===registry.activeCourse?document.getElementById('subjectSelector')?.value:'')||pack.defaultSubject||pack.subjects[0]?.id;
    if(!pack.subjects.some(item=>item.id===subjectId)||
       (lecture&&(lecture.courseId!==courseId||lecture.subjectKey!==subjectId)))
      return {ok:false,reason:'This lecture does not belong to the selected course or specialty. Choose it from Library.'};
    const tab=params.get('tab');
    const mode=modeForTab(tab);
    return {ok:true,context:Object.freeze({schemaVersion:1,view:route.view,courseId,subjectId,
      lectureId:lecture?.id||null,mode,topicId:null,sectionId:null,question:null})};
  }

  function commitContext(next){
    context=next;
    for(const listener of listeners){
      try{listener(context);}catch(error){console.warn('Study navigation subscriber failed:',error);}
    }
  }
  function replaceHash(hash){
    if(location.hash===hash)return;
    const url=new URL(location.href);url.hash=hash;
    history.replaceState(history.state,'',url.href);
  }
  function scopedHash(next,params=new URLSearchParams()){
    const query=new URLSearchParams(params);
    query.set('course',next.courseId);query.set('subject',next.subjectId);
    return '#/'+(next.view==='lecture'?'lecture/'+next.lectureId:next.view)+'?'+query;
  }
  function inform(message=''){
    if(notice){notice.textContent=message;notice.hidden=!message;}
  }
  function applySurface(view){
    const previous=document.body.dataset.workspace;
    if(view)document.body.dataset.workspace=view;else delete document.body.dataset.workspace;
    examEntry.hidden=view!=='exams';
    if(practiceIntro)practiceIntro.hidden=view!=='practice';
    if(view!=='practice'&&practiceEmpty)practiceEmpty.hidden=true;
    const random=document.getElementById('randomBtn'),reveal=document.getElementById('revealBtn');
    if(random)random.textContent=view==='practice'?'Random question':'Random item';
    if(reveal){reveal.disabled=false;reveal.textContent=view==='practice'?'Reveal current answer':revealAll?'Hide all':'Reveal all';}
    nav?.querySelectorAll('a').forEach(link=>{
      if(view&&link.dataset.workspaceLink===(view==='lecture'?'library':view))link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
    if(status)status.textContent=view==='lecture'?'Lecture reader':view?view.charAt(0).toUpperCase()+view.slice(1)+' workspace':'';
    if(view&&document.querySelector('.app.study-focus'))setFocusMode(false);
    if(previous==='practice'&&view==='lecture')render();
  }
  function activateScope(next){
    const registry=globalThis.MEQCourseRegistry,select=document.getElementById('subjectSelector');
    applyingScope=true;
    try{
      if(registry.activeCourse!==next.courseId)registry.activateCourse(next.courseId,{preserveSubject:false});
      if(select.value!==next.subjectId){select.value=next.subjectId;select.dispatchEvent(new Event('change',{bubbles:true}));}
    }finally{applyingScope=false;}
  }
  function refreshLibrary(){
    if(document.body.dataset.workspace!=='library')return;
    const type=document.getElementById('typeFilter');if(type)type.value='all';
    populateLectureFilter();selectLecture('all',false);
  }

  async function applyRoute(){
    const ticket=++sequence;
    let route=parseRoute(location.hash);
    inform();
    // Set the surface synchronously: asynchronous metadata never exposes the old
    // stacked page at the default entry, including cold PWA/standalone loads.
    applySurface(route?.view||null);
    if(!route){commitContext(null);return;}
    if(!location.hash||location.hash==='#'||location.hash.startsWith('#/home')||route.invalid)
      replaceHash('#/library');
    try{
      catalog=globalThis.MEQLectureLoader?await globalThis.MEQLectureLoader.loadCatalog():{lectures};
      if(ticket!==sequence)return;
      let result=resolveContext(route,catalog);
      if(!result.ok){
        inform(result.reason);
        route={view:'library',params:new URLSearchParams()};
        result=resolveContext(route,catalog);
        if(!result.ok)return;
        replaceHash('#/library');applySurface('library');
      }else if(route.invalid)inform('That page is not available. Your library is shown instead.');
      const next=result.context;
      commitContext(next);activateScope(next);
      // A complete scope in the URL makes browser Back/Forward and copied links
      // independent of remembered selector values. This writes no learner data.
      replaceHash(scopedHash(next,route.params));
      const loader=globalThis.MEQLectureLoader;
      if(next.view==='library'){
        if(loader?.loadSubjectMetadata)await loader.loadSubjectMetadata(next.subjectId,next.courseId);
        if(ticket!==sequence)return;
        refreshLibrary();
      }else if(next.view==='lecture'){
        if(loader?.loadSubjectMetadata)await loader.loadSubjectMetadata(next.subjectId,next.courseId);
        if(ticket!==sequence)return;
        populateLectureFilter();
        document.getElementById('lectureFilter').value=next.lectureId;
        if(loader?.loadLecture)await loader.loadLecture(next.lectureId,{refresh:false});
        if(ticket!==sequence)return;
        selectLecture(next.lectureId,false);
        const lecture=lectures.find(item=>item.id===next.lectureId);
        if(lecture)configureReaderWorkspace(lecture);
      }else if(next.view==='review')review.open=true;
      else if(next.view==='practice')enterPracticeRoute();
      if(ticket===sequence)window.scrollTo({top:0,behavior:'instant'});
    }catch(error){
      if(ticket!==sequence)return;
      inform('Library content could not be loaded. Reconnect and choose Library to retry.');
      if(status)status.textContent='Navigation needs a retry; saved progress is unchanged.';
    }
  }

  function navigate(next,{history:mode='push'}={}){
    if(!next||!['push','replace'].includes(mode))return {ok:false,reason:'Invalid navigation request.'};
    if(!views.has(next.view)&&next.view!=='lecture')return {ok:false,reason:'Unknown workspace.'};
    if(next.view==='lecture'&&(!idPattern.test(next.lectureId||'')||(next.lectureId||'').length>200))return {ok:false,reason:'Invalid lecture ID.'};
    const params=new URLSearchParams();
    if(next.courseId)params.set('course',next.courseId);
    if(next.subjectId)params.set('subject',next.subjectId);
    if(next.mode)params.set('tab',{read:'explanation',questions:'mcqs',figures:'original-figures',rapid:'rapid'}[next.mode]||next.mode);
    const route={view:next.view,id:next.lectureId,params},result=resolveContext(route,catalog);
    if(!result.ok)return result;
    const hash=scopedHash(result.context,params);
    if(mode==='replace'){replaceHash(hash);applyRoute();}
    else if(location.hash!==hash)location.hash=hash;
    else applyRoute();
    return result;
  }
  function openLecture(id){
    if(!idPattern.test(id)||id.length>200)return;
    const lecture=catalog?.lectures?.find(item=>item.id===id)||lectures.find(item=>item.id===id);
    const params=new URLSearchParams();
    if(lecture?.courseId)params.set('course',lecture.courseId);
    if(lecture?.subjectKey)params.set('subject',lecture.subjectKey);
    location.hash='#/lecture/'+id+(params.size?'?'+params:'');
  }
  function reflectScope(){
    if(applyingScope||!context)return;
    const registry=globalThis.MEQCourseRegistry;
    const courseId=registry.activeCourse,subjectId=document.getElementById('subjectSelector').value;
    if(context.view==='lecture'){
      navigate({view:'library',courseId,subjectId});return;
    }
    const next=Object.freeze({...context,courseId,subjectId});
    commitContext(next);replaceHash(scopedHash(next));refreshLibrary();
  }

  globalThis.MEQStudyContext=Object.freeze({
    parse:(hash,sourceCatalog=catalog)=>resolveContext(parseRoute(hash),sourceCatalog),
    get:()=>context,navigate,
    subscribe(listener){if(typeof listener!=='function')throw new TypeError('Expected a navigation listener');listeners.add(listener);return()=>listeners.delete(listener);}
  });
  globalThis.MEQWorkspace=Object.freeze({openLecture,parseRoute});
  document.getElementById('workspaceExamStart')?.addEventListener('click',()=>document.getElementById('examModeBtn')?.click());
  document.getElementById('browseLibraryLink')?.addEventListener('click',event=>{
    if(!document.body.dataset.workspace)return;
    event.preventDefault();location.hash='#/library';
  },true);
  document.querySelector('.skip-link')?.addEventListener('click',event=>{
    if(!document.body.dataset.workspace||document.body.dataset.workspace==='manage')return;
    event.preventDefault();
    const target=document.getElementById('mainContent');target?.focus();target?.scrollIntoView({block:'start'});
  });
  document.getElementById('subjectSelector')?.addEventListener('change',reflectScope);
  document.addEventListener('meq:course-changed',reflectScope);
  document.addEventListener('meq:lectures-loaded',()=>{
    if(document.body.dataset.workspace==='library')refreshLibrary();
    else if(document.body.dataset.workspace==='practice')enterPracticeRoute();
  });
  document.addEventListener('meq:reader-position-changed',event=>{
    if(context?.view!=='lecture'||context.lectureId!==event.detail?.lectureId)return;
    const {topicId=null,sectionId=null}=event.detail;
    commitContext(Object.freeze({...context,topicId,sectionId}));
  });
  document.addEventListener('meq:reader-mode-changed',event=>{
    if(context?.view!=='lecture'||context.lectureId!==event.detail?.lectureId)return;
    commitContext(Object.freeze({...context,mode:modeForTab(event.detail.tab)}));
  });
  window.addEventListener('hashchange',applyRoute);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyRoute,{once:true});
  else applyRoute();
})();
