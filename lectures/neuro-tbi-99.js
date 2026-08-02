(async () => {
  const encoded = globalThis.__neuroTbiGzip;
  delete globalThis.__neuroTbiGzip;
  if (!encoded || lectures.some(item => item.id === 'neurosurgery-traumatic-brain-injury')) return;
  try {
    if (typeof DecompressionStream !== 'function') throw new Error('This browser does not support offline lecture decompression.');
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const lecture = JSON.parse(await new Response(stream).text());
    lectures.push(lecture);
    lectures.sort((a,b) => a.subjectKey.localeCompare(b.subjectKey) || a.order - b.order);
    populateLectureFilter();
    updateTopicOptions();
    render();
    validateBank();
    setSidebarState();
  } catch (error) {
    console.error('Could not load Traumatic Brain Injury lecture:', error);
    const toast = document.getElementById('appToast');
    if (toast) {
      toast.textContent = 'Traumatic Brain Injury could not be loaded. Refresh the app while online.';
      toast.classList.add('show');
    }
  }
})();
