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
    const pdfPicker=field('Pdf'),importFile=field('ImportFile');
    let registry,entries=[],step=0,started=false,ready=false,loading=false,suggestedId='',recovered=false;
    const draftKey='medicalLibraryIntakeDraftV1';
    const draftFields=[course,subject,chapter,title,source,id,order,topics];
    let structureInitialized=false;
    function initializeStructureDraft(){
      if(structureInitialized)return;
      const form=document.getElementById('structureDraftForm');
      if(!form)return;
      structureInitialized=true;
      const kind=document.getElementById('structureKind');
      const material=document.getElementById('structureCourse');
      const materialLabel=document.getElementById('structureCourseLabel');
      const specialty=document.getElementById('structureSubject');
      const firstName=document.getElementById('structureFirstName');
      const firstId=document.getElementById('structureFirstId');
      const firstNameLabel=document.getElementById('structureFirstNameLabel');
      const firstIdLabel=document.getElementById('structureFirstIdLabel');
      const specialtyLabel=document.getElementById('structureSubjectLabel');
      const name=document.getElementById('structureName');
      const itemId=document.getElementById('structureId');
      const message=document.getElementById('structureError');
      let suggested='',suggestedFirst='';
      const norm=value=>value.trim().replace(/\s+/g,' ').toLowerCase();
      const optionsFor=(element,items)=>{
        element.replaceChildren(...items.map(item=>new Option(item.label,item.id)));
      };
      function refreshSpecialties(){
        const pack=registry.packs.get(material.value);
        optionsFor(specialty,pack?.subjects||[]);
      }
      function updateKind(){
        const materialMode=kind.value==='material';
        materialLabel.hidden=materialMode;
        specialtyLabel.hidden=kind.value!=='chapter';
        firstNameLabel.hidden=!materialMode;
        firstIdLabel.hidden=!materialMode;
        message.hidden=true;
        refreshSpecialties();
      }
      function suggestId(){
        const slug=name.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
        if(!itemId.value||itemId.value===suggested)itemId.value=slug;
        suggested=slug;
      }
      function suggestFirstId(){
        const slug=firstName.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
        if(!firstId.value||firstId.value===suggestedFirst)firstId.value=slug;
        suggestedFirst=slug;
      }
      function invalid(control,reason){
        message.hidden=false;
        message.textContent=reason;
        control?.focus();
      }
      optionsFor(material,registry.courses);
      material.value=registry.activeCourse||registry.courses[0]?.id||'';
      kind.addEventListener('change',updateKind);
      material.addEventListener('change',refreshSpecialties);
      name.addEventListener('input',suggestId);
      firstName.addEventListener('input',suggestFirstId);
      for(const field of [kind,material,specialty,name,itemId,firstName,firstId]){
        field.addEventListener('input',()=>{message.hidden=true;});
      }
      updateKind();
      form.addEventListener('submit',event=>{
        event.preventDefault();
        message.hidden=true;
        const materialMode=kind.value==='material';
        const pack=registry.packs.get(material.value);
        if(!materialMode&&!pack)return invalid(material,'Choose a registered material.');
        const selected=pack?.subjects.find(item=>item.id===specialty.value);
        if(kind.value==='chapter'&&!selected)
          return invalid(specialty,'Choose an existing specialty.');
        const title=name.value.trim().replace(/\s+/g,' ');
        if(!title||title.length>160)
          return invalid(name,'Enter a name of at most 160 characters.');
        if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(itemId.value)||itemId.value.length>120)
          return invalid(itemId,'Use a valid stable ID with lowercase English letters, numbers and single hyphens.');
        const items=materialMode?registry.courses:
          kind.value==='chapter'?(selected.chapters||[]):pack.subjects;
        if(items.some(item=>item.id===itemId.value||norm(item.label)===norm(title)))
          return invalid(itemId,'A Chapter or specialty with this ID or name already exists.');
        const data={format:'medical-library-structure-intake',version:1,status:'needs-review',
          kind:kind.value};
        if(!materialMode)data.course=material.value;
        if(kind.value==='chapter')data.subject=specialty.value;
        data.item={id:itemId.value,label:title};
        if(materialMode){
          const initial=firstName.value.trim().replace(/\s+/g,' ');
          if(!initial||initial.length>160)
            return invalid(firstName,'Enter a first specialty name of at most 160 characters.');
          if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(firstId.value)||firstId.value.length>120)
            return invalid(firstId,'Enter a valid stable first specialty ID.');
          data.firstSubject={id:firstId.value,label:initial};
        }
        const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));
        const link=document.createElement('a');
        link.href=url;link.download=(materialMode?'new-material':material.value)+'-'+itemId.value+'.structure.json';
        document.body.append(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
      });
    }

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
        initializeStructureDraft();
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
    // Local source selection is intentionally filename-only. Never read or
    // upload PDF bytes, and never claim a lecture is ready for study.
    pdfPicker.addEventListener('change',()=>{
      const file=pdfPicker.files?.[0];
      if(!file)return;
      if(file.name.length>180||!/^([^/\\\x00-\x1f\x7f]+)\.pdf$/i.test(file.name)){
        invalid(pdfPicker,'Choose an original PDF filename without folders or control characters.');
        return;
      }
      clearError();
      source.value=file.name;
      if(!title.value.trim()){
        title.value=file.name.replace(/\.pdf$/i,'').trim();
        suggestIdentity();
      }
      saveDraft();
    });

    // Re-import only the metadata-only schema emitted by this wizard. Existing
    // clinical payloads and grade stores are never in the accepted format.
    function validateImportedIntake(data){
      const top=['format','lecture','status','version'];
      if(!data||typeof data!=='object'||Array.isArray(data)||
         Object.keys(data).sort().join(',')!==top.sort().join(',')||
         data.format!=='medical-library-intake'||data.version!==1||
         data.status!=='needs-source-review')
        throw new Error('unsupported metadata-only format');
      const item=data.lecture;
      const expected=['course','subject','title','id','order','source','topics'];
      if(!item||typeof item!=='object'||Array.isArray(item)||
         expected.some(k=>!(k in item))||
         Object.keys(item).some(k=>!expected.includes(k)&&k!=='chapterId'))
        throw new Error('unsupported or medical-content fields');
      if(!registry?.packs.has(item.course))throw new Error('material is not registered');
      const pack=registry.packs.get(item.course);
      const chosen=pack.subjects.find(s=>s.id===item.subject);
      if(!chosen)throw new Error('specialty does not belong to this material');
      if(item.chapterId!==undefined&&
         (typeof item.chapterId!=='string'||!(chosen.chapters||[])
           .some(chapter=>chapter.id===item.chapterId)))
        throw new Error('chapter is not registered in this specialty');
      if(typeof item.title!=='string'||!item.title.trim()||item.title.length>200||
         entries.some(e=>e.courseId===item.course&&e.subjectKey===item.subject&&
           normalize(e.title)===normalize(item.title)))
        throw new Error('missing or duplicate lecture title');
      if(typeof item.id!=='string'||item.id.length>200||
         !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)||
         entries.some(e=>e.id===item.id))
        throw new Error('invalid or published lecture ID');
      if(!Number.isSafeInteger(item.order)||item.order<1||item.order>99999||
         entries.some(e=>e.courseId===item.course&&e.subjectKey===item.subject&&
           Number(e.order)===item.order))
        throw new Error('invalid or occupied lecture order');
      if(typeof item.source!=='string'||item.source.length>180||
         !/^[^/\\\x00-\x1f\x7f]+\.pdf$/i.test(item.source))
        throw new Error('invalid PDF filename');
      if(!Array.isArray(item.topics)||item.topics.length<1||item.topics.length>60)
        throw new Error('missing or excessive topic headings');
      const normalized=new Set();
      item.topics.forEach((topic,index)=>{
        if(!topic||typeof topic!=='object'||Array.isArray(topic)||
           Object.keys(topic).sort().join(',')!=='id,label'||
           topic.id!=='topic-'+(index+1)||
           typeof topic.label!=='string'||!topic.label.trim()||topic.label.length>160||
           normalized.has(normalize(topic.label)))
          throw new Error('invalid or duplicate topic headings');
        normalized.add(normalize(topic.label));
      });
      return item;
    }
    importFile.addEventListener('change',async()=>{
      const file=importFile.files?.[0];
      if(!file)return;
      try{
        if(!ready)throw new Error('library metadata is still loading');
        if(file.size>128*1024||!file.name.toLowerCase().endsWith('.json'))
          throw new Error('select a metadata JSON file under 128 KB');
        const item=validateImportedIntake(JSON.parse(await file.text()));
        clearError();
        course.value=item.course;refreshSubjects();
        subject.value=item.subject;refreshScope();
        if(item.chapterId)chapter.value=item.chapterId;
        title.value=item.title;source.value=item.source;id.value=item.id;
        order.value=String(item.order);
        topics.value=item.topics.map(topic=>topic.label).join('\n');
        suggestedId=item.id;step=3;recovered=true;
        saveDraft();showStep(false);
      }catch(cause){
        invalid(null,'Invalid intake file: '+String(cause.message||cause));
      }finally{importFile.value='';}
    });

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
