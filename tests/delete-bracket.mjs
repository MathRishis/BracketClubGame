import assert from 'node:assert/strict';
const base = process.env.TEST_ORIGIN || 'http://localhost:3000',
  jars = new Map();
async function call(who, path, data, status = 200) {
  const jar = jars.get(who) || new Map();
  const r = await fetch(base + path, {
    method: data ? 'POST' : 'GET',
    headers: {
      Origin: base,
      'Content-Type': 'application/json',
      Cookie: [...jar].map(([k, v]) => k + '=' + v).join('; '),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  for (const c of r.headers.getSetCookie()) {
    const [k, v] = c.split(';')[0].split('=');
    jar.set(k, v);
  }
  jars.set(who, jar);
  const result = await r.json();
  assert.equal(r.status, status, JSON.stringify(result));
  return result;
}
const prefix = Date.now().toString(36);
const password = 'community-password-42';
await call(
  'owner',
  '/api/account',
  {
    action: 'signup',
    username: 'owner_' + prefix,
    displayName: 'Owner',
    password,
  },
  201,
);
await call(
  'other',
  '/api/account',
  {
    action: 'signup',
    username: 'other_' + prefix,
    displayName: 'Other',
    password,
  },
  201,
);
const create = async (who, extra = {}) =>
  call(
    who,
    '/api/brackets',
    { title: 'Community test', entries: ['A', 'B', 'C', 'D'], ...extra },
    201,
  );

const g = await create('owner', { settings: { visibility: 'worldwide' } }),
  path = '/api/brackets/' + g.id;
await call('other', path, { action: 'vote', round: 0, match: 0, pick: 0 });
await call('other', '/api/community', {
  action: 'report',
  id: g.id,
  reason: 'Delete test report',
});
await call('owner', path, { action: 'pause' });
await call('owner', path, { action: 'resume' });
await call('owner', '/api/community', {
  action: 'save-template',
  title: 'Keep kit',
  entries: ['A', 'B', 'C', 'D'],
});
await call(
  'guest',
  '/api/community',
  { action: 'delete-bracket', id: g.id },
  401,
);
await call(
  'other',
  '/api/community',
  { action: 'delete-bracket', id: g.id },
  403,
);
assert.equal((await call('owner', path)).total, 1);
await call('owner', '/api/community', { action: 'delete-bracket', id: g.id });
await call('owner', path, undefined, 404);
await call('other', path, { action: 'vote', round: 0, match: 0, pick: 0 }, 404);
assert.ok(
  !(await call('owner', '/api/account/brackets')).owned.some(
    (b) => b.id === g.id,
  ),
);
assert.ok(
  !(await call('other', '/api/account/brackets')).voted.some(
    (b) => b.id === g.id,
  ),
);
assert.ok(
  !(await call('other', '/api/community')).notifications.some(
    (n) => n.bracket_id === g.id,
  ),
);
assert.equal((await call('owner', '/api/community')).templates.length, 1);
await call(
  'owner',
  '/api/community',
  { action: 'delete-bracket', id: g.id },
  404,
);
for (const lifecycle of ['draft', 'scheduled', 'active']) {
  const g = await create('owner', {
    lifecycle,
    startsAt: Date.now() + 86400000,
  });
  await call('owner', '/api/community', { action: 'delete-bracket', id: g.id });
}
console.log(
  'PASS: creator-only deletion, unauthorized attempts, voting-link expiry, history/notification cleanup, saved kits retained, all lifecycle states.',
);
