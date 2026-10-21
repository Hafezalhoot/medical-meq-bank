import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('fresh online HTML loads one coherent version of every CSS and JS asset', async ({page}) => {
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading', {name:'Medical MEQ Review Bank'})).toBeVisible();

  const result=await page.evaluate(async()=>{
    const release=(await (await fetch('/version.json',{cache:'no-store'})).json()).version;
    const urls=[
      ...document.querySelectorAll('link[rel="stylesheet"][href]'),
      ...document.querySelectorAll('script[src]')
    ].map(el=>new URL(el.href||el.src,location.href));
    const svg=document.querySelector('.pwa-tools-toggle .ui-icon svg');
    const library=document.querySelector('.course-library');
    const hero=document.querySelector('.hero');
    return {
      release,urls:urls.map(u=>u.searchParams.get('v')),
      allSameOrigin:urls.every(u=>u.origin===location.origin),
      cssHero:getComputedStyle(hero).backgroundColor,
      iconWidth:svg?.getBoundingClientRect().width,
      libraryHeight:library?.getBoundingClientRect().height,
      skip:getComputedStyle(document.querySelector('.skip-link')).transform,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
    };
  });
  expect(result.urls.length).toBeGreaterThanOrEqual(14);
  expect(result.urls.every(v=>v===result.release)).toBe(true);
  expect(result.allSameOrigin).toBe(true);
  expect(result.cssHero).toBe('rgb(17, 57, 66)');
  expect(result.iconWidth).toBeLessThanOrEqual(24);
  expect(result.libraryHeight).toBeGreaterThan(38);
  expect(result.libraryHeight).toBeLessThan(125);
  expect(result.skip).not.toBe('none');
  expect(result.overflow).toBeLessThanOrEqual(1);
});

test('cached obsolete CSS cannot corrupt the released page after reload', async ({page}) => {
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller)),{timeout:60_000}).toBe(true);
  await page.evaluate(async()=>{
    const obsolete=await caches.open('medical-meq-bank-2026.10.04.2');
    await obsolete.put(new URL('./app.css',location.href),new Response(
      '.hero{background:red!important}.ui-icon svg{width:400px!important;height:400px!important}',
      {headers:{'Content-Type':'text/css'}}
    ));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Medical MEQ Review Bank'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>
    Math.round(document.querySelector('.pwa-tools-toggle .ui-icon svg').getBoundingClientRect().width)
  )).toBe(18);
  await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.querySelector('.hero')).backgroundColor))
    .toBe('rgb(17, 57, 66)');
});

test('SW upgrade migrates students downloaded lessons but never obsolete app CSS', async () => {
  const hooks=new Map(),stores=new Map();
  const cacheOf=name=>{
    if(!stores.has(name))stores.set(name,new Map());
    const items=stores.get(name);
    const url=request=>new URL(typeof request==='string'?request:request.url,'https://study.example/').href;
    return {
      match:async request=>items.get(url(request))?.clone(),
      put:async(request,response)=>{items.set(url(request),response.clone());},
      keys:async()=>[...items.keys()].map(href=>new Request(href))
    };
  };
  const caches={
    open:async name=>cacheOf(name),
    keys:async()=>[...stores.keys()],
    delete:async name=>stores.delete(name)
  };
  const previous=await caches.open('medical-meq-bank-2026.10.04.2');
  await previous.put('https://study.example/app.css',new Response('.hero{background:red}'));
  await previous.put('https://study.example/lectures/data/urology-renal-tumors.json',
    new Response('{"id":"urology-renal-tumors"}'));
  await previous.put('https://study.example/assets/lectures/original/source.jpg',
    new Response('printed source asset'));
  const sw=readFileSync('dist/service-worker.js','utf8');
  const context={
    self:{
      addEventListener:(name,fn)=>hooks.set(name,fn),
      clients:{claim:async()=>{}},
      registration:{active:true},
      location:{origin:'https://study.example'}
    },
    caches,URL,Request,Response,console,
    fetch:async()=>{throw new Error('Offline test: network unavailable');}
  };
  runInNewContext(sw,context,{filename:'service-worker.js'});
  let work;
  hooks.get('activate')({waitUntil:promise=>{work=promise;}});
  await work;
  const names=await caches.keys();
  expect(names).not.toContain('medical-meq-bank-2026.10.04.2');
  expect(names).toContain('medical-meq-bank-user-lessons-v1');
  const persistent=await caches.open('medical-meq-bank-user-lessons-v1');
  expect(await persistent.match('https://study.example/lectures/data/urology-renal-tumors.json')).toBeTruthy();
  expect(await persistent.match('https://study.example/assets/lectures/original/source.jpg')).toBeTruthy();
  expect(await persistent.match('https://study.example/app.css')).toBeFalsy();
});
