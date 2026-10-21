import {test, expect} from '@playwright/test';
import {spawnSync} from 'node:child_process';

function runSmokeWithCredentials({id, secret, url}) {
  return spawnSync(process.execPath, ['scripts/production_smoke.mjs'], {
    encoding: 'utf8',
    timeout: 10_000,
    env: {
      ...process.env,
      MEQ_CF_ACCESS_CLIENT_ID: id,
      MEQ_CF_ACCESS_CLIENT_SECRET: secret,
      MEQ_PRODUCTION_URL: url
    }
  });
}

test('Cloudflare Access smoke refuses incomplete service-token credentials before network access', () => {
  const result = runSmokeWithCredentials({
    id: 'fake-service-id', secret: '',
    url: 'https://medical-meq-bank.hafztamr.workers.dev/'
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('Provide BOTH Cloudflare Access secrets, or neither');
  expect(result.stderr).not.toContain('fake-service-id');
});

test('Cloudflare Access service tokens cannot be sent to a different host', () => {
  const secret = 'dummy-secret-must-never-be-logged';
  const result = runSmokeWithCredentials({
    id: 'fake-service-id', secret,
    url: 'https://example.com/'
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('Cloudflare Access credentials are restricted to the approved production origin');
  expect(result.stderr).not.toContain(secret);
});
