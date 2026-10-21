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

import {createServer} from 'node:http';
import {once} from 'node:events';

test('service-auth request never forwards its secret after a cross-origin redirect', async ({page}) => {
  let receivedAtOrigin = '';
  let receivedAtRedirect = '';
  const listen = async server => {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return 'http://127.0.0.1:' + server.address().port + '/';
  };
  const destination = createServer((req, res) => {
    receivedAtRedirect = req.headers['cf-access-client-secret'] || '';
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Redirect reached');
  });
  const destinationURL = await listen(destination);
  const origin = createServer((req, res) => {
    receivedAtOrigin = req.headers['cf-access-client-secret'] || '';
    res.writeHead(302, {Location: destinationURL});
    res.end();
  });
  const originURL = await listen(origin);
  try {
    await page.route(originURL + '**', async route => {
      const response = await route.fetch({
        headers: {...route.request().headers(), 'CF-Access-Client-Secret': 'dummy-secret'},
        maxRedirects: 0
      });
      await route.fulfill({response});
    });
    await page.goto(originURL);
    expect(receivedAtOrigin).toBe('dummy-secret');
    expect(receivedAtRedirect).toBe('');
    await expect(page.locator('body')).toContainText('Redirect reached');
  } finally {
    await Promise.all([
      new Promise(resolve => origin.close(resolve)),
      new Promise(resolve => destination.close(resolve))
    ]);
  }
});
