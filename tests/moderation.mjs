import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const base = 'http://localhost:3000',
  username = 'moderation_' + Date.now().toString(36);
let cookie = '';
async function call(path, data, status = 200) {
  const r = await fetch(base + path, {
    method: data ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      Origin: base,
      Cookie: cookie,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (r.headers.get('set-cookie'))
    cookie = r.headers.get('set-cookie').split(';')[0];
  const v = await r.json();
  assert.equal(r.status, status, JSON.stringify(v));
  return v;
}
const { account } = await call(
  '/api/account',
  {
    action: 'signup',
    username,
    displayName: 'Moderator test',
    password: 'moderator-test-pass',
  },
  201,
);
assert.match(account.id, /^[0-9a-f-]{36}$/);
execFileSync(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'd1',
    'execute',
    'site-creator-d1',
    '--local',
    '--config',
    'work/wrangler.json',
    '--persist-to',
    '.wrangler/state',
    '--command',
    `INSERT INTO community_accounts (account_id,admin) VALUES ('${account.id}',1)`,
  ],
  { stdio: 'pipe' },
);
const g = await call(
  '/api/brackets',
  {
    title: 'Moderation search ' + username,
    entries: ['A', 'B', 'C', 'D'],
    category: 'Movies',
    settings: { visibility: 'worldwide' },
  },
  201,
);
const search =
  '/api/brackets?scope=worldwide&q=' +
  encodeURIComponent(username) +
  '&category=Movies';
assert.equal((await call(search)).brackets.length, 0);
await call('/api/community', {
  action: 'moderate',
  id: g.id,
  moderation: 'approved',
  featured: true,
  official: true,
});
assert.equal((await call(search)).brackets[0].official, true);
assert.equal((await call(search + '&sort=trending')).brackets[0].id, g.id);
await call('/api/community', {
  action: 'report',
  id: g.id,
  reason: 'Testing moderation reports',
});
const inbox = await call('/api/community');
assert.equal(inbox.admin, true);
const report = inbox.reports.find((r) => r.bracket_id === g.id);
assert.ok(report);
await call('/api/community', {
  action: 'resolve-report',
  id: g.id,
  reportId: report.id,
});
assert.ok(
  !(await call('/api/community')).reports.some((r) => r.id === report.id),
);
await call('/api/community', {
  action: 'moderate',
  id: g.id,
  moderation: 'hidden',
});
assert.equal((await call(search)).brackets.length, 0);
await call('/api/operations', { action: 'reset' }, 404);
console.log(
  'PASS: moderator approval, category search, trending, official/featured flags, reports, hiding, reset authorization.',
);
