(() => {
  const embedded = /*__COURSE_CONFIG__*/ null;
  if (!embedded || !embedded.catalog || !embedded.packs) {
    console.error('Course pack configuration is unavailable.');
    return;
  }

  const catalog = embedded.catalog;
  const packById = new Map(Object.entries(embedded.packs));
  const orderedCourses = [...catalog.courses]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const subjectOwners = new Map();

  for (const course of orderedCourses) {
    const pack = packById.get(course.id);
    if (!pack) continue;
    for (const subject of pack.subjects) {
      const owners = subjectOwners.get(subject.id) || [];
      owners.push(pack);
      subjectOwners.set(subject.id, owners);
    }
  }

  const panel = document.querySelector('.hero-panel');
  const subjectSelector = document.getElementById('subjectSelector');
  const subjectLabel = panel?.querySelector('label[for="subjectSelector"]');
  const subjectHint = panel?.querySelector('.subject-hint');
  const courseLabel = document.createElement('label');
  const courseSelector = document.createElement('select');
  const courseHint = document.createElement('span');

  courseLabel.className = 'hero-panel-label course-panel-label';
  courseLabel.htmlFor = 'courseSelector';
  courseLabel.textContent = 'Medical course';
  courseSelector.id = 'courseSelector';
  courseSelector.className = 'subject-select course-select';
  courseSelector.setAttribute('aria-label', 'Medical course');
  courseSelector.innerHTML = orderedCourses
    .map(course => `<option value="${course.id}">${course.label}</option>`)
    .join('');
  courseHint.className = 'subject-hint course-hint';
  courseHint.textContent = 'Choose the course first, then the specialty and lecture.';

  if (panel && subjectLabel) {
    panel.insertBefore(courseLabel, subjectLabel);
    panel.insertBefore(courseSelector, subjectLabel);
    panel.insertBefore(courseHint, subjectLabel);
    subjectLabel.textContent = 'Subject / specialty';
  }
  if (subjectHint) subjectHint.textContent = 'Choose a specialty to display its lectures and study content.';

  let activeCourse = '';

  const packForCourse = courseId => packById.get(courseId) || null;
  const packHasSubject = (pack, subjectKey) =>
    Boolean(pack?.subjects?.some(subject => subject.id === subjectKey));
  const packForSubject = (subjectKey, courseId = activeCourse) => {
    const scopedPack = packForCourse(courseId);
    if (scopedPack && packHasSubject(scopedPack, subjectKey)) return scopedPack;
    const owners = subjectOwners.get(subjectKey) || [];
    return owners.length === 1 ? owners[0] : null;
  };
  const catalogForSubject = (subjectKey, courseId = activeCourse) =>
    packForSubject(subjectKey, courseId)?.lectureCatalogUrl || null;
  const subjectScope = (subjectKey, courseId = activeCourse) => {
    const pack = packForSubject(subjectKey, courseId);
    return pack ? `${pack.id}/${subjectKey}` : null;
  };
  const allSubjectScopes = () => orderedCourses.flatMap(course =>
    (packForCourse(course.id)?.subjects || []).map(subject => ({
      courseId: course.id,
      subjectKey: subject.id,
      scopeId: `${course.id}/${subject.id}`
    }))
  );
  const allSubjectKeys = () => [...new Set(allSubjectScopes().map(scope => scope.subjectKey))];

  const courseLibrary = document.getElementById('courseLibraryDisclosure');
  const courseLibraryGrid = document.getElementById('courseLibraryGrid');
  const courseLibraryCount = document.getElementById('courseLibraryCount');

  document.getElementById('emptyBrowseCoursesBtn')?.addEventListener('click', () => {
    if (!courseLibrary) return;
    courseLibrary.open = true;
    const summary = courseLibrary.querySelector('summary');
    summary?.focus();
    summary?.scrollIntoView({block: 'center', behavior: 'auto'});
  });

  // Course cards use the existing registry; they never fetch full lecture payloads.
  const renderCourseLibrary = () => {
    if (!courseLibraryGrid) return;
    if (courseLibraryCount) {
      courseLibraryCount.textContent = `${orderedCourses.length} course${orderedCourses.length === 1 ? '' : 's'}`;
    }
    const cards = orderedCourses.map((course, index) => {
      const pack = packForCourse(course.id);
      const active = course.id === activeCourse;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `course-library-card${active ? ' is-active' : ''}`;
      card.dataset.courseId = course.id;
      card.setAttribute('aria-pressed', String(active));

      const number = document.createElement('span');
      number.className = 'course-library-index';
      number.textContent = `COURSE ${String(index + 1).padStart(2, '0')}`;

      const title = document.createElement('strong');
      title.className = 'course-library-title';
      title.textContent = course.label;

      const description = document.createElement('span');
      description.className = 'course-library-description';
      description.textContent = pack?.description || 'Browse subjects and lectures in this medical course.';

      const footer = document.createElement('span');
      footer.className = 'course-library-card-footer';
      const count = document.createElement('span');
      const specialtyCount = pack?.subjects?.length || 0;
      count.textContent = `${specialtyCount} specialt${specialtyCount === 1 ? 'y' : 'ies'}`;
      const availability = document.createElement('span');
      availability.className = pack?.lectureCatalogUrl
        ? 'course-library-availability is-published'
        : 'course-library-availability';
      availability.textContent = pack?.lectureCatalogUrl
        ? 'Study content available'
        : 'Ready for future lectures';
      footer.append(count, availability);

      const action = document.createElement('span');
      action.className = 'course-library-action';
      action.textContent = active ? 'Current course' : 'Open course →';

      card.append(number, title, description, footer, action);
      card.addEventListener('click', () => {
        activateCourse(course.id, {preserveSubject: true});
        if (courseLibrary) courseLibrary.open = false;
        courseSelector?.focus();
      });
      return card;
    });
    courseLibraryGrid.replaceChildren(...cards);
  };

  const refreshCourseView = () => {
    activeSubtopic = 'all';
    populateSubjectSelector();
    subjectSelector.value = activeSubject;
    populateLectureFilter();
    updateTopicOptions();
    render();
    validateBank();
    setSidebarState();
    renderCourseLibrary();
  };

  const activateCourse = (courseId, options = {}) => {
    const pack = packForCourse(courseId) || packForCourse(catalog.defaultCourse) || packForCourse(orderedCourses[0]?.id);
    if (!pack) return;

    activeCourse = pack.id;
    courseSelector.value = pack.id;
    subjects.splice(0, subjects.length, ...pack.subjects.map(subject => ({...subject})));

    const preserveSubject = options.preserveSubject !== false;
    const remembered = storage.get(`medicalBankSubjectV4:${pack.id}`);
    const candidate = preserveSubject && subjects.some(subject => subject.id === activeSubject)
      ? activeSubject
      : subjects.some(subject => subject.id === remembered)
        ? remembered
        : subjects.some(subject => subject.id === pack.defaultSubject)
          ? pack.defaultSubject
          : subjects[0]?.id || '';

    activeSubject = candidate;
    storage.set('medicalBankCourseV1', pack.id);
    if (activeSubject) {
      storage.set('medicalBankSubjectV4', activeSubject);
      storage.set(`medicalBankSubjectV4:${pack.id}`, activeSubject);
    }

    refreshCourseView();
    document.dispatchEvent(new CustomEvent('meq:course-changed', {
      detail: {courseId: pack.id, subjectKey: activeSubject}
    }));

    if (globalThis.MEQLectureLoader && activeSubject) {
      globalThis.MEQLectureLoader.loadSubject(activeSubject).catch(() => {});
    }
  };

  courseSelector.addEventListener('change', () => {
    activateCourse(courseSelector.value, {preserveSubject: false});
  });

  subjectSelector?.addEventListener('change', () => {
    if (activeCourse && subjectSelector.value) {
      storage.set(`medicalBankSubjectV4:${activeCourse}`, subjectSelector.value);
    }
  });

  const storedCourse = storage.get('medicalBankCourseV1');
  const inferredCourse = packForSubject(activeSubject, storedCourse)?.id;
  const initialCourse = packForCourse(storedCourse)?.id || inferredCourse || catalog.defaultCourse || orderedCourses[0]?.id;

  globalThis.MEQCourseRegistry = Object.freeze({
    catalog,
    courses: orderedCourses,
    packs: packById,
    activateCourse,
    catalogForSubject,
    courseForSubject: (subjectKey, courseId = activeCourse) =>
      packForSubject(subjectKey, courseId)?.id || null,
    subjectScope,
    lectureScope: (lectureId, subjectKey, courseId = activeCourse) => {
      const scope = subjectScope(subjectKey, courseId);
      return scope ? `${scope}/${lectureId}` : null;
    },
    itemScope: (lectureId, subjectKey, type, itemId, courseId = activeCourse) => {
      const lecture = subjectScope(subjectKey, courseId);
      return lecture ? `${lecture}/${lectureId}/${type}/${itemId}` : null;
    },
    allSubjectScopes,
    allSubjectKeys,
    get activeCourse() { return activeCourse; }
  });

  const footer = document.querySelector('.footer');
  if (footer) footer.textContent = 'Medical course → specialty → lecture → subtopic • Independent content packs • Saved progress';

  // The review hub works from already-saved progress keys; no lecture payloads
  // are fetched just to display the queue. It is entirely optional to open.
  const reviewPanel=document.getElementById('myReviewDisclosure');
  const reviewCount=document.getElementById('myReviewCount');
  const reviewStatus=document.getElementById('myReviewStatus');
  const reviewList=document.getElementById('myReviewList');
  let reviewRenderToken=0;

  const savedReviewRecords=()=>{
    const unique=new Map();
    Object.entries(state).forEach(([statusKey,level])=>{
      if(level!=='weak'&&level!=='review')return;
      const item=progressKeyParts(statusKey);
      if(!item.lectureId||!item.itemId||!['case','core','image','extra'].includes(item.type))return;
      const identity=[item.lectureId,item.type,item.itemId].join('::');
      if(!unique.has(identity)||item.version===2)unique.set(identity,{...item,level});
    });
    return [...unique.values()];
  };

  const updateSavedReviewCount=()=>{
    if(!reviewCount)return;
    const count=savedReviewRecords().length;
    reviewCount.textContent=count===0?'Nothing to revisit':count+' to revisit';
  };

  const openSavedReview=async (lecture,level,button)=>{
    if(!reviewStatus)return;
    const loader=globalThis.MEQLectureLoader;
    if(!loader){reviewStatus.textContent='Study content is still loading. Try again shortly.';return}
    button.disabled=true;
    reviewStatus.textContent='Opening '+lecture.title+'…';
    try{
      if(activeCourse!==lecture.courseId)activateCourse(lecture.courseId,{preserveSubject:false});
      if(activeSubject!==lecture.subjectKey){
        activeSubject=lecture.subjectKey;
        subjectSelector.value=activeSubject;
        storage.set('medicalBankSubjectV4',activeSubject);
        storage.set('medicalBankSubjectV4:'+lecture.courseId,activeSubject);
      }
      activeSubtopic='all';
      await loader.loadSubject(lecture.subjectKey,lecture.courseId);
      await loader.loadLecture(lecture.id,{refresh:false,busy:false});
      const search=document.getElementById('search');
      const type=document.getElementById('typeFilter');
      const priority=document.getElementById('priorityFilter');
      const topic=document.getElementById('topicFilter');
      if(search)search.value='';
      if(type)type.value='all';
      if(priority)priority.value='all';
      if(topic)topic.value='all';
      selectLecture(lecture.id,false);
      const reviewFilter=document.getElementById('reviewFilter');
      if(reviewFilter){
        reviewFilter.value=level;
        reviewFilter.dispatchEvent(new Event('change',{bubbles:true}));
      }else applyFilters();
      const matching=[...document.querySelectorAll('#mainContent .study-item:not(.hidden)')]
        .find(item=>item.querySelector('.status[data-status="'+level+'"].active'));
      if(!matching)throw new Error('No saved '+level+' items are visible in this lecture.');
      reviewPanel.open=false;
      matching.setAttribute('tabindex','-1');
      requestAnimationFrame(()=>{
        if(!matching.isConnected)return;
        matching.focus({preventScroll:true});
        matching.scrollIntoView({behavior:'auto',block:'start'});
      });
    }catch(error){
      reviewStatus.textContent='Could not open this review group. '+String(error.message||error);
    }finally{
      if(button.isConnected)button.disabled=false;
    }
  };

  const renderSavedReview=async()=>{
    if(!reviewPanel?.open||!reviewStatus||!reviewList)return;
    const token=++reviewRenderToken;
    reviewStatus.textContent='Preparing saved review…';
    reviewList.replaceChildren();
    const loader=globalThis.MEQLectureLoader;
    if(!loader){
      reviewStatus.textContent='Lectures are still loading. Close and reopen My Review.';
      return
    }
    const checks=await Promise.allSettled(
      allSubjectScopes().map(scope=>loader.loadSubjectMetadata(scope.subjectKey,scope.courseId))
    );
    if(!reviewPanel.open||token!==reviewRenderToken)return;
    const records=savedReviewRecords();
    const groups=new Map();
    for(const record of records){
      const lecture=lectures.find(item=>item.id===record.lectureId);
      if(!lecture)continue;
      if(record.version===2&&(
        record.courseId!==lecture.courseId||record.subjectKey!==lecture.subjectKey
      ))continue;
      if(!groups.has(lecture.id)){
        groups.set(lecture.id,{lecture,weak:0,review:0});
      }
      groups.get(lecture.id)[record.level]++;
    }
    const sorted=[...groups.values()].sort((a,b)=>
      b.weak-a.weak||b.review-a.review||
      a.lecture.title.localeCompare(b.lecture.title)
    );
    for(const group of sorted){
      const lecture=group.lecture;
      const course=packForCourse(lecture.courseId);
      const specialty=course?.subjects?.find(item=>item.id===lecture.subjectKey);
      const card=document.createElement('article');card.className='my-review-card';
      const description=document.createElement('div');description.className='my-review-card-copy';
      const label=document.createElement('small');
      label.textContent=(course?.label||lecture.courseId)+' / '+(specialty?.label||lecture.subject);
      const title=document.createElement('h3');title.textContent=lecture.title;
      description.append(label,title);
      const actions=document.createElement('div');actions.className='my-review-card-actions';
      for(const level of ['weak','review']){
        if(!group[level])continue;
        const button=document.createElement('button');
        button.type='button';button.className='my-review-open';
        button.textContent=(level==='weak'?'Weak':'Review')+' ('+group[level]+')';
        button.setAttribute('aria-label','Open '+group[level]+' '+level+' questions in '+lecture.title);
        button.addEventListener('click',()=>openSavedReview(lecture,level,button));
        actions.append(button);
      }
      card.append(description,actions);
      reviewList.append(card);
    }
    const total=sorted.reduce((sum,item)=>sum+item.weak+item.review,0);
    if(total){
      reviewStatus.textContent=total+' saved questions to revisit across '+sorted.length+
        (sorted.length===1?' lecture.':' lectures.');
    }else{
      reviewStatus.textContent=records.length
        ?'No matching published lectures found for the saved ratings.'
        :'No questions are marked Weak or Review yet. Mark a question and it will appear here.';
    }
    if(checks.some(check=>check.status==='rejected')){
      reviewStatus.textContent+=' Some course catalogs could not be loaded; reopen to retry.';
    }
  };

  reviewPanel?.addEventListener('toggle',()=>{
    if(reviewPanel.open)void renderSavedReview();
    else reviewRenderToken++;
  });
  document.addEventListener('meq:progress-ready',()=>{
    updateSavedReviewCount();
    if(reviewPanel?.open)void renderSavedReview();
  });
  document.addEventListener('click',event=>{
    if(!(event.target instanceof Element)||!event.target.closest('.status'))return;
    queueMicrotask(()=>{
      updateSavedReviewCount();
      if(reviewPanel?.open)void renderSavedReview();
    });
  });
  updateSavedReviewCount();

  activateCourse(initialCourse, {preserveSubject: true});
})();
