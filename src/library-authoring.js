/* Local metadata intake only. The repository tools revalidate before creating
   an empty private draft. No writes to learner storage or published registries. */
(() => {
  const initialize = () => {
    const root=document.getElementById('libraryManager');
    const form=document.getElementById('libraryIntakeForm');
    if(!root||!form)return;
    const field=name=>document.getElementById('intake'+name);
    const course=field('Course'),subject=field('Subject'),chapter=field('Chapter');
    const title=field('Title'),source=field('Source'),id=field('Id'),order=field('Order'),topics=field('Topics');
    const error=field('Error'),status=field('Status'),next=field('Next'),back=field('Back'),download=field('Download');
    let registry,entries=[],step=0,started=false,ready=false,loading=false,suggestedId='',recovered=false;
    const draftKey='medicalLibraryIntakeDraftV1';
    const draftFields=[course,subject,chapter,title,source,id,order,topics];
    function saveDraft(){
      if(!ready)return;
      try{sessionStorage.setItem(draftKey,JSON.stringify({step,values:draftFields.map(control=>control.value)}));}
      catch{/* Private browsing may disable session storage; downloading remains available. */}
    }
    function restoreDraft(){
      let saved;
      try{saved=JSON.parse(sessionStorage.getItem(draftKey)||'null');}catch{return;}
      if(!saved||!Array.isArray(saved.values)||saved.values.length!==draftFields.length||!Number.isInteger(saved.step)||saved.step<0||saved.step>3)return;
      const values=saved.values;
      if(!values.every(value=>typeof value==='string'||typeof value==='number'))return;
      if(!registry.packs.has(values[0]))return;
      course.value=values[0];refreshSubjects();
      if(![...subject.options].some(option=>option.value===values[1]))return;
      subject.value=values[1];refreshScope();
      if([...chapter.options].some(option=>option.value===values[2]))chapter.value=values[2];
      [title,source,id,order,topics].forEach((control,index)=>{control.value=String(values[index+3]);});
      suggestedId=id.value;step=saved.step;recovered=true;
    }
    const normalize=value=>value.trim().replace(/\s+/g,' ').toLowerCase();
    const selectedSubject=()=>registry?.packs.get(course.value)?.subjects.find(item=>item.id===subject.value);
    const scopedEntries=()=>entries.filter(item=>item.courseId===course.value&&item.subjectKey===subject.value);
    const options=(select,items)=>select.replaceChildren(...items.map(item=>new Option(item.label,item.id)));

    function clearError(){
      error.hidden=true;error.textContent='';
      form.querySelectorAll('[aria-invalid]').forEach(control=>{
        control.removeAttribute('aria-invalid');
        control.setAttribute('aria-describedby',control.dataset.originalDescription||'');
      });
    }
    function invalid(control,message){
      error.textContent=message;error.hidden=false;
      if(control){
        control.dataset.originalDescription=control.getAttribute('aria-describedby')||'';
        control.setAttribute('aria-invalid','true');
        control.setAttribute('aria-describedby',((control.dataset.originalDescription||'')+' intakeError').trim());
        control.focus();
      }
      return false;
    }
    function suggestIdentity(){
      const slug=title.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      const suggestion=slug?course.value+'-'+subject.value+'-'+slug:'';
      if(!id.value||id.value===suggestedId)id.value=suggestion;
      suggestedId=suggestion;
    }
    function refreshChapter(){
      const previous=chapter.value;
      const list=[...(selectedSubject()?.chapters||[])].sort((a,b)=>a.order-b.order);
      options(chapter,[{id:'',label:'No Chapter — list directly'},...list]);
      chapter.value=list.some(item=>item.id===previous)?previous:'';
      field('ChapterHint').textContent=list.length?'Choose an existing Chapter or list the lecture directly.':'No Chapters configured here. The lecture will appear directly under this specialty.';
    }
    function refreshScope(){
      chapter.value='';refreshChapter();
      order.value=String(Math.max(0,...scopedEntries().map(item=>Number(item.order)||0))+1);
      id.value='';suggestedId='';suggestIdentity();
    }
    function refreshSubjects(){
      const pack=registry.packs.get(course.value);
      options(subject,[...pack.subjects].sort((a,b)=>a.order-b.order));
      subject.value=pack.defaultSubject||subject.options[0]?.value||'';
      refreshScope();
    }
    function validateLocation(){
      if(!registry?.packs.has(course.value))return invalid(course,'Choose a registered Material / course.');
      const selected=selectedSubject();
      if(!selected)return invalid(subject,'Choose a specialty from this Material.');
      if(chapter.value&&!(selected.chapters||[]).some(item=>item.id===chapter.value))
        return invalid(chapter,'Choose a Chapter from this specialty.');
      return true;
    }
    function validateLecture(){
      if(!title.value.trim())return invalid(title,'Enter the lecture title from the source.');
      if(scopedEntries().some(item=>normalize(item.title)===normalize(title.value)))
        return invalid(title,'This lecture title is already published in this specialty.');
      if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id.value)||id.value.length>200)
        return invalid(id,'Use lowercase English letters, numbers and single hyphens between words.');
      if(entries.some(item=>item.id===id.value))return invalid(id,'ID already published. Choose a different stable lecture ID.');
      const number=Number(order.value);
      if(!Number.isSafeInteger(number)||number<1||number>99999||scopedEntries().some(item=>Number(item.order)===number))
        return invalid(order,'Choose a positive unused lecture order in this specialty.');
      if(!/^[^/\\\x00-\x1f\x7f]+\.pdf$/i.test(source.value.trim()))
        return invalid(source,'Enter a PDF filename only, without folders or control characters.');
      return true;
    }
    function topicList(){return topics.value.split(/\r?\n/).map(text=>text.trim()).filter(Boolean);}
    function validateTopics(){
      const list=topicList();
      if(!list.length||list.length>60)return invalid(topics,'Enter 1–60 topic headings, one per line.');
      if(list.some(text=>text.length>160))return invalid(topics,'Keep each topic heading within 160 characters.');
      if(new Set(list.map(normalize)).size!==list.length)return invalid(topics,'Duplicate topic heading. Keep each heading once.');
      return true;
    }
    function intake(){
      const lecture={course:course.value,subject:subject.value,title:title.value.trim(),id:id.value,
        order:Number(order.value),source:source.value.trim(),topics:topicList().map((label,index)=>({id:'topic-'+(index+1),label}))};
      if(chapter.value)lecture.chapterId=chapter.value;
      return {format:'medical-library-intake',version:1,status:'needs-source-review',lecture};
    }
    function preview(){
      const summary=field('Summary');summary.replaceChildren();
      for(const [name,value] of [
        ['Material',registry.packs.get(course.value).label],['Specialty',selectedSubject().label],
        ['Chapter',chapter.selectedOptions[0].textContent],['Lecture',title.value.trim()],
        ['Stable ID',id.value],['Order',order.value],['Source filename',source.value.trim()]
      ]){
        const row=document.createElement('div'),term=document.createElement('dt'),detail=document.createElement('dd');
        term.textContent=name;detail.textContent=value;detail.dir='auto';row.append(term,detail);summary.append(row);
      }
      field('TopicPreview').replaceChildren(...topicList().map(text=>{
        const item=document.createElement('li');item.textContent=text;item.dir='auto';return item;
      }));
    }
    function showStep(focus=true){
      clearError();
      const panels=[...form.querySelectorAll('[data-intake-step]')];
      panels.forEach((panel,index)=>{panel.hidden=index!==step;});
      root.querySelectorAll('.intake-steps li').forEach((item,index)=>{
        if(index===step)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
      });
      back.hidden=step===0;next.hidden=step===3;download.hidden=step!==3;
      next.textContent=step===2?'Review draft':'Next';
      status.textContent='Step '+(step+1)+' of 4 · '+['Location','Lecture details','Topic outline','Review your draft'][step]+(recovered?' · Draft recovered':'');
      if(step===3)preview();
      if(focus){
        const target=panels[step].querySelector('input,select,textarea')||panels[step].querySelector('legend');
        target.tabIndex=target.matches('legend')?-1:target.tabIndex;target.focus();
      }
    }
    async function loadMetadata(){
      if(loading)return;
      loading=true;next.disabled=true;clearError();field('Retry').hidden=true;
      try{
        registry=globalThis.MEQCourseRegistry;
        if(!registry)throw new Error('Registry unavailable');
        // Catalog metadata checks every ID without loading the clinical payloads.
        entries=globalThis.MEQLectureLoader?(await globalThis.MEQLectureLoader.loadCatalog()).lectures:lectures;
        if(!started){
          options(course,registry.courses);
          course.value=registry.activeCourse||registry.courses[0].id;
          refreshSubjects();
          const current=document.getElementById('subjectSelector')?.value;
          if([...subject.options].some(item=>item.value===current)){subject.value=current;refreshScope();}
          started=true;
          restoreDraft();
        }
        ready=true;next.disabled=false;showStep(false);
      }catch(cause){
        ready=false;status.textContent='Library metadata is unavailable. Reconnect and retry before preparing a draft.';
        field('Retry').hidden=false;
      }finally{loading=false;}
    }
    function route(){
      const active=location.hash.split('?')[0]==='#/manage';root.hidden=!active;
      const skip=document.querySelector('.skip-link');
      if(skip){skip.href=active?'#libraryManagerTitle':'#mainContent';skip.textContent=active?'Skip to library manager':'Skip to study content';}
      if(active&&!started)loadMetadata();
    }
    document.querySelector('.skip-link')?.addEventListener('click',event=>{
      if(root.hidden)return;
      event.preventDefault();
      const heading=document.getElementById('libraryManagerTitle');
      heading.focus();heading.scrollIntoView({block:'start'});
    });
    document.getElementById('manageLibraryLink')?.addEventListener('click',()=>{
      const toggle=document.getElementById('pwaToolsToggle');
      if(toggle?.getAttribute('aria-expanded')==='true')toggle.click();
    });
    form.addEventListener('submit',event=>{
      event.preventDefault();clearError();if(!ready||step===3)return;
      if([validateLocation,validateLecture,validateTopics][step]()){step++;saveDraft();showStep();}
    });
    back.addEventListener('click',()=>{if(step>0){step--;saveDraft();showStep();}});
    form.addEventListener('input',saveDraft);
    form.addEventListener('change',saveDraft);
    course.addEventListener('change',()=>{clearError();refreshSubjects();saveDraft();});
    subject.addEventListener('change',()=>{clearError();refreshScope();saveDraft();});
    title.addEventListener('input',suggestIdentity);
    field('Retry').addEventListener('click',loadMetadata);
    download.addEventListener('click',()=>{
      clearError();
      for(const [index,validate] of [validateLocation,validateLecture,validateTopics].entries()){
        if(!validate()){const message=error.textContent;step=index;showStep();invalid(null,message);return;}
      }
      const url=URL.createObjectURL(new Blob([JSON.stringify(intake(),null,2)+'\n'],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download=id.value+'.intake.json';
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      status.textContent='Intake file prepared for download. It still needs original-source content and review.';
    });
    document.addEventListener('meq:course-changed',()=>{if(started)refreshChapter();});
    window.addEventListener('hashchange',route);route();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
