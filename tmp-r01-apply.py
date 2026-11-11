from pathlib import Path

def replace(path, old, new, count=1):
    p=Path(path);s=p.read_text()
    if s.count(old)!=count:raise RuntimeError('Unexpected source in '+path+': '+old[:80])
    p.write_text(s.replace(old,new))

p=Path('src/app.js');s=p.read_text()
a=s.index('/* V6 UX-01');b=s.index('/* V6 UX-03',a)
s=s[:a]+s[b:];p.write_text(s)
replace('src/app.js',"      history.replaceState(history.state,'',location.pathname+location.search+path+'?'+params.toString());\n    }\n  };\n  modes.forEach(mode=>{", "      history.replaceState(history.state,'',location.pathname+location.search+path+'?'+params.toString());\n    }\n    document.dispatchEvent(new CustomEvent('meq:reader-mode-changed',{detail:{lectureId:lecture.id,tab:selected.key}}));\n  };\n  modes.forEach(mode=>{")
replace('src/index.html','<body>','<body data-workspace="library">')
replace('src/index.html','    <a href="#/home" data-workspace-link="home">Home</a>\n','')
replace('src/index.html','<p id="workspaceRouteStatus" class="sr-only" role="status" aria-live="polite"></p>', '<p id="workspaceRouteStatus" class="sr-only" role="status" aria-live="polite"></p>\n<p id="workspaceNavigationNotice" class="workspace-navigation-notice" role="status" hidden></p>')
p=Path('src/app.css');p.write_text(p.read_text()+'\n/* Navigation recovery is visible, source-neutral and outside the study text. */\n.workspace-navigation-notice{margin:12px 0;padding:12px 16px;border:1px solid var(--v6-border);border-radius:8px;color:var(--v6-ink);background:var(--v6-surface);line-height:1.5}\n.workspace-navigation-notice[hidden]{display:none}\n')
replace('build.sh','  src/app.js\n','  src/app.js\n  src/study-context.js\n')
replace('build.sh','  src/app.js \\\n','  src/app.js \\\n  src/study-context.js \\\n')
replace('build.sh','node --check src/app.js','node --check src/study-context.js\nnode --check src/app.js')
replace('tools/build_app.py',"    authoring_js = (ROOT / 'src' / 'library-authoring.js').read_text(encoding='utf-8')", "    authoring_js = (ROOT / 'src' / 'library-authoring.js').read_text(encoding='utf-8')\n    context_js = (ROOT / 'src' / 'study-context.js').read_text(encoding='utf-8')")
replace('tools/build_app.py',"    extension_scripts = (", "    extension_scripts = (\n        ('study-context-extension', './study-context.js', context_js),")
for path in ['version.json','service-worker.js','src/pwa-client.js']:
    replace(path,'2026.11.10.1','2026.11.11.1')
replace('version.json','2026-11-10T15:00:00.000Z','2026-11-11T12:00:00.000Z')
replace('service-worker.js',"  './app.js',", "  './app.js',\n  './study-context.js',")
p=Path('src/lecture-loader.js');s=p.read_text()
s=s.replace("  const activeCourseId = () => globalThis.MEQCourseRegistry?.activeCourse || '';", "  const activeCourseId = () => globalThis.MEQCourseRegistry?.activeCourse || '';\n  const isActiveScope = (subjectKey,courseId) => subjectKey === activeSubject && (!courseId || courseId === activeCourseId());")
s=s.replace('entry.subjectKey === activeSubject &&','isActiveScope(entry.subjectKey, entry.courseId) &&')
s=s.replace('options.refresh !== false && lecture.subjectKey === activeSubject','options.refresh !== false && isActiveScope(lecture.subjectKey, lecture.courseId)')
s=s.replace('affectsActiveView && entry.subjectKey === activeSubject','affectsActiveView && isActiveScope(entry.subjectKey, entry.courseId)')
s=s.replace("    const affectsActiveView = subjectKey === activeSubject && (!courseId || courseId === activeCourseId());", "    const affectsActiveView = isActiveScope(subjectKey,courseId);")
s=s.replace('if (subjectKey === activeSubject) refreshApplication();','if (isActiveScope(subjectKey,courseId)) refreshApplication();')
s=s.replace("      let selected = lectureFilter?.value || '';", "      const intent = globalThis.MEQStudyContext?.get();\n      if (intent?.view === 'library' && isActiveScope(subjectKey,courseId)) return {loaded: [], failed: []};\n      let selected = intent?.view === 'lecture' && intent.courseId === courseId && intent.subjectId === subjectKey\n        ? intent.lectureId : lectureFilter?.value || '';")
s=s.replace('lectureFilter && subjectKey === activeSubject','lectureFilter && isActiveScope(subjectKey,courseId)')
s=s.replace('affectsActiveView && subjectKey === activeSubject','affectsActiveView && isActiveScope(subjectKey,courseId)')
p.write_text(s)
# Existing tests for legacy controls retain assertions; new tests cover actual root.
legacy=['accessibility','ui-v4-reader','app','revision-engine','exam-mode','psychiatry-navigation','mobile-filters','ui-v4-progress-scope','my-review','ui-v5-design','ui-v4-overview-first','webkit-smoke','course-packs','layout','ui-v4-mobile-density','hardening','dermatology-lecture','ui-v4-lecture-discovery','ui-v4-desktop-filters','workspace-visual-evidence','backup-preview','print','performance','learning-analytics','lecture-workspace-navigation','library-mcq-discovery','study-guide']
for name in legacy:
 p=Path('tests/'+name+'.spec.js');s=p.read_text()
 s=s.replace("page.goto('/',", "page.goto('/#legacy',").replace("page.goto('/')", "page.goto('/#legacy')")
 s=s.replace('page.goto(offlineFile,',"page.goto(offlineFile+'#legacy',")
 if name=='my-review':s=s.replace("page.goto('/offline/Medical_MEQ_Review_Bank_Offline.html',","page.goto('/offline/Medical_MEQ_Review_Bank_Offline.html#legacy',")
 p.write_text('// Retained legacy controls; the real default entry is covered in study-context.spec.js.\n'+s)
p=Path('tests/my-medical-library.spec.js');s=p.read_text();first,rest=s.split("test('Browse my library",1)
first=first.replace("await expect(page.getByRole('heading', {name: 'Your medical study library'})).toBeVisible();", "await expect(page.locator('body')).toHaveAttribute('data-workspace','library');\n  await expect(page.locator('.lecture-overview-panel')).toBeVisible();")
rest=rest.replace("page.goto('/',","page.goto('/#legacy',")
p.write_text(first+"// Legacy disclosure/filters below remain available during staged migration.\ntest('Browse my library"+rest)
p=Path('tests/v6-library-authoring.spec.js');s=p.read_text().replace(r'toHaveURL(/#\/manage$/)',r'toHaveURL(/#\/manage(?:\?|$)/)');p.write_text(s)
p=Path('tests/v6-workspace.spec.js');s=p.read_text();start=s.index("test('home and library");end=s.index("\ntest('selecting a lecture",start)
s=s[:start]+"""test('home links alias Library and browser navigation stays keyboard accessible', async ({page}) => {
  await page.goto('/#/home', {waitUntil:'domcontentloaded'});
  const nav=page.getByRole('navigation',{name:'Primary workspace'});
  await expect(nav.getByRole('link',{name:'Home',exact:true})).toHaveCount(0);
  await expect(nav.getByRole('link',{name:'Library',exact:true})).toHaveAttribute('aria-current','page');
  await expect(page.locator('body')).toHaveAttribute('data-workspace','library');
  await expect(page.locator('.hero')).toBeHidden();
  await expect(page.locator('#courseLibraryDisclosure')).toBeHidden();
  await expect(page.locator('#mainLayout')).toBeVisible();
  await expect(page.locator('.toolbar')).toBeHidden();
  await expect(page.locator('#lectureFilter')).toHaveValue('all',{timeout:15000});
  await expect(page.locator('.lecture-overview-panel')).toBeVisible({timeout:15000});
  const exams=nav.getByRole('link',{name:'Exams',exact:true});
  await exams.focus();await exams.press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-workspace','exams');
  await page.goBack();
  await expect(page.locator('body')).toHaveAttribute('data-workspace','library');
  await page.goForward();
  await expect(page.locator('body')).toHaveAttribute('data-workspace','exams');
});
"""+s[end:]
s=s.replace('expect(await links.count()).toBe(5);','expect(await links.count()).toBe(4);')
s=s.replace('unknown workspace hashes fall back safely to home','unknown workspace hashes fall back safely to Library')
s=s.replace("toHaveAttribute('data-workspace','home');\n  await expect(page.locator('.hero')).toBeVisible();","toHaveAttribute('data-workspace','library');\n  await expect(page.locator('.hero')).toBeHidden();\n  await expect(page.locator('#workspaceNavigationNotice')).toBeVisible();")
s=s.replace('mobile home and exams do not inherit','mobile Library and exams do not inherit');p.write_text(s)
replace('playwright.webkit.config.js','webkit-smoke|v6-library-authoring','webkit-smoke|v6-library-authoring|study-context|study-preservation')
p=Path('tests/pwa-release-integrity.spec.js');s=p.read_text()
s=s.replace("await expect(page.getByRole('heading', {name:'Your medical study library'})).toBeVisible();","await expect(page.locator('.lecture-overview-panel')).toBeVisible();")
s=s.replace("await expect(page.getByRole('heading',{name:'Your medical study library'})).toBeVisible();","await expect(page.locator('.lecture-overview-panel')).toBeVisible();")
s=s.replace("document.querySelector('.course-library')", "document.querySelector('[aria-label=\"Primary workspace\"]')")
for name in ['reader-first responsive UI keeps the first lecture in reach across phone/tablet/desktop','320/390px course and specialty selectors show their full names and Clear all is reachable','tablet and desktop course/specialty names are never cropped by the native selectors']:
 start=s.index("test('"+name);end=s.find("\ntest(",start+5);end=len(s) if end<0 else end
 s=s[:start]+s[start:end].replace("page.goto('/',","page.goto('/#legacy',")+s[end:]
s=s.replace("await expect(page).toHaveURL('http://127.0.0.1:4173/');", "await expect(page).toHaveURL(/http:\\/\\/127\\.0\\.0\\.1:4173\\/#\\/library(?:\\?|$)/);\n  await expect(page.locator('.lecture-overview-panel')).toBeVisible();")
p.write_text(s)
p=Path('tests/study-context.spec.js');s=p.read_text()
if 'context follows the actual reader tab' not in s:
 s+='''
test('R01 context follows the actual reader tab, including a legacy lecture without Explanation',async({page})=>{
  await page.goto('/#/lecture/'+urology);
  await expect(page.getByRole('tab',{name:'Cases',exact:true})).toHaveAttribute('aria-selected','true');
  expect(await page.evaluate(()=>globalThis.MEQStudyContext.get().mode)).toBe('questions');
  await page.goto('/#/lecture/'+derm);
  await page.getByRole('tab',{name:'MCQ practice',exact:true}).click();
  await expect(page.getByRole('tab',{name:'MCQ practice',exact:true})).toHaveAttribute('aria-selected','true');
  expect(await page.evaluate(()=>globalThis.MEQStudyContext.get().mode)).toBe('questions');
  await page.getByRole('tab',{name:'Explanation',exact:true}).click();
  expect(await page.evaluate(()=>globalThis.MEQStudyContext.get().mode)).toBe('read');
});

test('R01 Library entry is metadata-first and does not fetch the whole clinical corpus',async({page})=>{
  const payloads=[];
  page.on('request',request=>{const path=new URL(request.url()).pathname;if(path.startsWith('/lectures/data/'))payloads.push(path);});
  await page.goto('/');
  await expect(page.locator('.lecture-overview-panel')).toBeVisible();
  expect(new Set(payloads).size).toBeLessThanOrEqual(1);
  await expect(page.locator('.lecture')).toHaveCount(0);
});
'''
p.write_text(s)
print('R00/R01 source integration prepared; browser CI still required.')
