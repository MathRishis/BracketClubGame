import { database } from '@/db';

export type Account = { id: string; username: string; displayName: string };
type AccountRow = { id: string; username: string; display_name: string; password_hash: string; password_salt: string };

const encoder = new TextEncoder();
const SESSION_AGE = 60 * 60 * 24 * 30;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function digest(value: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 210000 }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

function sessionToken(req: Request) {
  return req.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('bc_session='))?.slice(11) ?? null;
}

export async function accountFromRequest(req: Request): Promise<Account | null> {
  const token = sessionToken(req);
  if (!token || !/^[0-9a-f-]{36}$/.test(token)) return null;
  const row = await database().prepare(`SELECT a.id,a.username,a.display_name FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?`).bind(await digest(token), Date.now()).first<{ id: string; username: string; display_name: string }>();
  return row ? { id: row.id, username: row.username, displayName: row.display_name } : null;
}

function validateAccountInput(input: unknown) {
  const value = input as { username?: unknown; password?: unknown; displayName?: unknown };
  const username = typeof value?.username === 'string' ? value.username.trim().toLowerCase() : '';
  const password = typeof value?.password === 'string' ? value.password : '';
  const displayName = typeof value?.displayName === 'string' ? value.displayName.trim() : username;
  if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new Error('Username must be 3–24 letters, numbers, or underscores.');
  if (password.length < 8 || password.length > 100) throw new Error('Password must be between 8 and 100 characters.');
  if (!displayName || displayName.length > 40) throw new Error('Display name must be 1–40 characters.');
  return { username, password, displayName };
}

async function makeSession(accountId: string, secure: boolean) {
  const token = crypto.randomUUID();
  await database().prepare('INSERT INTO sessions (token_hash,account_id,expires_at) VALUES (?,?,?)').bind(await digest(token), accountId, Date.now() + SESSION_AGE * 1000).run();
  return `bc_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_AGE}${secure ? '; Secure' : ''}`;
}

export async function signup(req: Request, input: unknown) {
  const { username, password, displayName } = validateAccountInput(input);
  const existing = await database().prepare('SELECT id FROM accounts WHERE username=?').bind(username).first();
  if (existing) throw new Error('That username is already taken.');
  const id = crypto.randomUUID();
  const salt = crypto.randomUUID();
  await database().prepare('INSERT INTO accounts (id,username,display_name,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?)').bind(id, username, displayName, await passwordHash(password, salt), salt, Date.now()).run();
  return { account: { id, username, displayName }, cookie: await makeSession(id, new URL(req.url).protocol === 'https:') };
}

export async function login(req: Request, input: unknown) {
  const { username, password } = validateAccountInput({ ...(input as object), displayName: usernameFrom(input) });
  const row = await database().prepare('SELECT id,username,display_name,password_hash,password_salt FROM accounts WHERE username=?').bind(username).first<AccountRow>();
  if (!row || await passwordHash(password, row.password_salt) !== row.password_hash) throw new Error('Incorrect username or password.');
  return { account: { id: row.id, username: row.username, displayName: row.display_name }, cookie: await makeSession(row.id, new URL(req.url).protocol === 'https:') };
}

function usernameFrom(input: unknown) {
  const value = input as { username?: unknown };
  return typeof value?.username === 'string' ? value.username : '';
}

export async function logout(req: Request) {
  const token = sessionToken(req);
  if (token) await database().prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
  return `bc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
}
