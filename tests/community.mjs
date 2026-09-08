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
const d = await create('owner', { lifecycle: 'draft' }),
  path = '/api/brackets/' + d.id;
assert.equal(d.lifecycle, 'draft');
await call('other', path, { action: 'launch' }, 403);
await call('owner', path, { action: 'vote', round: 0, match: 0, pick: 0 }, 409);
await call('owner', '/api/community', {
  action: 'edit',
  id: d.id,
  title: 'Edited draft',
  description: 'Context',
  category: 'Movies',
  entries: ['E', 'F', 'G', 'H'],
  contenders: [{ image: 'https://example.com/a.jpg', description: 'Details' }],
});
await call('owner', path, { action: 'launch' });
await call('owner', path, { action: 'vote', round: 0, match: 0, pick: 0 });
await call(
  'owner',
  '/api/community',
  { action: 'edit', id: d.id, title: 'Locked', entries: ['I', 'J', 'K', 'L'] },
  409,
);
await call(
  'owner',
  path,
  { action: 'configure', settings: { mode: 'two_groups' } },
  409,
);
await call('owner', path, { action: 'pause' });
await call('other', path, { action: 'vote', round: 0, match: 1, pick: 0 }, 409);
await call('owner', path, { action: 'resume' });
await call('owner', path, { action: 'configure', settings: { minVotes: 2 } });
await call('owner', path, { action: 'vote', round: 0, match: 1, pick: 0 });
await call('other', path, { action: 'vote', round: 0, match: 0, pick: 0 });
await call('owner', path, { action: 'advance', round: 0 }, 409);
await call('other', path, { action: 'vote', round: 0, match: 1, pick: 0 });
await call('owner', path, { action: 'advance', round: 0 });
const before = await call('owner', '/api/community');
await call('owner', path);
await call('owner', path);
const after = await call('owner', '/api/community');
assert.equal(
  before.notifications.length,
  after.notifications.length,
  'notifications deduplicated',
);
assert.equal(after.admin, false);
await call(
  'other',
  '/api/community',
  { action: 'moderate', id: d.id, moderation: 'approved' },
  403,
);
await call('owner', '/api/community', {
  action: 'save-template',
  title: 'Reusable',
  entries: ['A', 'B', 'C', 'D'],
});
assert.equal((await call('owner', '/api/community')).templates.length, 1);
await call(
  'owner',
  '/api/community',
  { action: 'save-template', title: 'Bad', entries: ['A', 'A', 'C', 'D'] },
  400,
);
const guest = await create('guest', { settings: { mode: 'two_groups' } });
const gp = '/api/brackets/' + guest.id;
const m = guest.rounds[0].findIndex((m) => m.canVote);
await call('guest', gp, { action: 'vote', round: 0, match: m, pick: 0 });
await call(
  'guest',
  '/api/account',
  {
    action: 'signup',
    username: 'claim_' + prefix,
    displayName: 'Claim',
    password,
  },
  201,
);
const claimed = await call('guest', '/api/community', { action: 'claim' });
assert.equal(claimed.claimed, 1);
const gv = await call('guest', gp);
assert.equal(gv.total, 1);
assert.equal(gv.viewerGroup, guest.viewerGroup);
assert.equal(gv.rounds[0][m].pick, 0);
assert.equal(gv.owner, true);
assert.equal(
  (await call('guest', '/api/community', { action: 'claim' })).claimed,
  0,
);
await call('second', '/api/account', {
  action: 'login',
  username: 'owner_' + prefix,
  password,
});
const sessions = await call('owner', '/api/community', { action: 'sessions' });
assert.equal(sessions.sessions.length, 2);
await call(
  'owner',
  '/api/community',
  { action: 'password', password: 'wrong', nextPassword: 'new-password' },
  403,
);
await call('owner', '/api/community', {
  action: 'password',
  password,
  nextPassword: 'new-password-42',
});
assert.equal((await call('second', '/api/account')).account, null);
await call('guest', '/api/community', { action: 'delete-account', password });
assert.equal((await call('guest', '/api/account')).account, null);
const anon = await call('observer', gp);
assert.equal(anon.total, 1);
assert.equal(anon.owner, false);
assert.equal(anon.creatorId, null);
const schedule = await create('owner', {
  lifecycle: 'scheduled',
  startsAt: Date.now() + 300,
});
await new Promise((r) => setTimeout(r, 350));
assert.equal(
  (await call('owner', '/api/brackets/' + schedule.id)).lifecycle,
  'active',
);
console.log(
  'PASS: drafts, editing locks, lifecycle permissions, per-match thresholds, notifications, templates, anonymous claiming, group preservation, password rotation, sessions, account deletion, scheduling.',
);
