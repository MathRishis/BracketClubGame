import assert from 'node:assert/strict';

const base = process.env.TEST_ORIGIN || 'http://localhost:3000';
const cookies = new Map();
async function call(client, path, data, expected = 200) {
  const response = await fetch(base + path, {
    method: data ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookies.get(client) || '',
      Origin: base,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const cookie = response.headers.get('set-cookie');
  if (cookie) cookies.set(client, cookie.split(';')[0]);
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}

const username = `tester_${Date.now().toString(36)}`;
const signedUp = await call(
  'creator',
  '/api/account',
  {
    action: 'signup',
    username,
    displayName: 'Bracket Tester',
    password: 'correct-horse-42',
  },
  201,
);
assert.equal(signedUp.account.username, username);
const accountBracket = await call(
  'creator',
  '/api/brackets',
  {
    title: 'Worldwide split test',
    entries: Array.from({ length: 8 }, (_, index) => `Choice ${index + 1}`),
    settings: { mode: 'two_groups', visibility: 'worldwide', accent: 'ocean' },
  },
  201,
);
assert.equal(accountBracket.owner, true);
assert.ok(['A', 'B'].includes(accountBracket.viewerGroup));
const splitPath = `/api/brackets/${accountBracket.id}`;

let opposite;
for (let index = 0; index < 12; index++) {
  const view = await call(`friend-${index}`, splitPath);
  if (view.viewerGroup !== accountBracket.viewerGroup) {
    opposite = { client: `friend-${index}`, view };
    break;
  }
}
assert.ok(opposite, 'expected a voter assigned to the other group');
const ownMatch = opposite.view.rounds[0].findIndex((match) => match.canVote);
const otherMatch = opposite.view.rounds[0].findIndex((match) => !match.canVote);
await call(
  opposite.client,
  splitPath,
  { action: 'vote', round: 0, match: otherMatch, pick: 0 },
  403,
);
const voted = await call(opposite.client, splitPath, {
  action: 'vote',
  round: 0,
  match: ownMatch,
  pick: 0,
});
assert.equal(voted.rounds[0][ownMatch].votes[0], 1);
assert.ok(voted.rounds[0][otherMatch].group);

const worldwide = await call('browser', '/api/brackets?scope=worldwide');
assert.ok(
  !worldwide.brackets.some((bracket) => bracket.id === accountBracket.id),
  'Worldwide submission must wait for admin approval',
);
const voterName = `voter_${Date.now().toString(36)}`;
await call(
  'account-voter',
  '/api/account',
  {
    action: 'signup',
    username: voterName,
    displayName: 'Voting Tester',
    password: 'another-safe-pass',
  },
  201,
);
const voterView = await call('account-voter', splitPath);
const voterMatch = voterView.rounds[0].findIndex((match) => match.canVote);
await call('account-voter', splitPath, {
  action: 'vote',
  round: 0,
  match: voterMatch,
  pick: 1,
});
const voteHistory = await call('account-voter', '/api/account/brackets');
assert.ok(
  voteHistory.voted.some((bracket) => bracket.id === accountBracket.id),
);
const history = await call('creator', '/api/account/brackets');
assert.ok(history.owned.some((bracket) => bracket.id === accountBracket.id));
await call('creator', '/api/account', { action: 'logout' });
await call('creator-login', '/api/account', {
  action: 'login',
  username,
  password: 'correct-horse-42',
});
const restored = await call('creator-login', '/api/account/brackets');
assert.ok(restored.owned.some((bracket) => bracket.id === accountBracket.id));

const timed = await call(
  'timer',
  '/api/brackets',
  {
    title: 'Timed bracket',
    entries: ['A', 'B', 'C', 'D'],
    settings: {
      deadlineEnabled: true,
      deadlineAt: Date.now() - 1000,
      minVotes: 2,
      roundHours: 1,
      extensionHours: 1,
    },
  },
  201,
);
const timedPath = `/api/brackets/${timed.id}`;
const extended = await call('timer', timedPath);
assert.equal(extended.current, 0);
assert.ok(extended.settings.deadlineAt > Date.now());
await call('timer-voter', timedPath, {
  action: 'vote',
  round: 0,
  match: 0,
  pick: 0,
});
await call('timer-voter', timedPath, {
  action: 'vote',
  round: 0,
  match: 1,
  pick: 0,
});
await call('timer', timedPath, {
  action: 'configure',
  settings: {
    deadlineEnabled: true,
    deadlineAt: Date.now() - 1000,
    minVotes: 1,
    roundHours: 1,
    extensionHours: 1,
  },
});
const advanced = await call('timer', timedPath);
assert.equal(advanced.current, 1);
assert.ok(advanced.settings.deadlineAt > Date.now());

console.log(
  'PASS: accounts, durable ownership, two-group vote enforcement, worldwide discovery, settings, deadline extension, and automatic advancement.',
);
