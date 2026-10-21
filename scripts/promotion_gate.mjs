import assert from 'node:assert/strict';

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const SHA = /^[a-f0-9]{40}$/;
const REQUIRED = ['validate', 'chromium-quality', 'webkit-quality'];

function latestCheck(checkRuns, name) {
  return checkRuns
    .filter(item => item.name === name)
    .sort((a, b) =>
      (b.started_at || b.completed_at || '').localeCompare(a.started_at || a.completed_at || '')
    )[0];
}

function validatePromotionChecks(checkRuns, workerVersion) {
  assert(UUID.test(workerVersion), 'Worker version must be a lowercase UUID');
  for (const name of REQUIRED) {
    const check = latestCheck(checkRuns, name);
    assert.equal(check?.conclusion, 'success', 'Missing or failing required check: ' + name);
  }
  const worker = latestCheck(checkRuns, 'Workers Builds: medical-meq-bank');
  assert.equal(worker?.conclusion, 'success', 'Cloudflare Workers Build must succeed');
  const buildVersion = worker.output?.summary?.match(/Version ID:\s*([0-9a-f-]{36})/i)?.[1]?.toLowerCase();
  assert.equal(buildVersion, workerVersion,
    'Worker version does not match the validated Cloudflare build for this commit');
}

function selfTest() {
  const id = '693d6a6f-f459-4080-ba98-5a14b935946e';
  const passes = REQUIRED.map(name => ({name, conclusion: 'success', started_at: '2026-10-21T20:00:00Z'}));
  passes.push({
    name: 'Workers Builds: medical-meq-bank',
    conclusion: 'success',
    started_at: '2026-10-21T20:01:00Z',
    output: {summary: 'Build ID: example\nVersion ID: ' + id}
  });
  validatePromotionChecks(passes, id);
  assert.throws(() => validatePromotionChecks(passes, '11111111-2222-3333-4444-555555555555'));
  assert.throws(() => validatePromotionChecks(passes.filter(x => x.name !== 'webkit-quality'), id));
  assert.throws(() => validatePromotionChecks([
    ...passes, {name: 'validate', conclusion: 'failure', started_at: '2026-10-21T20:02:00Z'}
  ], id));
  console.log('Cloudflare promotion eligibility self-test passed.');
}

async function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const repo = process.env.GITHUB_REPOSITORY;
  const sha = process.env.SOURCE_SHA || '';
  const version = process.env.WORKER_VERSION_ID || '';
  const token = process.env.GITHUB_TOKEN || '';
  assert.equal(repo, 'Hafezalhoot/medical-meq-bank', 'Refusing to promote an unknown repository');
  assert(SHA.test(sha), 'Expected a full 40-character Git SHA');
  assert(token, 'Missing checks:read GitHub token');
  assert(UUID.test(version), 'Invalid Cloudflare Worker version identifier');
  const url = 'https://api.github.com/repos/' + repo + '/commits/' + sha + '/check-runs?per_page=100';
  const response = await fetch(url, {
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'MEQ-Protected-Release-Gate'
    },
    signal: AbortSignal.timeout(15000)
  });
  assert(response.ok, 'Cannot read GitHub CI checks (' + response.status + ')');
  const body = await response.json();
  assert(body.total_count <= 100, 'Unexpected check-run pagination; review promotion gate before deploying');
  validatePromotionChecks(body.check_runs || [], version);
  console.log('Approved release: ' + sha + ' / Cloudflare Worker version ' + version);
}

main().catch(error => {
  console.error('PRODUCTION PROMOTION REFUSED: ' + error.message);
  process.exitCode = 1;
});
