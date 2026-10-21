import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {setTimeout as pause} from 'node:timers/promises';
import {chromium} from '@playwright/test';

// This checks the REAL Cloudflare Worker, not the local dist/ server.
// It never edits study progress or the source lecture data.
const site = new URL(process.env.MEQ_PRODUCTION_URL || 'https://medical-meq-bank.hafztamr.workers.dev/');
assert.equal(site.protocol, 'https:', 'Production smoke requires HTTPS');
const expectedVersion = JSON.parse(readFileSync(new URL('../version.json', import.meta.url), 'utf8')).version;
const accessId = process.env.MEQ_CF_ACCESS_CLIENT_ID?.trim() || '';
const accessSecret = process.env.MEQ_CF_ACCESS_CLIENT_SECRET?.trim() || '';
assert.equal(Boolean(accessId), Boolean(accessSecret), 'Provide BOTH Cloudflare Access secrets, or neither');
if (accessId) {
  // Never send long-lived service credentials to a configurable/untrusted host.
  assert.equal(site.origin, 'https://medical-meq-bank.hafztamr.workers.dev',
    'Cloudflare Access credentials are restricted to the approved production origin');
}
const accessHeaders = accessId
  ? {'CF-Access-Client-Id': accessId, 'CF-Access-Client-Secret': accessSecret}
  : {};

const output = process.env.MEQ_SMOKE_OUTPUT || 'production-smoke-evidence';
mkdirSync(output, {recursive: true});

const observations = [];
const errors = [];
let liveVersion = 'unavailable';
let page;
let browser;

async function waitForDeployment() {
  const endpoint = new URL('version.json', site);
  for (let attempt = 1; attempt <= 18; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        cache: 'no-store',
        redirect: 'manual',
        headers: {'Cache-Control': 'no-cache', 'Accept': 'application/json', ...accessHeaders},
        signal: AbortSignal.timeout(12000)
      });
      if (response.status >= 300 && response.status < 400) {
        const destination = new URL(response.headers.get('location') || '/', endpoint);
        const error = new Error(
          'Production version endpoint redirected (HTTP ' + response.status +
          ') to ' + destination.origin + destination.pathname +
          '. Check the Cloudflare Access login policy or Worker asset routing.'
        );
        error.permanent = true;
        throw error;
      }
      if (!response.ok) throw new Error('Live version endpoint returned HTTP ' + response.status);
      const body = await response.text();
      const contentType = response.headers.get('content-type') || 'unknown';
      if (body.trimStart().startsWith('<')) {
        // Do not dump HTML into CI logs; an Access/login page may contain
        // session-sensitive data. The title is enough to diagnose routing.
        const title = body.match(/<title[^>]*>([^<]{0,120})<\/title>/i)?.[1]?.trim() || '(no HTML title)';
        const error = new Error(
          'Production /version.json returned HTML instead of the release manifest ' +
          '(HTTP ' + response.status + ', Content-Type: ' + contentType +
          ', title: ' + JSON.stringify(title) + '). ' +
          'Check whether Cloudflare Access is serving a login page, or the Worker is serving index.html in place of static JSON.'
        );
        error.permanent = true;
        throw error;
      }
      const parsed = JSON.parse(body);
      if (!parsed || typeof parsed.version !== 'string') {
        throw new Error('Live version.json is missing the version string');
      }
      liveVersion = parsed.version;
      observations.push({step: 'version-poll', attempt, liveVersion});
      if (liveVersion === expectedVersion) return;
      console.log('Cloudflare version is ' + liveVersion + '; expecting ' + expectedVersion + ' (attempt ' + attempt + '/18)');
    } catch (error) {
      observations.push({step: 'version-poll', attempt, error: String(error)});
      if (error.permanent) throw error; // Access/routing is not a deployment-propagation delay.
      console.warn('Could not read live version (' + attempt + '/18): ' + String(error));
    }
    if (attempt < 18) await pause(15000);
  }
  throw new Error('Cloudflare has not published expected release ' + expectedVersion + '; current live version: ' + liveVersion);
}

async function verifyWorkspace(width, height) {
  await page.setViewportSize({width, height});
  await page.goto(site.href, {waitUntil: 'domcontentloaded', timeout: 45000});
  await page.waitForFunction(() => document.getElementById('mainContent')?.getAttribute('aria-busy') === 'false', null, {timeout: 25000});
  await page.locator('#courseSelector').waitFor({state: 'visible'});

  const result = await page.evaluate(() => {
    const files = [...document.querySelectorAll('link[rel="stylesheet"][href], script[src]')]
      .map(el => new URL(el.href || el.src, location.href));
    const hero = document.querySelector('.hero');
    const icon = document.querySelector('.pwa-tools-toggle .ui-icon svg');
    const library = document.querySelector('.course-library');
    const course = document.querySelector('#courseSelector');
    return {
      assetVersions: files.map(url => url.searchParams.get('v')),
      allSameOrigin: files.every(url => url.origin === location.origin),
      heroColor: getComputedStyle(hero).backgroundColor,
      iconWidth: icon?.getBoundingClientRect().width,
      courseWidth: course?.getBoundingClientRect().width,
      libraryHeight: library?.getBoundingClientRect().height,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  assert(result.assetVersions.length >= 14, 'Live page did not load the expected CSS/JS assets');
  assert(result.assetVersions.every(version => version === expectedVersion), 'Mixed release versions in live CSS/JS');
  assert(result.allSameOrigin, 'A runtime asset unexpectedly came from another origin');
  assert.equal(result.heroColor, 'rgb(17, 57, 66)', 'Live hero is not styled with the approved V3 palette');
  assert(result.iconWidth >= 16 && result.iconWidth <= 24, 'Navigation icons are oversized or missing');
  assert(result.libraryHeight >= 38 && result.libraryHeight <= 125, 'Course Library is missing or distorted');
  assert(result.courseWidth > 80, 'Course navigation is unusably narrow');
  assert(result.overflow <= 1, 'The live page has horizontal overflow (' + width + 'px)');
  observations.push({step: 'responsive', width, height, ...result});
  await page.screenshot({path: output + '/workspace-' + width + '.png', animations: 'disabled'});
}

async function verifyDermatology() {
  await page.setViewportSize({width: 390, height: 844});
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await page.waitForFunction(() => document.querySelector('#subjectSelector')?.value === 'dermatology');
  const mobileFilter = page.locator('#mobileFiltersToggle');
  if (await mobileFilter.isVisible()) await mobileFilter.click();
  const lectureId = 'internal-medicine-ii-dermatology-introduction';
  await page.locator('#lectureFilter').selectOption(lectureId);
  const close = page.locator('#closeMobileFiltersBtn');
  if (await close.isVisible()) await close.click();
  await page.waitForFunction(() => document.getElementById('mainContent')?.getAttribute('aria-busy') === 'false', null, {timeout: 25000});
  assert.equal(await page.locator('#lecture-' + lectureId + ' .image-card img').count(), 14, 'Hosted Dermatology photo cards are missing');
  assert.equal(await page.locator('.study-guide-mcq').count(), 30, 'Published Dermatology MCQs are missing');
  assert.equal(await page.locator('#originalFigureTools').isVisible(), false, 'Hosted photos incorrectly require manual import');

  const integrity = await page.evaluate(async id => {
    const lecture = lectures.find(item => item.id === id);
    if (!lecture) throw new Error('Published Dermatology lecture is not loaded');
    return Promise.all(lecture.imageQuestions.map(async image => {
      const response = await fetch(image.image, {cache: 'no-store'});
      if (!response.ok) return {id: image.id, ok: false, status: response.status};
      const bytes = await response.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const sha = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      return {
        id: image.id, ok: true, contentType: response.headers.get('content-type'),
        bytes: bytes.byteLength, shaMatches: sha === image.imageSha256
      };
    }));
  }, lectureId);
  assert.equal(integrity.length, 14, 'Expected 14 authentic source-image slots');
  assert(integrity.every(item => item.ok && item.shaMatches && item.bytes > 300 && /image\/jpeg/.test(item.contentType || '')),
    'An original medical JPEG is missing, damaged or does not match its source SHA-256');
  await page.locator('.learning-companion summary').nth(2).click();
  assert.equal(await page.locator('.original-atlas-item img').count(), 14, 'Live original photograph atlas is incomplete');
  const first = page.locator('.original-atlas-item img').first();
  await first.scrollIntoViewIfNeeded();
  await first.evaluate(img => img.decode());
  await page.screenshot({path: output + '/dermatology-original-photos-390.png', animations: 'disabled'});
  observations.push({step: 'dermatology', photoCount: integrity.length, verifiedSha256: integrity.length, mcqCount: 30});
}

async function run() {
  await waitForDeployment();
  browser = await chromium.launch({headless: true});
  const context = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'allow'});
  if (accessId) {
    // Do not use context-wide extraHTTPHeaders: those can leak a service
    // token to external resources or a redirected login origin.
    await context.route('**/*', route => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.origin !== site.origin) return route.continue();
      return route.continue({
        headers: {...route.request().headers(), ...accessHeaders}
      });
    });
  }
  page = await context.newPage();
  page.on('pageerror', error => errors.push('Page: ' + String(error)));
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(site.origin)) {
      errors.push('HTTP ' + response.status() + ': ' + response.url());
    }
  });
  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
    await verifyWorkspace(width, height);
  }

  // A controlled client should never reuse obsolete application CSS/JS.
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, {timeout: 30000});
  await page.evaluate(async () => {
    const old = await caches.open('medical-meq-bank-2026.10.04.2');
    await old.put(new URL('./app.css', location.href), new Response(
      '.hero{background:red!important}.ui-icon svg{width:400px!important;height:400px!important}',
      {headers: {'Content-Type': 'text/css'}}
    ));
  });
  await verifyWorkspace(390, 844);
  observations.push({step: 'service-worker-old-css-poison', outcome: 'passed'});
  await verifyDermatology();
  await page.locator('#darkBtn').click();
  assert.equal(await page.locator('body').evaluate(el => el.classList.contains('dark')), true, 'Dark mode failed on the live study page');
  observations.push({step: 'theme-toggle', outcome: 'passed'});
  assert.deepEqual(errors, [], 'The live browser reported HTTP/JavaScript errors');
  console.log('Cloudflare production verified: release ' + expectedVersion + ', responsive UI, PWA, dark mode and 14 original Dermatology photos.');
}

try {
  await run();
  writeFileSync(output + '/result.json', JSON.stringify({ok: true, expectedVersion, liveVersion, site: site.href, observations, errors}, null, 2));
} catch (error) {
  if (page && !page.isClosed()) {
    try { await page.screenshot({path: output + '/failure.png', animations: 'disabled'}); } catch {}
  }
  writeFileSync(output + '/result.json', JSON.stringify({ok: false, expectedVersion, liveVersion, site: site.href, observations, errors, failure: String(error)}, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
