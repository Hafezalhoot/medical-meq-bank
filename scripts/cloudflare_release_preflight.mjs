// Read-only release diagnostics. Never print credentials or raw API objects.
import assert from 'node:assert/strict';
import {appendFileSync} from 'node:fs';

assert.equal(process.env.GITHUB_REPOSITORY, 'Hafezalhoot/medical-meq-bank');
const account = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const token = process.env.CLOUDFLARE_API_TOKEN || '';
assert(/^[a-f0-9]{32}$/.test(account) && token, 'Missing existing Cloudflare CI authentication');
const summary = [];
function report(value) {
  const text = JSON.stringify(value);
  console.log(text);
  summary.push(text);
}
async function readApi(path, label) {
  const response = await fetch('https://api.cloudflare.com/client/v4/accounts/' + account + path, {
    method: 'GET', redirect: 'error',
    headers: {Authorization: 'Bearer ' + token, Accept: 'application/json'},
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json();
  report({check: label, httpStatus: response.status, success: data.success,
    errorCodes: (data.errors || []).map(item => item.code)});
  assert(response.ok && data.success, label + ' refused; no account settings changed');
  return data.result;
}
try {
  report({check: 'Access smoke credential presence',
    clientIdConfigured: Boolean(process.env.MEQ_CF_ACCESS_CLIENT_ID),
    clientSecretConfigured: Boolean(process.env.MEQ_CF_ACCESS_CLIENT_SECRET)});
  const scripts = await readApi('/workers/scripts', 'Find existing Worker');
  assert(Array.isArray(scripts), 'Unexpected Worker metadata response');
  const worker = scripts.find(item => item.id === 'medical-meq-bank');
  assert(worker && /^[a-f0-9]{32}$/.test(worker.tag || ''), 'Existing Worker tag not available');
  report({worker: worker.id, tag: worker.tag});
  const triggers = await readApi('/builds/workers/' + worker.tag + '/triggers', 'Read Workers Builds settings');
  assert(Array.isArray(triggers) && triggers.length, 'No build triggers returned');
  for (const trigger of triggers) {
    report({trigger: trigger.trigger_uuid, name: trigger.trigger_name,
      branches: trigger.branch_includes, excludedBranches: trigger.branch_excludes,
      buildCommand: trigger.build_command, deployCommand: trigger.deploy_command,
      repository: trigger.repo_connection ? {
        owner: trigger.repo_connection.provider_account_name,
        name: trigger.repo_connection.repo_name
      } : undefined});
  }
} catch (error) {
  report({blocked: error.message});
  process.exitCode = 1;
} finally {
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '### Read-only release preflight\n```json\n' + summary.join('\n') + '\n```\n');
  }
}
