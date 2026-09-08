'use client';
import { useEffect, useState } from 'react';
import {
  api,
  EntryEditor,
  type EntryDetails,
} from '@/components/community-controls';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import type { BracketView } from '@/components/bracket-board';
type Summary = BracketView & { size: number };
export default function Dashboard() {
  const [deleting, setDeleting] = useState<Summary | null>(null);
  const [deleteError, setDeleteError] = useState('');
  async function deleteBracket() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError('');
    try {
      await api('/api/community', {
        action: 'delete-bracket',
        id: deleting.id,
      });
      if (editing?.id === deleting.id) setEditing(null);
      setDeleting(null);
      setMessage('Bracket deleted. Its invite link is no longer available.');
      await load();
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const [data, setData] = useState<any>(null),
    [owned, setOwned] = useState<Summary[]>([]),
    [voted, setVoted] = useState<Summary[]>([]),
    [filter, setFilter] = useState('all'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [sessions, setSessions] = useState<any[]>([]),
    [password, setPassword] = useState(''),
    [nextPassword, setNextPassword] = useState(''),
    [bio, setBio] = useState(''),
    [editing, setEditing] = useState<BracketView | null>(null),
    [entries, setEntries] = useState<string[]>([]),
    [details, setDetails] = useState<EntryDetails[]>([]),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [category, setCategory] = useState('Other'),
    [schedule, setSchedule] = useState(''),
    [deleteConfirm, setDeleteConfirm] = useState('');
  async function load() {
    try {
      const [community, list] = await Promise.all([
        api('/api/community'),
        api('/api/account/brackets'),
      ]);
      setData(community);
      setBio(community.profile?.bio ?? '');
      setOwned(list.owned);
      setVoted(list.voted);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function act(path: string, input: unknown) {
    setBusy(true);
    try {
      const r = await api(path, input);
      setMessage(
        r.claimed !== undefined
          ? `Claimed ${r.claimed} brackets. ${r.skipped} skipped because this account already participated.`
          : 'Saved.',
      );
      await load();
      return r;
    } catch (e) {
      setMessage((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function edit(id: string) {
    try {
      const g = await api('/api/brackets/' + id);
      setEditing(g);
      setTitle(g.title);
      setDescription(g.description);
      setCategory(g.category);
      setEntries(g.rounds[0].flatMap((m: any) => [m.a, m.b]));
      setDetails(g.contenders ?? []);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          bracket<span className="brand-light">club</span>
        </a>
        <nav className="top-actions">
          <a href="/">Create & discover</a>
          <a href="/help">Help</a>
        </nav>
      </header>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete this bracket?</AlertDialogTitle>
          <AlertDialogDescription>
            “{deleting?.title}” and all its votes, results, and related
            notifications will be permanently removed. Its invite link will stop
            working. Saved kits are kept. This cannot be undone.
          </AlertDialogDescription>
          {deleteError && <p role="alert">{deleteError}</p>}
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setDeleting(null)}
          >
            Keep bracket
          </button>
          <button
            className="primary delete-bracket"
            disabled={busy}
            onClick={deleteBracket}
          >
            {busy ? 'Deleting…' : 'Permanently delete bracket'}
          </button>
        </AlertDialogContent>
      </AlertDialog>
      <main className="community-main">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Your club headquarters</span>
            <h1>Creator dashboard</h1>
            <p>Every debate, from the first draft to the final vote.</p>
          </div>
          <a className="primary" href="/">
            + New bracket
          </a>
        </div>
        {message && (
          <output className="notice" role="status">
            {message}
          </output>
        )}
        {!data ? (
          <p>
            Sign in from <a href="/">the home page</a> to manage your brackets.
          </p>
        ) : (
          <>
            <div className="dashboard-stats">
              {['draft', 'scheduled', 'active', 'paused', 'completed'].map(
                (status) => (
                  <button key={status} onClick={() => setFilter(status)}>
                    <strong>
                      {owned.filter((b) => b.lifecycle === status).length}
                    </strong>
                    <span>{status}</span>
                  </button>
                ),
              )}
            </div>
            <section className="community-section">
              <div className="section-heading">
                <h2>Your brackets</h2>
                <select
                  aria-label="Filter brackets"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {[
                    'all',
                    'draft',
                    'scheduled',
                    'active',
                    'paused',
                    'completed',
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="dashboard-grid">
                {owned
                  .filter((b) => filter === 'all' || b.lifecycle === filter)
                  .map((b) => (
                    <article className="dashboard-card" key={b.id}>
                      <span className="eyebrow">
                        {b.lifecycle} ·{' '}
                        {b.settings.visibility === 'worldwide'
                          ? b.moderation
                          : 'Invite only'}
                      </span>
                      <h3>
                        <a href={`/?b=${b.id}`}>{b.title}</a>
                      </h3>
                      <p>
                        {b.total} votes · {b.participants ?? 0} current
                        participants
                      </p>
                      {b.groupStatus?.map((g) => (
                        <small key={g.group}>
                          Group {g.group}: {g.voters} voters ·{' '}
                        </small>
                      ))}
                      {b.settings.deadlineAt && (
                        <p>
                          Deadline:{' '}
                          {new Date(b.settings.deadlineAt).toLocaleString()}
                        </p>
                      )}
                      <div className="button-row">
                        <button
                          className="secondary"
                          onClick={() => edit(b.id)}
                        >
                          Edit
                        </button>
                        <a className="secondary" href={`/?copy=${b.id}`}>
                          Duplicate
                        </a>
                        <button
                          className="secondary delete-bracket"
                          disabled={busy}
                          onClick={() => {
                            setDeleting(b);
                            setDeleteError('');
                          }}
                        >
                          Delete bracket
                        </button>
                        {!b.champion && (
                          <button
                            disabled={busy}
                            className="secondary"
                            onClick={() =>
                              act('/api/brackets/' + b.id, {
                                action:
                                  b.lifecycle === 'active'
                                    ? 'pause'
                                    : b.lifecycle === 'paused'
                                      ? 'resume'
                                      : 'launch',
                              })
                            }
                          >
                            {b.lifecycle === 'active'
                              ? 'Pause'
                              : b.lifecycle === 'paused'
                                ? 'Resume'
                                : 'Launch now'}
                          </button>
                        )}
                        {['active', 'paused'].includes(b.lifecycle ?? '') &&
                          !b.champion && (
                            <button
                              disabled={busy}
                              className="secondary"
                              onClick={() => {
                                if (
                                  confirm(
                                    'End this round and advance its winners? This cannot be undone.',
                                  )
                                )
                                  void act('/api/brackets/' + b.id, {
                                    action: 'advance',
                                    round: b.current,
                                  });
                              }}
                            >
                              Advance round
                            </button>
                          )}
                      </div>
                    </article>
                  ))}
              </div>
              {!owned.length && (
                <p>
                  No brackets yet. Create your first debate or save a draft.
                </p>
              )}
            </section>
            {editing && (
              <section className="community-section edit-panel">
                <h2>Edit {editing.title}</h2>
                <label>
                  Title
                  <input
                    value={title}
                    maxLength={80}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={description}
                    maxLength={200}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <label>
                  Category
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {[
                      'Other',
                      'Movies',
                      'TV',
                      'Games',
                      'Sports',
                      'Music',
                      'Food',
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                {editing.total === 0 ? (
                  <EntryEditor
                    entries={entries}
                    setEntries={setEntries}
                    details={details}
                    setDetails={setDetails}
                  />
                ) : (
                  <p>Contenders are locked because voting has begun.</p>
                )}
                <div className="button-row">
                  <button
                    disabled={busy}
                    className="primary"
                    onClick={async () => {
                      if (
                        await act('/api/community', {
                          action: 'edit',
                          id: editing.id,
                          title,
                          description,
                          category,
                          ...(editing.total === 0
                            ? { entries, contenders: details }
                            : {}),
                        })
                      )
                        setEditing(null);
                    }}
                  >
                    Save edits
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                </div>
                {!editing.champion && (
                  <>
                    <label>
                      Schedule or reschedule opening
                      <input
                        type="datetime-local"
                        value={schedule}
                        onChange={(e) => setSchedule(e.target.value)}
                      />
                    </label>
                    <button
                      disabled={busy}
                      className="secondary"
                      onClick={() =>
                        act('/api/brackets/' + editing.id, {
                          action: 'schedule',
                          startsAt: new Date(schedule).getTime(),
                        })
                      }
                    >
                      Save opening time
                    </button>
                    <p>
                      Opening times and round deadlines are checked when the
                      bracket is accessed. Change round deadlines using Manage
                      rules in the voting room.
                    </p>
                  </>
                )}
              </section>
            )}
            <section className="community-section">
              <h2>Your voting history</h2>
              {voted.length ? (
                voted.map((b) => (
                  <a
                    className="account-bracket"
                    key={b.id}
                    href={`/?b=${b.id}`}
                  >
                    <strong>{b.title}</strong>
                    <span>View your picks →</span>
                  </a>
                ))
              ) : (
                <p>No votes yet.</p>
              )}
              <button
                className="secondary"
                disabled={busy}
                onClick={() => act('/api/community', { action: 'claim' })}
              >
                Claim this browser’s guest brackets & votes
              </button>
              <p>
                Existing account participation wins: brackets where you already
                voted are skipped. Your guest group is preserved when claimed.
              </p>
            </section>
            <section className="community-section">
              <div className="section-heading">
                <h2>Inbox</h2>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => act('/api/community', { action: 'seen' })}
                >
                  Mark all read
                </button>
              </div>
              <p>
                Notifications update when brackets are accessed. Email reminders
                are not enabled.
              </p>
              {data.notifications.length ? (
                data.notifications.map((n: any) => (
                  <a
                    className={`inbox-item ${n.seen ? '' : 'unread'}`}
                    href={`/?b=${n.bracket_id}`}
                    key={n.id}
                  >
                    <span>{n.message}</span>
                    <small>{new Date(n.created_at).toLocaleString()}</small>
                  </a>
                ))
              ) : (
                <p>You’re all caught up.</p>
              )}
            </section>
            <section className="community-section">
              <h2>Your saved kits</h2>
              {data.templates.length ? (
                data.templates.map((t: any) => (
                  <div className="account-bracket" key={t.id}>
                    <a href={`/?template=${t.id}`}>{t.title} →</a>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        act('/api/community', {
                          action: 'delete-template',
                          id: t.id,
                        })
                      }
                    >
                      Delete kit
                    </button>
                  </div>
                ))
              ) : (
                <p>Save a kit from the bracket builder to use it again.</p>
              )}
            </section>
            {data.admin && (
              <section className="community-section">
                <h2>Worldwide moderation</h2>
                {data.review.map((b: any) => (
                  <article className="dashboard-card" key={b.id}>
                    <h3>
                      <a href={`/?b=${b.id}`}>{b.title}</a>
                    </h3>
                    <p>
                      {b.moderation}
                      {b.featured ? ' · Featured' : ''}
                      {b.official ? ' · Official' : ''}
                    </p>
                    <div className="button-row">
                      {['approved', 'hidden', 'pending'].map((m) => (
                        <button
                          className="secondary"
                          disabled={busy}
                          key={m}
                          onClick={() =>
                            act('/api/community', {
                              action: 'moderate',
                              id: b.id,
                              moderation: m,
                              featured: b.featured,
                              official: b.official,
                            })
                          }
                        >
                          {m === 'approved'
                            ? 'Approve'
                            : m === 'hidden'
                              ? 'Hide'
                              : 'Pending'}
                        </button>
                      ))}
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          act('/api/community', {
                            action: 'moderate',
                            id: b.id,
                            moderation: b.moderation,
                            featured: !b.featured,
                            official: b.official,
                          })
                        }
                      >
                        Toggle featured
                      </button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          act('/api/community', {
                            action: 'moderate',
                            id: b.id,
                            moderation: b.moderation,
                            featured: b.featured,
                            official: !b.official,
                          })
                        }
                      >
                        Toggle official
                      </button>
                    </div>
                  </article>
                ))}
                <h3>Reports</h3>
                {data.reports.map((r: any) => (
                  <div className="dashboard-card" key={r.id}>
                    <a href={`/?b=${r.bracket_id}`}>Open reported bracket</a>
                    <p>{r.reason}</p>
                    <button
                      className="secondary"
                      onClick={() =>
                        act('/api/community', {
                          action: 'resolve-report',
                          id: r.bracket_id,
                          reportId: r.id,
                        })
                      }
                    >
                      Resolve
                    </button>
                  </div>
                ))}
              </section>
            )}
            <section className="community-section account-settings">
              <h2>Account settings</h2>
              <label>
                Public profile bio
                <textarea
                  value={bio}
                  maxLength={280}
                  onChange={(e) => setBio(e.target.value)}
                />
              </label>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  act('/api/community', { action: 'profile', bio })
                }
              >
                Save bio
              </button>
              <h3>Sessions</h3>
              <button
                className="secondary"
                onClick={async () => {
                  const r = await act('/api/community', { action: 'sessions' });
                  if (r) setSessions(r.sessions);
                }}
              >
                View signed-in sessions
              </button>
              {sessions.map((s) => (
                <div className="account-bracket" key={s.id}>
                  <span>
                    {s.current ? 'This session' : 'Other session'} · expires{' '}
                    {new Date(s.expiresAt).toLocaleDateString()}
                  </span>
                  <button
                    className="secondary"
                    onClick={async () => {
                      if (
                        await act('/api/community', {
                          action: 'revoke',
                          id: s.id,
                        })
                      ) {
                        setSessions(sessions.filter((x) => x.id !== s.id));
                        if (s.current) location.href = '/';
                      }
                    }}
                  >
                    Sign out session
                  </button>
                </div>
              ))}
              <h3>Change password</h3>
              <label>
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={nextPassword}
                  onChange={(e) => setNextPassword(e.target.value)}
                />
              </label>
              <button
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  if (
                    await act('/api/community', {
                      action: 'password',
                      password,
                      nextPassword,
                    })
                  ) {
                    setPassword('');
                    setNextPassword('');
                  }
                }}
              >
                Change password & sign out other sessions
              </button>
              <details className="danger-zone">
                <summary>Delete account</summary>
                <p>
                  This permanently removes your account and saved kits. Your
                  votes remain anonymous and your brackets lose their account
                  owner. Enter your current password above and type DELETE
                  below.
                </p>
                <input
                  aria-label="Type DELETE to confirm"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                />
                <button
                  className="secondary"
                  disabled={busy || deleteConfirm !== 'DELETE'}
                  onClick={async () => {
                    if (
                      await act('/api/community', {
                        action: 'delete-account',
                        password,
                      })
                    )
                      location.href = '/';
                  }}
                >
                  Permanently delete account
                </button>
              </details>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
