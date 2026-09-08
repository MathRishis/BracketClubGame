import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Help & instructions — Bracket Club',
  description:
    'Learn how to create brackets, invite friends, vote in groups, and manage rounds.',
};
const sections = [
  [
    'Create your bracket',
    'Choose 4, 8, 16, or 32 contenders. Start with a built-in kit, load one of your saved kits, paste one name per line, or import CSV with name, image URL, description, and link columns. Give every contender a unique name. Move entries up or down to set seeds; neighboring entries meet first. For 32 entries, the first 16 begin on the left and the remaining 16 on the right.',
  ],
  [
    'Drafts, kits & copies',
    'Sign in to save drafts and reusable kits in your dashboard. Drafts do not accept votes. Launch a draft immediately or set an opening time. Duplicate a bracket to reuse its contenders and appearance with fresh votes and results. Edit contender details before the first vote; names and voting format then lock. Metadata edits on approved worldwide brackets return them to review. To permanently remove a bracket, choose Delete bracket under Your brackets in the creator dashboard and confirm. This removes all votes and results and disables the invite link; saved kits are kept.',
  ],
  [
    'Invite friends & vote',
    'Create a bracket and copy its invite link. Guests can vote without an account. Sign in to save participation across devices. Choose one contender per matchup; you can change your pick until the round ends. Refreshes happen automatically. Phones show one round at a time, with side selectors for large or two-group brackets. Round navigation changes only your view.',
  ],
  [
    'Two groups',
    'Players are assigned a stable group for each bracket. Group A votes on one half and Group B on the other. Everyone sees both groups’ progress, but the server blocks votes on the opposite side. Both groups vote in the final. Groups are assigned independently, so their sizes may differ. Sharing a side link never changes someone’s group.',
  ],
  [
    'Rounds, ties & deadlines',
    'Every matchup must reach the host’s minimum vote count and have a clear winner before advancing. A tie needs more votes. Hosts can close a ready round from the voting room or dashboard; advancement cannot be undone. A due round extends by the configured interval when any matchup falls short or ties. The reason appears in the voting room.',
  ],
  [
    'Scheduling limitation',
    'Opening times, deadline advancement, extensions, and approaching-deadline notices are evaluated when the bracket is accessed. They do not currently run in the background with no visitors. Countdown times are shown in your device’s local time. Pause stops voting and deadline processing; resume starts a fresh round-length deadline when deadlines are enabled.',
  ],
  [
    'Accounts & guest participation',
    'Your dashboard lists created brackets and voting history. Claim this browser’s guest participation explicitly to transfer it to your account while preserving its group. Brackets where your account already voted are skipped to avoid duplicate participation. Account settings let you edit your public bio, change your password, and revoke sessions. Password changes sign out other sessions. Email recovery and Google login are not available yet, so keep your password secure.',
  ],
  [
    'Worldwide brackets & moderation',
    'Choose Worldwide to request a public listing. An administrator must approve it before it appears in discovery. Search by title, filter by category, or sort by newest, ending soon, or recent distinct voters. Featured brackets appear first. Only an administrator can feature, hide, or mark a bracket official. Sign in to report inappropriate brackets from their voting rooms. Shared invite links remain separate from worldwide listings.',
  ],
  [
    'Notifications & sharing',
    'Your dashboard inbox records round openings, extensions, advancement, champions, and approaching deadlines when brackets are accessed. Mark messages read after reviewing them. You can share the current round and side or download a champion card. Email and push notifications are not enabled.',
  ],
  [
    'Account deletion & fresh start',
    'Deleting your account removes your sessions, profile, saved kits, and personal activity. Existing votes are anonymized and brackets lose their account owner. The launch fresh start removes all old accounts and brackets; old invite links no longer work. Create a new account to begin again.',
  ],
];
export default function Help() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          bracket<span className="brand-light">club</span>
        </a>
        <nav className="top-actions">
          <a href="/">Create & discover</a>
          <a href="/dashboard">Dashboard</a>
        </nav>
      </header>
      <main className="community-main help-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">The club handbook</span>
            <h1>Good debates start here.</h1>
            <p>Everything you need to create, play, and run your bracket.</p>
          </div>
        </div>
        <nav className="help-index" aria-label="Help topics">
          {sections.map(([title], i) => (
            <a key={title} href={`#topic-${i}`}>
              {title}
            </a>
          ))}
        </nav>
        {sections.map(([title, body], i) => (
          <section className="community-section" id={`topic-${i}`} key={title}>
            <span className="eyebrow">{String(i + 1).padStart(2, '0')}</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
        <a className="primary" href="/">
          Create a bracket →
        </a>
      </main>
    </div>
  );
}
