import { contenders, maintenance, text } from '@/lib/community';
import { database } from '@/db';
import {
  identity,
  body,
  reply,
  failure,
  UserError,
  visible,
  parseSettings,
  markCreated,
  read,
  summary,
  type Row,
} from '@/lib/brackets';

export async function GET(req: Request) {
  try {
    const user = await identity(req);
    if (new URL(req.url).searchParams.get('scope') !== 'worldwide')
      throw new UserError('Unknown bracket list.', 404);
    const params = new URL(req.url).searchParams;
    const q = (params.get('q') ?? '').slice(0, 100);
    const category = (params.get('category') ?? '').slice(0, 40);
    const sort = params.get('sort');
    const offset = Math.max(
      0,
      Math.min(10000, Math.floor(Number(params.get('offset'))) || 0),
    );
    const result = await database()
      .prepare(
        `SELECT b.id FROM brackets b WHERE json_extract(state,'$.settings.visibility')='worldwide' AND json_extract(state,'$.moderation')='approved' AND COALESCE(json_extract(state,'$.lifecycle'),'active')<>'draft' AND (instr(lower(title),lower(?))>0 OR instr(lower(description),lower(?))>0) AND (?='' OR json_extract(state,'$.category')=?) ORDER BY COALESCE(json_extract(state,'$.featured'),0) DESC, ${sort === 'trending' ? '(SELECT COUNT(DISTINCT viewer) FROM participation WHERE bracket_id=b.id AND updated_at>' + (Date.now() - 7 * 86400000) + ') DESC' : sort === 'ending' ? "COALESCE(json_extract(state,'$.settings.deadlineAt'),9999999999999) ASC" : 'created_at DESC'} LIMIT 24 OFFSET ?`,
      )
      .bind(q, q, category, category, offset)
      .all<{ id: string }>();
    const rows = await Promise.all(result.results.map((item) => read(item.id)));
    return reply(
      { brackets: rows.map((row) => summary(row, user.hash)) },
      200,
      user.cookie,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: Request) {
  try {
    await maintenance();
    const input = await body(req);
    if (!input || typeof input !== 'object')
      throw new UserError('Invalid bracket.');
    const {
      title,
      description = '',
      entries,
    } = input as {
      title?: unknown;
      description?: unknown;
      entries?: unknown;
      settings?: unknown;
    };
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 80)
      throw new UserError('Add a title of up to 80 characters.');
    if (typeof description !== 'string' || description.length > 200)
      throw new UserError('Keep the description under 200 characters.');
    if (
      !Array.isArray(entries) ||
      ![4, 8, 16, 32].includes(entries.length) ||
      entries.some(
        (entry) =>
          typeof entry !== 'string' ||
          !entry.trim() ||
          entry.trim().length > 60,
      )
    )
      throw new UserError(
        'Add 4, 8, 16, or 32 contenders with names under 60 characters.',
      );
    const names = entries.map((entry: string) => entry.trim());
    if (
      new Set(names.map((name: string) => name.toLowerCase())).size !==
      names.length
    )
      throw new UserError('Each contender needs a different name.');
    const user = await identity(req);
    const id = crypto.randomUUID();
    const settings = parseSettings((input as { settings?: unknown }).settings);
    if (settings.visibility === 'worldwide' && !user.account)
      throw new UserError(
        'Sign in before publishing a worldwide bracket.',
        401,
      );
    if (
      input.lifecycle === 'scheduled' &&
      (!Number.isFinite(Number(input.startsAt)) ||
        Number(input.startsAt) <= Date.now())
    )
      throw new UserError('Choose a future start time.');
    const state = JSON.stringify({
      rounds: [
        Array.from({ length: names.length / 2 }, (_, index) => ({
          a: names[index * 2],
          b: names[index * 2 + 1],
          ballots: {},
        })),
      ],
      current: 0,
      settings,
      contenders: contenders(input.contenders, names),
      lifecycle:
        input.lifecycle === 'draft'
          ? 'draft'
          : input.lifecycle === 'scheduled'
            ? 'scheduled'
            : 'active',
      startsAt: Number(input.startsAt) || undefined,
      category: text(input.category, 40) || 'Other',
      moderation: 'pending',
    });
    const row: Row = {
      id,
      owner: user.hash,
      title: title.trim(),
      description: description.trim(),
      state,
      version: 0,
      created_at: Date.now(),
    };
    await database()
      .prepare(
        'INSERT INTO brackets (id,owner,title,description,state,version,created_at) VALUES (?,?,?,?,?,0,?)',
      )
      .bind(id, user.hash, row.title, row.description, state, row.created_at)
      .run();
    await markCreated(id, user.hash);
    return reply(visible(row, user.hash), 201, user.cookie);
  } catch (error) {
    return failure(error);
  }
}
