import { database } from '@/db';
import { accountFromRequest, type Account } from '@/lib/auth';

export type Group = 'A' | 'B';
export type BracketSettings = { mode: 'everyone' | 'two_groups'; visibility: 'shared' | 'worldwide'; accent: 'lime' | 'ocean' | 'sunset' | 'plum'; deadlineEnabled: boolean; deadlineAt?: number; minVotes: number; roundHours: number; extensionHours: number };
export type Match = { a: string; b: string; ballots: Record<string, number>; winner?: string };
export type State = { rounds: Match[][]; current: number; champion?: string; settings?: BracketSettings };
export type Row = { id: string; owner: string; title: string; description: string; state: string; version: number; created_at?: number };
export class UserError extends Error { constructor(message: string, public status = 400) { super(message); } }

const defaultSettings: BracketSettings = { mode: 'everyone', visibility: 'shared', accent: 'lime', deadlineEnabled: false, minVotes: 1, roundHours: 24, extensionHours: 12 };

export function parseSettings(value: unknown): BracketSettings {
  const input = (value && typeof value === 'object' ? value : {}) as Partial<BracketSettings>;
  const settings: BracketSettings = {
    mode: input.mode === 'two_groups' ? 'two_groups' : 'everyone', visibility: input.visibility === 'worldwide' ? 'worldwide' : 'shared',
    accent: ['lime', 'ocean', 'sunset', 'plum'].includes(input.accent ?? '') ? input.accent! : 'lime', deadlineEnabled: input.deadlineEnabled === true,
    minVotes: Number.isInteger(input.minVotes) ? Math.min(10000, Math.max(1, Number(input.minVotes))) : 1,
    roundHours: Number.isFinite(input.roundHours) ? Math.min(720, Math.max(1, Number(input.roundHours))) : 24,
    extensionHours: Number.isFinite(input.extensionHours) ? Math.min(168, Math.max(1, Number(input.extensionHours))) : 12,
  };
  if (settings.deadlineEnabled) { const deadline = Number(input.deadlineAt); settings.deadlineAt = Number.isFinite(deadline) && deadline > 0 ? deadline : Date.now() + settings.roundHours * 3600000; }
  return settings;
}

function normalizeState(raw: string): State { const state = JSON.parse(raw) as State; state.settings = { ...defaultSettings, ...parseSettings(state.settings) }; return state; }

export async function identity(req: Request) {
  const account = await accountFromRequest(req);
  if (account) return { hash: `account:${account.id}`, cookie: null, account };
  const cookie = req.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('bc_player='))?.slice(10);
  const token = cookie && /^[0-9a-f-]{36}$/.test(cookie) ? cookie : crypto.randomUUID();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map((value) => value.toString(16).padStart(2, '0')).join('');
  return { hash, cookie: cookie === token ? null : `bc_player=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`, account: null as Account | null };
}
export function reply(data: unknown, status = 200, cookie: string | null = null) { const headers: Record<string, string> = { 'Cache-Control': 'no-store' }; if (cookie) headers['Set-Cookie'] = cookie; return Response.json(data, { status, headers }); }
export function failure(error: unknown) { return reply({ error: error instanceof UserError ? error.message : 'Unable to save right now. Please try again.' }, error instanceof UserError ? error.status : 500); }
export async function body(req: Request) { if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) throw new UserError('This request is not allowed.', 403); const text = await req.text(); if (text.length > 16000) throw new UserError('That request is too large.'); try { return JSON.parse(text); } catch { throw new UserError('Invalid request.'); } }

async function readRaw(id: string) { const row = await database().prepare('SELECT id,owner,title,description,state,version,created_at FROM brackets WHERE id=?').bind(id).first<Row>(); if (!row) throw new UserError('This bracket could not be found. Check your invite link.', 404); return row; }
function voterCount(matches: Match[]) { return new Set(matches.flatMap((match) => Object.keys(match.ballots))).size; }
function winners(matches: Match[]) { return matches.map((match) => { const votes = [0, 0]; Object.values(match.ballots).forEach((pick) => votes[pick]++); if (votes[0] === votes[1]) throw new UserError('Every matchup needs a winner. Invite more votes to break ties before closing this round.', 409); return votes[0] > votes[1] ? match.a : match.b; }); }
function advanceState(state: State) { const matches = state.rounds[state.current]; const selected = winners(matches); matches.forEach((match, index) => { match.winner = selected[index]; }); if (selected.length === 1) state.champion = selected[0]; else { state.rounds.push(Array.from({ length: selected.length / 2 }, (_, index) => ({ a: selected[index * 2], b: selected[index * 2 + 1], ballots: {} }))); state.current++; if (state.settings?.deadlineEnabled) state.settings.deadlineAt = Date.now() + state.settings.roundHours * 3600000; } }

export async function read(id: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await readRaw(id); const state = normalizeState(row.state); const settings = state.settings!;
    if (state.champion || !settings.deadlineEnabled || !settings.deadlineAt || settings.deadlineAt > Date.now()) return { ...row, state: JSON.stringify(state) };
    const matches = state.rounds[state.current];
    if (voterCount(matches) >= settings.minVotes) { try { advanceState(state); } catch { settings.deadlineAt = Date.now() + settings.extensionHours * 3600000; } }
    else settings.deadlineAt = Date.now() + settings.extensionHours * 3600000;
    const serialized = JSON.stringify(state); const result = await database().prepare('UPDATE brackets SET state=?,version=version+1 WHERE id=? AND version=?').bind(serialized, id, row.version).run();
    if (result.meta.changes === 1) return { ...row, state: serialized, version: row.version + 1 };
  }
  return readRaw(id);
}

function assignedGroup(viewer: string, bracketId: string): Group { let hash = 2166136261; for (const character of `${viewer}:${bracketId}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619); return (hash >>> 0) % 2 === 0 ? 'A' : 'B'; }
function matchGroup(matchCount: number, match: number): Group | null { if (matchCount <= 1) return null; return match < matchCount / 2 ? 'A' : 'B'; }

export function visible(row: Row, viewer: string) {
  const state = normalizeState(row.state); const settings = state.settings!; const viewerGroup = settings.mode === 'two_groups' ? assignedGroup(viewer, row.id) : null; let total = 0;
  const rounds = state.rounds.map((round, roundIndex) => round.map((match, matchIndex) => { const votes = [0, 0]; Object.values(match.ballots).forEach((pick) => votes[pick]++); total += votes[0] + votes[1]; const group = settings.mode === 'two_groups' ? matchGroup(round.length, matchIndex) : null; return { a: match.a, b: match.b, votes, pick: match.ballots[viewer], winner: match.winner, group, canVote: roundIndex === state.current && !state.champion && (!group || group === viewerGroup) }; }));
  const open = state.rounds[state.current]; const groupStatus = settings.mode === 'two_groups' ? (['A', 'B'] as Group[]).map((group) => ({ group, voters: voterCount(open.filter((_, index) => matchGroup(open.length, index) === group)), matchups: open.filter((_, index) => matchGroup(open.length, index) === group).length })) : [];
  return { id: row.id, title: row.title, description: row.description, current: state.current, champion: state.champion, owner: row.owner === viewer, rounds, total, settings, viewerGroup, groupStatus, createdAt: row.created_at ?? 0 };
}

export function mutate(state: State, rawInput: unknown, viewer: string, isOwner: boolean, bracketId: string) {
  const input = rawInput as { action?: unknown; round?: unknown; match?: unknown; pick?: unknown; settings?: unknown };
  state.settings = { ...defaultSettings, ...parseSettings(state.settings) };
  if (input.action === 'configure') { if (!isOwner) throw new UserError('Only the creator can change bracket settings.', 403); state.settings = parseSettings(input.settings); return state; }
  if (state.champion) throw new UserError('This bracket has already crowned a champion.', 409);
  if (input.round !== state.current) throw new UserError('The round has changed. Refresh and vote in the new round.', 409);
  const matches = state.rounds[state.current];
  if (input.action === 'vote') {
    const matchIndex = Number(input.match); const pick = Number(input.pick);
    if (!Number.isInteger(matchIndex) || !matches[matchIndex] || ![0, 1].includes(pick)) throw new UserError('Choose a valid contender.');
    const requiredGroup = state.settings.mode === 'two_groups' ? matchGroup(matches.length, matchIndex) : null; const viewerGroup = assignedGroup(viewer, bracketId);
    if (requiredGroup && requiredGroup !== viewerGroup) throw new UserError(`You are in Group ${viewerGroup}. This matchup belongs to Group ${requiredGroup}.`, 403);
    const match = matches[matchIndex]; if (Object.keys(match.ballots).length >= 5000 && match.ballots[viewer] === undefined) throw new UserError('This matchup has reached its voter limit.'); match.ballots[viewer] = pick;
  } else if (input.action === 'advance') { if (!isOwner) throw new UserError('Only the creator can close a round.', 403); advanceState(state); }
  else throw new UserError('Unknown action.');
  return state;
}

async function recordActivity(bracketId: string, viewer: string, kind: 'created' | 'voted') { if (!viewer.startsWith('account:')) return; await database().prepare(`INSERT INTO bracket_activity (bracket_id,account_id,kind,updated_at) VALUES (?,?,?,?) ON CONFLICT(bracket_id,account_id,kind) DO UPDATE SET updated_at=excluded.updated_at`).bind(bracketId, viewer.slice(8), kind, Date.now()).run(); }
export async function update(id: string, input: unknown, viewer: string) { for (let attempt = 0; attempt < 6; attempt++) { const row = await read(id); const value = input as { action?: string }; const state = mutate(normalizeState(row.state), input, viewer, row.owner === viewer, id); const serialized = JSON.stringify(state); const result = await database().prepare('UPDATE brackets SET state=?,version=version+1 WHERE id=? AND version=?').bind(serialized, id, row.version).run(); if (result.meta.changes === 1) { if (value.action === 'vote') await recordActivity(id, viewer, 'voted'); return visible({ ...row, state: serialized }, viewer); } } throw new UserError('The votes are coming in quickly. Please try again.', 409); }
export async function markCreated(bracketId: string, viewer: string) { await recordActivity(bracketId, viewer, 'created'); }
export function summary(row: Row, viewer: string) { const bracket = visible(row, viewer); return { id: bracket.id, title: bracket.title, description: bracket.description, size: bracket.rounds[0].length * 2, current: bracket.current, champion: bracket.champion, total: bracket.total, settings: bracket.settings, viewerGroup: bracket.viewerGroup, owner: bracket.owner, createdAt: bracket.createdAt }; }
