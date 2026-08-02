(async()=>{
  try {
    const encoded=globalThis.__urolUtiGzip||'';
    if(!encoded) throw new Error('Missing compressed lecture payload');
    const binary=atob(encoded);
    const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const lecture=JSON.parse(await new Response(stream).text());
    if(lecture.id!=='urology-urinary-tract-infection') throw new Error('Unexpected lecture id');
    if(!lectures.some(item=>item.id===lecture.id)) {
      lectures.push(lecture);
      lectures.sort((a,b)=>a.subjectKey.localeCompare(b.subjectKey)||a.order-b.order);
      populateLectureFilter(); updateTopicOptions(); render(); validateBank(); setSidebarState();
    }
  } catch(error) {
    console.error('Could not load urology-uti:',error);
    if(typeof showToast==='function') showToast('Uti could not be loaded. Refresh the app while online.');
  } finally { delete globalThis.__urolUtiGzip; }
})();
