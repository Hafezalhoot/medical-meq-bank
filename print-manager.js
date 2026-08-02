(() => {
  if (document.getElementById('printCenterModal')) return;

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const storageApi = {
    get(key) {
      try {
        if (typeof storage !== 'undefined' && storage?.get) return storage.get(key);
        return localStorage.getItem(key);
      } catch (error) { return null; }
    },
    set(key, value) {
      try {
        if (typeof storage !== 'undefined' && storage?.set) storage.set(key, value);
        else localStorage.setItem(key, value);
      } catch (error) { /* no-op */ }
    }
  };

  const pageCountValues = ['auto', '1', '2', '3', '4', '5', '6', '8', '10', '12'];
  const defaultSettings = {
    mode: 'study',
    answerPlacement: 'inline',
    spaceSize: 'standard',
    questionsPerPage: 'auto',
    includeArabic: true,
    includeStudentHeader: true
  };

  const loadSettings = () => {
    try {
      const parsed = JSON.parse(storageApi.get('medicalBankPrintSettingsV1') || '{}');
      return {...defaultSettings, ...(parsed && typeof parsed === 'object' ? parsed : {})};
    } catch (error) { return {...defaultSettings}; }
  };

  const saveSettings = settings => storageApi.set('medicalBankPrintSettingsV1', JSON.stringify(settings));

  const overlay = document.createElement('div');
  overlay.id = 'printCenterModal';
  overlay.className = 'print-center-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="print-center-dialog" role="dialog" aria-modal="true" aria-labelledby="printCenterTitle" aria-describedby="printCenterDescription">
      <header class="print-center-head">
        <div>
          <h2 id="printCenterTitle">Print & PDF Center</h2>
          <p id="printCenterDescription">Create a study copy, a handwritten worksheet, or a compact question sheet.</p>
        </div>
        <button class="print-center-close" id="printCenterClose" type="button" aria-label="Close print center">×</button>
      </header>
      <div class="print-center-body">
        <div class="print-center-summary">
          <div><strong id="printSelectionCount">0 printable items</strong><small>The active filters and review-status filter are respected.</small></div>
          <div class="print-filter-chips" id="printFilterChips"></div>
        </div>

        <fieldset class="print-section">
          <legend>1. Choose the print format</legend>
          <div class="print-mode-grid">
            <label class="print-mode-card">
              <input type="radio" name="printMode" value="study">
              <span class="print-mode-check" aria-hidden="true"></span>
              <span class="print-mode-icon" aria-hidden="true">📘</span>
              <span class="print-mode-title">Study copy</span>
              <span class="print-mode-copy">Questions with full model answers, marking schemes, exam traps, and memory triggers.</span>
            </label>
            <label class="print-mode-card">
              <input type="radio" name="printMode" value="worksheet">
              <span class="print-mode-check" aria-hidden="true"></span>
              <span class="print-mode-icon" aria-hidden="true">✍️</span>
              <span class="print-mode-title">Handwritten worksheet</span>
              <span class="print-mode-copy">Questions only, with lined answer space sized for handwriting.</span>
            </label>
            <label class="print-mode-card">
              <input type="radio" name="printMode" value="compact">
              <span class="print-mode-check" aria-hidden="true"></span>
              <span class="print-mode-icon" aria-hidden="true">📄</span>
              <span class="print-mode-title">Compact questions</span>
              <span class="print-mode-copy">Questions only, placed one after another with no answer space.</span>
            </label>
          </div>

          <div class="print-options" id="studyPrintOptions">
            <div class="print-field">
              <label for="printAnswerPlacement">Model-answer placement</label>
              <select id="printAnswerPlacement">
                <option value="inline">Below each item</option>
                <option value="end">Separate answer key at the end</option>
              </select>
            </div>
            <div class="print-field">
              <label>Best for</label>
              <div class="print-option-label">Revision, teacher copies, and saving a complete PDF.</div>
            </div>
          </div>

          <div class="print-options" id="worksheetPrintOptions" hidden>
            <div class="print-field">
              <label for="printSpaceSize">Writing-space size</label>
              <select id="printSpaceSize">
                <option value="compact">Compact</option>
                <option value="standard">Standard</option>
                <option value="generous">Generous</option>
              </select>
            </div>
            <div class="print-field">
              <label>Automatic sizing</label>
              <div class="print-option-label">Space is distributed by marks and the number of subquestions.</div>
            </div>
          </div>
        </fieldset>

        <fieldset class="print-section">
          <legend>2. Control questions per page</legend>
          <div class="print-pagination-card">
            <div class="print-field print-pagination-field">
              <label for="printQuestionsPerPage">Questions per page</label>
              <select id="printQuestionsPerPage">
                <option value="auto">Automatic — recommended</option>
                <option value="1">1 question per page</option>
                <option value="2">2 questions per page</option>
                <option value="3">3 questions per page</option>
                <option value="4">4 questions per page</option>
                <option value="5">5 questions per page</option>
                <option value="6">6 questions per page</option>
                <option value="8">8 questions per page</option>
                <option value="10">10 questions per page</option>
                <option value="12">12 questions per page</option>
              </select>
            </div>
            <div class="print-pagination-info">
              <div class="print-pagination-badge" id="printPaginationBadge">AUTO</div>
              <div>
                <strong id="printPaginationTitle">Smart automatic layout</strong>
                <p id="printPaginationHint">The browser balances question length, images, answers, and writing space to avoid awkward page breaks.</p>
              </div>
            </div>
          </div>
          <div class="print-pagination-note" id="printPaginationNote" hidden></div>
        </fieldset>

        <fieldset class="print-section">
          <legend>3. Page details</legend>
          <div class="print-checks">
            <label class="print-check">
              <input type="checkbox" id="printStudentHeader">
              <span>Student details header<small>Add blank Name, Date, and Score fields.</small></span>
            </label>
            <label class="print-check">
              <input type="checkbox" id="printArabicScenario">
              <span>Arabic scenario support<small>Include the Arabic scenario beneath MEQ cases.</small></span>
            </label>
          </div>
          <div class="print-large-warning" id="printLargeWarning">This is a large print job. Use the lecture, item-type, topic, priority, or review-status filters to create a shorter paper.</div>
        </fieldset>
      </div>
      <footer class="print-center-foot">
        <button class="btn btn-soft" id="printCenterCancel" type="button">Cancel</button>
        <button class="btn btn-primary" id="printCenterCreate" type="button">Print / Save PDF</button>
      </footer>
    </section>`;
  document.body.appendChild(overlay);

  const originalPrintButton = [...document.querySelectorAll('button')].find(button =>
    (button.getAttribute('onclick') || '').includes('window.print') || button.textContent.includes('Print / Save as PDF')
  );
  if (originalPrintButton) {
    originalPrintButton.removeAttribute('onclick');
    originalPrintButton.id = 'printCenterSidebarBtn';
    originalPrintButton.classList.add('print-center-launch');
    originalPrintButton.innerHTML = '<span class="print-icon" aria-hidden="true">🖨️</span><span>Print / Save PDF</span>';
  }

  const navControls = document.querySelector('.nav-controls');
  let quickPrintButton = null;
  if (navControls) {
    quickPrintButton = document.createElement('button');
    quickPrintButton.id = 'printCenterQuickBtn';
    quickPrintButton.type = 'button';
    quickPrintButton.className = 'nav-toggle print-center-launch';
    quickPrintButton.innerHTML = '<span class="print-icon" aria-hidden="true">🖨️</span><span>Print / PDF</span>';
    navControls.appendChild(quickPrintButton);
  }

  const $ = id => document.getElementById(id);
  const modalDialog = overlay.querySelector('.print-center-dialog');
  const modeInputs = [...overlay.querySelectorAll('input[name="printMode"]')];
  const createButton = $('printCenterCreate');
  let lastFocused = null;

  const getPrintableItems = () => [...document.querySelectorAll('.study-item')].filter(item =>
    !item.classList.contains('hidden') &&
    !item.closest('.lecture.hidden') &&
    !item.closest('.content-section.hidden')
  );

  const selectedText = id => {
    const element = document.getElementById(id);
    if (!element) return '';
    if (element.tagName === 'SELECT') return element.selectedOptions?.[0]?.textContent?.trim() || '';
    return element.textContent.trim();
  };

  const currentFilterLabels = () => {
    const labels = [];
    const subject = selectedText('subjectSelect');
    if (subject) labels.push(subject);
    ['lectureFilter', 'typeFilter', 'topicFilter', 'priorityFilter', 'reviewFilter'].forEach(id => {
      const element = document.getElementById(id);
      const text = selectedText(id);
      if (element && element.value !== 'all' && text) labels.push(text.replace(/\s*\(\d+\)\s*$/, ''));
    });
    return labels;
  };

  const getSettings = () => ({
    mode: modeInputs.find(input => input.checked)?.value || 'study',
    answerPlacement: $('printAnswerPlacement').value,
    spaceSize: $('printSpaceSize').value,
    questionsPerPage: pageCountValues.includes($('printQuestionsPerPage').value) ? $('printQuestionsPerPage').value : 'auto',
    includeArabic: $('printArabicScenario').checked,
    includeStudentHeader: $('printStudentHeader').checked
  });

  const applySettings = settings => {
    const mode = ['study', 'worksheet', 'compact'].includes(settings.mode) ? settings.mode : 'study';
    const input = modeInputs.find(item => item.value === mode);
    if (input) input.checked = true;
    $('printAnswerPlacement').value = ['inline', 'end'].includes(settings.answerPlacement) ? settings.answerPlacement : 'inline';
    $('printSpaceSize').value = ['compact', 'standard', 'generous'].includes(settings.spaceSize) ? settings.spaceSize : 'standard';
    $('printQuestionsPerPage').value = pageCountValues.includes(String(settings.questionsPerPage)) ? String(settings.questionsPerPage) : 'auto';
    $('printArabicScenario').checked = settings.includeArabic !== false;
    $('printStudentHeader').checked = settings.includeStudentHeader !== false;
    syncModeOptions();
  };

  const paginationProfile = settings => {
    const value = settings.questionsPerPage;
    if (value === 'auto') {
      return {
        badge: 'AUTO',
        title: 'Smart automatic layout',
        hint: 'The browser balances question length, images, answers, and writing space to avoid awkward page breaks.',
        note: ''
      };
    }
    const count = Number.parseInt(value, 10);
    const density = count <= 2 ? 'spacious' : count <= 4 ? 'balanced' : count <= 6 ? 'compact' : 'high-density';
    let note = `The layout targets ${count} question${count === 1 ? '' : 's'} on each question page and automatically adjusts spacing.`;
    if (settings.mode === 'worksheet') {
      note += ' Handwriting lines are reduced when needed so the selected page count remains practical.';
    } else if (settings.mode === 'study' && settings.answerPlacement === 'inline') {
      note += ' Long model answers may continue onto an extra page rather than being clipped.';
    } else if (settings.mode === 'study' && settings.answerPlacement === 'end') {
      note += ' The separate answer key remains automatically paginated for readability.';
    } else if (settings.mode === 'compact') {
      note += ' Higher values use a denser but still readable question layout.';
    }
    return {
      badge: `${count}/PAGE`,
      title: `${count} question${count === 1 ? '' : 's'} per page • ${density}`,
      hint: note,
      note: count >= 8 && settings.mode !== 'compact'
        ? 'High-density pagination is best for short questions. MEQ cases, images, or full model answers can require additional space.'
        : ''
    };
  };

  const syncPaginationUI = () => {
    const settings = getSettings();
    const profile = paginationProfile(settings);
    $('printPaginationBadge').textContent = profile.badge;
    $('printPaginationTitle').textContent = profile.title;
    $('printPaginationHint').textContent = profile.hint;
    $('printPaginationNote').textContent = profile.note;
    $('printPaginationNote').hidden = !profile.note;
    updateSummary();
  };

  const syncModeOptions = () => {
    const mode = modeInputs.find(input => input.checked)?.value || 'study';
    $('studyPrintOptions').hidden = mode !== 'study';
    $('worksheetPrintOptions').hidden = mode !== 'worksheet';
    requestAnimationFrame(syncPaginationUI);
  };

  const updateSummary = () => {
    const items = getPrintableItems();
    const counts = items.reduce((acc, item) => {
      acc[item.dataset.type || 'other'] = (acc[item.dataset.type || 'other'] || 0) + 1;
      return acc;
    }, {});
    const parts = [];
    if (counts.case) parts.push(`${counts.case} MEQ`);
    if (counts.core) parts.push(`${counts.core} short`);
    if (counts.image) parts.push(`${counts.image} image`);
    if (counts.extra) parts.push(`${counts.extra} detailed`);
    const settings = getSettings();
    const perPage = settings.questionsPerPage === 'auto' ? 0 : Number.parseInt(settings.questionsPerPage, 10);
    const pageEstimate = perPage > 0 && items.length ? ` • about ${Math.ceil(items.length / perPage)} question page${Math.ceil(items.length / perPage) === 1 ? '' : 's'}` : '';
    $('printSelectionCount').textContent = `${items.length} printable item${items.length === 1 ? '' : 's'}${parts.length ? ` • ${parts.join(' • ')}` : ''}${pageEstimate}`;
    $('printFilterChips').innerHTML = currentFilterLabels().map(label => `<span class="print-filter-chip">${escapeHtml(label)}</span>`).join('');
    $('printLargeWarning').classList.toggle('show', items.length > 80);
    createButton.disabled = items.length === 0;
    return items;
  };

  const openModal = () => {
    lastFocused = document.activeElement;
    applySettings(loadSettings());
    updateSummary();
    overlay.hidden = false;
    document.body.classList.add('print-center-open');
    requestAnimationFrame(() => $('printCenterClose').focus());
  };

  const closeModal = () => {
    overlay.hidden = true;
    document.body.classList.remove('print-center-open');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  };

  const parseMarks = item => {
    const text = item.querySelector('.pill.marks')?.textContent || '';
    const value = Number.parseInt(text, 10);
    return Number.isFinite(value) && value > 0 ? value : 1;
  };

  const itemInfo = (item, number, includeArabic) => {
    const type = item.dataset.type || 'core';
    const typeLabels = {case: 'MEQ Case', core: 'High-Yield Short', image: 'Image / Spot', extra: 'Detailed Practice'};
    const rawTitle = item.querySelector('.case-title, .short-q')?.textContent?.trim() || `Question ${number}`;
    const title = rawTitle.replace(/^\d+\.\s*/, '');
    const lecture = item.closest('.lecture')?.querySelector('.lecture-title')?.textContent?.trim() || '';
    const metadata = [...item.querySelectorAll('.meta .pill')].map(pill => pill.textContent.trim());
    const image = item.querySelector('.visual img');
    const prompt = item.querySelector('.visual-prompt')?.textContent?.trim() || '';
    const scenarioElement = item.querySelector('.scenario');
    let scenario = '';
    let arabic = '';
    if (scenarioElement) {
      const clone = scenarioElement.cloneNode(true);
      const arabicNode = clone.querySelector('.arabic');
      arabic = arabicNode?.textContent?.trim() || '';
      arabicNode?.remove();
      scenario = clone.textContent.trim().replace(/^Scenario:\s*/i, '');
    }
    let questions = [...item.querySelectorAll('.q-list li')].map(li => li.textContent.trim());
    if (!questions.length) questions = [item.querySelector('.short-q')?.textContent?.trim() || title];
    let answerHtml = '';
    const answer = item.querySelector('.answer-area, .short-answer');
    if (answer) {
      const clone = answer.cloneNode(true);
      clone.removeAttribute('style');
      if (clone.classList.contains('short-answer')) {
        const leadingLabel = clone.querySelector(':scope > b:first-child');
        if (leadingLabel && /^Model answer:/i.test(leadingLabel.textContent.trim())) leadingLabel.remove();
      }
      answerHtml = clone.innerHTML;
    }
    return {
      number, type, typeLabel: typeLabels[type] || 'Question', title, lecture, metadata,
      imageSrc: image?.src || '', imageAlt: image?.alt || title, prompt, scenario,
      arabic: includeArabic ? arabic : '', questions, answerHtml, marks: parseMarks(item)
    };
  };

  const manualLineCap = (questionsPerPage, questionCount) => {
    const count = Number.parseInt(questionsPerPage, 10);
    if (!Number.isFinite(count) || count < 1) return Infinity;
    const totalCaps = {1: 32, 2: 18, 3: 12, 4: 9, 5: 7, 6: 6, 8: 4, 10: 3, 12: 2};
    const total = totalCaps[count] || Math.max(2, Math.floor(28 / count));
    return Math.max(2, Math.floor(total / Math.max(1, questionCount)));
  };

  const answerLineCount = (info, questionCount, size, questionsPerPage = 'auto') => {
    const marksPerQuestion = Math.max(.5, info.marks / Math.max(1, questionCount));
    const sizing = {
      compact: {factor: 1.05, extra: 2, min: 3, max: 8},
      standard: {factor: 1.75, extra: 3, min: 5, max: 14},
      generous: {factor: 2.55, extra: 4, min: 8, max: 22}
    }[size] || {factor: 1.75, extra: 3, min: 5, max: 14};
    const automatic = Math.max(sizing.min, Math.min(sizing.max, Math.round(marksPerQuestion * sizing.factor + sizing.extra)));
    return Math.min(automatic, manualLineCap(questionsPerPage, questionCount));
  };

  const renderQuestionList = (info, settings) => {
    const withSpace = settings.mode === 'worksheet';
    const lines = answerLineCount(info, info.questions.length, settings.spaceSize, settings.questionsPerPage);
    return `<ol class="question-list">${info.questions.map(question => `
      <li>
        <div class="question-text">${escapeHtml(question)}</div>
        ${withSpace ? `<div class="answer-space" style="--answer-lines:${lines}" aria-hidden="true"></div>` : ''}
      </li>`).join('')}</ol>`;
  };

  const renderItem = (info, settings, includeInlineAnswer) => {
    const classes = ['print-item', `type-${info.type}`];
    if (info.questions.length > 1) classes.push('multi-question');
    return `<article class="${classes.join(' ')}" data-question-number="${info.number}">
      <header class="item-head">
        <div><span class="item-number">${info.number}</span><span class="item-type">${escapeHtml(info.typeLabel)}</span></div>
        <div class="item-lecture">${escapeHtml(info.lecture)}</div>
      </header>
      <h2>${escapeHtml(info.title)}</h2>
      ${info.metadata.length ? `<div class="item-meta">${info.metadata.map(value => `<span>${escapeHtml(value)}</span>`).join('')}</div>` : ''}
      ${info.scenario ? `<div class="scenario-box"><b>Scenario:</b> ${escapeHtml(info.scenario)}${info.arabic ? `<div class="arabic-scenario" lang="ar" dir="rtl">${escapeHtml(info.arabic)}</div>` : ''}</div>` : ''}
      ${info.imageSrc ? `<figure class="question-image"><img src="${escapeHtml(info.imageSrc)}" alt="${escapeHtml(info.imageAlt)}"><figcaption>${escapeHtml(info.prompt)}</figcaption></figure>` : (info.prompt ? `<div class="image-prompt">${escapeHtml(info.prompt)}</div>` : '')}
      ${['core', 'extra'].includes(info.type)
        ? (settings.mode === 'worksheet' ? `<div class="answer-space" style="--answer-lines:${answerLineCount(info, 1, settings.spaceSize, settings.questionsPerPage)}" aria-hidden="true"></div>` : '')
        : renderQuestionList(info, settings)}
      ${includeInlineAnswer && info.answerHtml ? `<section class="model-answer"><h3>Model answer</h3>${info.answerHtml}</section>` : ''}
    </article>`;
  };

  const chunkItems = (items, size) => {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
    return chunks;
  };

  const renderQuestionPages = (infos, settings, inlineAnswers) => {
    if (settings.questionsPerPage === 'auto') return infos.map(info => renderItem(info, settings, inlineAnswers)).join('');
    const count = Number.parseInt(settings.questionsPerPage, 10);
    return chunkItems(infos, count).map((pageInfos, pageIndex, pages) => `
      <section class="question-page manual-page${pageIndex === pages.length - 1 ? ' last-page' : ''}" data-page-group="${pageIndex + 1}" data-page-count="${pages.length}">
        ${pageInfos.map(info => renderItem(info, settings, inlineAnswers)).join('')}
      </section>`).join('');
  };

  const renderAnswerKey = infos => `<section class="answer-key">
    <div class="answer-key-title"><span>Answer Key</span><small>Model answers for the printed questions</small></div>
    ${infos.map(info => `<article class="answer-key-item"><h2>${info.number}. ${escapeHtml(info.title)}</h2>${info.answerHtml || '<p>No model answer available.</p>'}</article>`).join('')}
  </section>`;

  const documentTitle = () => {
    const lectureNames = [...new Set(getPrintableItems().map(item => item.closest('.lecture')?.querySelector('.lecture-title')?.textContent?.trim()).filter(Boolean))];
    if (lectureNames.length === 1) return lectureNames[0];
    const subject = selectedText('subjectSelect');
    return subject ? `${subject} Review Bank` : 'Medical MEQ Review Bank';
  };

  const pageSettingDescription = settings => settings.questionsPerPage === 'auto'
    ? 'Automatic pagination'
    : `${settings.questionsPerPage} question${settings.questionsPerPage === '1' ? '' : 's'} per page`;

  const modeDescription = settings => {
    const pageDescription = pageSettingDescription(settings);
    if (settings.mode === 'worksheet') return `Questions only • Handwritten worksheet • ${settings.spaceSize} writing space • ${pageDescription}`;
    if (settings.mode === 'compact') return `Questions only • Compact layout • No writing space • ${pageDescription}`;
    return settings.answerPlacement === 'end'
      ? `Questions with model answers • Separate answer key • ${pageDescription}`
      : `Questions with model answers • Answers below each item • ${pageDescription}`;
  };

  const buildPrintDocument = (items, settings) => {
    const infos = items.map((item, index) => itemInfo(item, index + 1, settings.includeArabic));
    const inlineAnswers = settings.mode === 'study' && settings.answerPlacement === 'inline';
    const separateAnswers = settings.mode === 'study' && settings.answerPlacement === 'end';
    const title = documentTitle();
    const subject = selectedText('subjectSelect');
    const generated = new Intl.DateTimeFormat(undefined, {dateStyle: 'medium', timeStyle: 'short'}).format(new Date());
    const baseHref = escapeHtml(document.baseURI);
    const qppClass = settings.questionsPerPage === 'auto' ? 'qpp-auto' : `qpp-${settings.questionsPerPage}`;
    const paginationClass = settings.questionsPerPage === 'auto' ? 'automatic-pagination' : 'manual-pagination';
    const printCss = `
      :root{--brand:#174ea6;--ink:#172033;--muted:#667085;--line:#cfd8e6;--soft:#f5f8fc;--green:#067647;--gold:#8a4b00;--item-pad-y:5mm;--item-pad-x:5.5mm;--item-gap:5mm;--title-size:13.5pt;--body-size:10.5pt;--image-max:78mm;--answer-line-height:5.4mm}
      *{box-sizing:border-box}html{background:#fff}body{margin:0;color:var(--ink);font-family:Arial,"Segoe UI",Tahoma,sans-serif;line-height:1.42;font-size:var(--body-size);background:#fff}
      .document{max-width:190mm;margin:0 auto}.document-head{border:1.5px solid #9fb9df;border-radius:12px;padding:12mm 10mm 8mm;margin-bottom:7mm;background:linear-gradient(135deg,#f7faff,#eef5ff)}
      .brand-line{font-size:8.5pt;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--brand)}h1{font-size:24pt;line-height:1.08;margin:2mm 0 2mm}.subtitle{color:var(--muted);font-size:10pt}.student-fields{display:grid;grid-template-columns:1.6fr 1fr 1fr;gap:7mm;margin-top:7mm;padding-top:5mm;border-top:1px solid #bdcce1}.field{display:flex;gap:2mm;align-items:flex-end}.field b{white-space:nowrap}.field-line{height:5mm;flex:1;border-bottom:1px solid #62718a}.print-summary{display:flex;justify-content:space-between;gap:8mm;flex-wrap:wrap;margin-top:5mm;font-size:8.5pt;color:#475467}.print-summary strong{color:var(--brand)}
      .question-page.manual-page{break-after:page;page-break-after:always}.question-page.manual-page.last-page{break-after:auto;page-break-after:auto}
      .print-item{border:1px solid var(--line);border-radius:9px;padding:var(--item-pad-y) var(--item-pad-x);margin:0 0 var(--item-gap);background:#fff;break-inside:auto}.automatic-pagination .print-item.type-core,.automatic-pagination .print-item.type-extra{break-inside:avoid-page}.manual-pagination .print-item{break-inside:avoid-page}.item-head{display:flex;justify-content:space-between;align-items:center;gap:5mm;color:var(--muted);font-size:8pt;text-transform:uppercase;letter-spacing:.04em}.item-number{display:inline-grid;place-items:center;width:7mm;height:7mm;border-radius:50%;background:var(--brand);color:#fff;font-weight:900;margin-right:2mm}.item-type{font-weight:850;color:var(--brand)}.item-lecture{font-weight:700;text-align:right}.print-item h2{font-size:var(--title-size);line-height:1.25;margin:3mm 0 2.5mm}.item-meta{display:flex;gap:2mm;flex-wrap:wrap;margin-bottom:3mm}.item-meta span{border:1px solid #d6deea;background:#f7f9fc;border-radius:999px;padding:1mm 2.3mm;font-size:7.8pt;font-weight:700;color:#475467}.scenario-box{border-left:3px solid var(--brand);background:#f6f9fe;padding:3.2mm 3.5mm;margin:3mm 0;border-radius:0 7px 7px 0}.arabic-scenario{text-align:right;margin-top:2.5mm;padding-top:2mm;border-top:1px dashed #bac8dc;color:#344054}.question-image{margin:3mm 0;text-align:center}.question-image img{display:block;max-width:100%;max-height:var(--image-max);object-fit:contain;margin:0 auto;border:1px solid #d4dce8;border-radius:7px}.question-image figcaption,.image-prompt{font-weight:700;color:#344054;margin-top:2mm;text-align:left}.question-list{margin:3mm 0 0;padding-left:7mm}.question-list>li{padding-left:1mm;margin:0 0 3mm;break-inside:avoid}.question-text{font-weight:650}.answer-space{--answer-lines:6;height:calc(var(--answer-lines) * var(--answer-line-height));margin:2mm 0 4mm;background:repeating-linear-gradient(to bottom,transparent 0,transparent calc(var(--answer-line-height) - .25mm),#aeb9c8 calc(var(--answer-line-height) - .25mm),#aeb9c8 var(--answer-line-height));border-left:1px solid #d7dee9;border-right:1px solid #d7dee9}
      .model-answer{margin-top:4mm;padding-top:3.5mm;border-top:1px dashed #98aac2}.model-answer>h3{margin:0 0 2.5mm;color:var(--green);font-size:11pt}.model-answer .answer-area,.model-answer .short-answer{display:block!important;margin:0;padding:0;border:0;background:transparent;color:inherit}.model-answer .answer-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:3mm}.model-answer .answer-card{border:1px solid #cfd8e6;border-radius:7px;padding:3mm;background:#f8fafc}.model-answer .answer-card h4{margin:0 0 1.5mm;color:var(--brand)}.model-answer ul{margin:0;padding-left:5mm}.model-answer .exam-trap,.model-answer .memory{margin-top:2.5mm;padding:2.5mm 3mm;border-radius:6px}.model-answer .exam-trap{background:#fff1f0;border:1px solid #f6b9b5;color:#7a271a}.model-answer .memory{background:#ecfdf3;border:1px solid #9de8bc;color:#05603a}.model-answer b:first-child{color:var(--green)}
      .answer-key{break-before:page}.answer-key-title{border-bottom:2px solid var(--brand);padding-bottom:3mm;margin-bottom:5mm}.answer-key-title span{display:block;font-size:22pt;font-weight:900}.answer-key-title small{color:var(--muted)}.answer-key-item{border-bottom:1px solid var(--line);padding:0 0 5mm;margin:0 0 5mm;break-inside:auto}.answer-key-item h2{font-size:13pt;color:var(--brand);margin:0 0 3mm}.answer-key-item .answer-area,.answer-key-item .short-answer{display:block!important;margin:0;padding:0;border:0;background:transparent;color:inherit}.answer-key-item .answer-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:3mm}.answer-key-item .answer-card{border:1px solid var(--line);padding:3mm;border-radius:7px;background:#f8fafc}.answer-key-item .answer-card h4{margin:0 0 1.5mm}.answer-key-item .exam-trap,.answer-key-item .memory{padding:2.5mm;margin-top:2mm;border:1px solid var(--line);border-radius:6px}.answer-key-item ul{margin:0;padding-left:5mm}.document-foot{text-align:center;color:var(--muted);font-size:8pt;border-top:1px solid var(--line);padding-top:3mm;margin-top:7mm}
      .manual-pagination.qpp-3,.manual-pagination.qpp-4{--item-pad-y:4mm;--item-pad-x:4.5mm;--item-gap:3.5mm;--title-size:12.5pt;--body-size:10pt;--image-max:62mm;--answer-line-height:5.1mm}.manual-pagination.qpp-5,.manual-pagination.qpp-6{--item-pad-y:3.2mm;--item-pad-x:4mm;--item-gap:2.8mm;--title-size:11.5pt;--body-size:9.3pt;--image-max:48mm;--answer-line-height:4.8mm}.manual-pagination.qpp-8,.manual-pagination.qpp-10,.manual-pagination.qpp-12{--item-pad-y:2.4mm;--item-pad-x:3.2mm;--item-gap:2mm;--title-size:10.5pt;--body-size:8.6pt;--image-max:36mm;--answer-line-height:4.5mm}.manual-pagination.qpp-8 .item-meta,.manual-pagination.qpp-10 .item-meta,.manual-pagination.qpp-12 .item-meta{margin-bottom:1.6mm}.manual-pagination.qpp-8 .scenario-box,.manual-pagination.qpp-10 .scenario-box,.manual-pagination.qpp-12 .scenario-box{padding:2mm 2.5mm;margin:1.8mm 0}.manual-pagination.qpp-8 .item-head,.manual-pagination.qpp-10 .item-head,.manual-pagination.qpp-12 .item-head{font-size:7pt}.manual-pagination.qpp-8 .item-number,.manual-pagination.qpp-10 .item-number,.manual-pagination.qpp-12 .item-number{width:6mm;height:6mm}
      @page{size:A4;margin:13mm 12mm 15mm}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.document{max-width:none}.document-head{break-inside:avoid}.print-item:last-child{margin-bottom:0}.manual-pagination .document-head{padding:8mm 8mm 6mm;margin-bottom:5mm}.manual-pagination .document-head h1{font-size:21pt}.manual-pagination .student-fields{margin-top:5mm;padding-top:4mm}}
      @media(max-width:700px){.model-answer .answer-grid,.answer-key-item .answer-grid{grid-template-columns:1fr}}
    `;
    const body = renderQuestionPages(infos, settings, inlineAnswers);
    const answerKey = separateAnswers ? renderAnswerKey(infos) : '';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${baseHref}"><title>${escapeHtml(title)} — Print</title><style>${printCss}</style></head><body><main class="document ${paginationClass} ${qppClass} mode-${settings.mode}">
      <header class="document-head"><div class="brand-line">Medical MEQ Review Bank</div><h1>${escapeHtml(title)}</h1><div class="subtitle">${escapeHtml(subject)} • ${escapeHtml(modeDescription(settings))}</div>
      ${settings.includeStudentHeader ? '<div class="student-fields"><div class="field"><b>Name:</b><span class="field-line"></span></div><div class="field"><b>Date:</b><span class="field-line"></span></div><div class="field"><b>Score:</b><span class="field-line"></span></div></div>' : ''}
      <div class="print-summary"><span><strong>${infos.length}</strong> printable items</span><span>${escapeHtml(pageSettingDescription(settings))} • Generated ${escapeHtml(generated)}</span></div></header>
      ${body}${answerKey}<footer class="document-foot">Medical MEQ Review Bank • ${escapeHtml(modeDescription(settings))}</footer></main></body></html>`;
  };

  const waitForImages = async printDocument => {
    const images = [...printDocument.images];
    await Promise.all(images.map(image => {
      if (image.complete) return Promise.resolve();
      return new Promise(resolve => {
        const done = () => resolve();
        image.addEventListener('load', done, {once: true});
        image.addEventListener('error', done, {once: true});
        setTimeout(done, 3500);
      });
    }));
  };

  const showToast = message => {
    const toast = document.getElementById('appToast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2600);
  };

  const createPrint = async () => {
    const items = updateSummary();
    if (!items.length) return;
    const settings = getSettings();
    saveSettings(settings);
    const html = buildPrintDocument(items, settings);
    globalThis.__medicalBankLastPrintHTML = html;
    globalThis.__medicalBankLastPrintSettings = settings;

    const oldText = createButton.textContent;
    createButton.disabled = true;
    createButton.textContent = 'Preparing…';
    showToast(`Preparing ${items.length} printable items…`);

    let printWindow = null;
    try {
      printWindow = window.open('', '_blank', 'width=1050,height=850');
    } catch (error) { printWindow = null; }

    try {
      if (printWindow) {
        printWindow.opener = null;
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        await waitForImages(printWindow.document);
        closeModal();
        printWindow.focus();
        printWindow.print();
        printWindow.addEventListener('afterprint', () => {
          try { printWindow.close(); } catch (error) { /* no-op */ }
        }, {once: true});
      } else {
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
        document.body.appendChild(frame);
        const printDocument = frame.contentDocument;
        printDocument.open();
        printDocument.write(html);
        printDocument.close();
        await waitForImages(printDocument);
        closeModal();
        frame.contentWindow.focus();
        frame.contentWindow.print();
        frame.contentWindow.addEventListener('afterprint', () => frame.remove(), {once: true});
        setTimeout(() => frame.remove(), 120000);
      }
    } catch (error) {
      console.error('Could not create print document:', error);
      showToast('Print preview could not be opened. Please allow pop-ups and try again.');
      try { printWindow?.close(); } catch (closeError) { /* no-op */ }
    } finally {
      createButton.textContent = oldText;
      createButton.disabled = getPrintableItems().length === 0;
    }
  };

  modeInputs.forEach(input => input.addEventListener('change', syncModeOptions));
  $('printAnswerPlacement').addEventListener('change', syncPaginationUI);
  $('printSpaceSize').addEventListener('change', syncPaginationUI);
  $('printQuestionsPerPage').addEventListener('change', syncPaginationUI);
  originalPrintButton?.addEventListener('click', openModal);
  quickPrintButton?.addEventListener('click', openModal);
  $('printCenterClose').addEventListener('click', closeModal);
  $('printCenterCancel').addEventListener('click', closeModal);
  createButton.addEventListener('click', createPrint);
  overlay.addEventListener('click', event => { if (event.target === overlay) closeModal(); });
  document.addEventListener('keydown', event => {
    if (overlay.hidden) return;
    if (event.key === 'Escape') closeModal();
    if (event.key === 'Tab') {
      const focusable = [...modalDialog.querySelectorAll('button,input,select,[tabindex]:not([tabindex="-1"])')].filter(element => !element.disabled && !element.closest('[hidden]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
})();
