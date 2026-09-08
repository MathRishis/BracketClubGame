import { database } from '@/db';
import { summary, type Row } from '@/lib/brackets';
export const dynamic = 'force-dynamic';
export default async function Creator({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = await database()
    .prepare(
      'SELECT a.display_name,a.username,c.bio FROM accounts a LEFT JOIN community_accounts c ON c.account_id=a.id WHERE a.id=?',
    )
    .bind(id)
    .first<{ display_name: string; username: string; bio: string }>();
  if (!a)
    return (
      <main className="community-main">
        <h1>Creator unavailable</h1>
        <a href="/">Back to Bracket Club</a>
      </main>
    );
  const rows = await database()
    .prepare(
      "SELECT * FROM brackets WHERE owner=? AND json_extract(state,'$.settings.visibility')='worldwide' AND json_extract(state,'$.moderation')='approved' AND COALESCE(json_extract(state,'$.lifecycle'),'active')<>'draft'",
    )
    .bind('account:' + id)
    .all<Row>();
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          bracketclub
        </a>
        <a href="/help">Help</a>
      </header>
      <main className="community-main">
        <span className="eyebrow">Creator profile · @{a.username}</span>
        <h1>{a.display_name}</h1>
        <p>{a.bio || 'A member of the club.'}</p>
        <div className="dashboard-grid">
          {rows.results.map((row) => {
            const b = summary(row, '');
            return (
              <a className="dashboard-card" key={b.id} href={`/?b=${b.id}`}>
                <span className="eyebrow">
                  {b.official ? 'Official · ' : ''}
                  {b.featured ? 'Featured · ' : ''}
                  {b.category}
                </span>
                <h2>{b.title}</h2>
                <p>{b.description}</p>
                <span>{b.total} votes →</span>
              </a>
            );
          })}
        </div>
        {!rows.results.length && <p>No public brackets yet.</p>}
      </main>
    </div>
  );
}
