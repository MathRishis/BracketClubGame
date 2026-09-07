'use client';
/* oxlint-disable next/no-html-link-for-pages */

import { useEffect, useState } from 'react';
import { ArrowRight, Clock3, GitFork, Globe2, Link2, LockKeyhole, Plus, Settings2, Shuffle, UserRound, Users } from 'lucide-react';
import { BracketBoard, type BracketView, roundName } from '@/components/bracket-board';
import { AccountPanel, type AccountView } from '@/components/account-panel';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { starterKits } from '@/lib/starter-kits';

const examples = ['The Office', 'Friends', 'Brooklyn Nine-Nine', 'Parks and Recreation', 'Seinfeld', 'Modern Family', 'Community', 'New Girl'];
type BracketSummary = { id: string; title: string; description: string; size: number; current: number; champion?: string; total: number; settings: BracketView['settings']; viewerGroup?: 'A' | 'B' | null };

async function requestBracket(path: string, data?: unknown) {
  const response = await fetch(path, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
  const result = await response.json() as BracketView & { error?: string };
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}

export default function Home() {
  const [title, setTitle] = useState('The ultimate sitcom showdown');
  const [description, setDescription] = useState('Eight iconic shows. One group chat. Settle the debate.');
  const [entries, setEntries] = useState(examples);
  const [game, setGame] = useState<BracketView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [share, setShare] = useState(false);
  const [close, setClose] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [kitId, setKitId] = useState('movies32');
  const [account, setAccount] = useState<AccountView | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [worldwide, setWorldwide] = useState<BracketSummary[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [gameMode, setGameMode] = useState<'everyone' | 'two_groups'>('everyone');
  const [visibility, setVisibility] = useState<'shared' | 'worldwide'>('shared');
  const [accent, setAccent] = useState<'lime' | 'ocean' | 'sunset' | 'plum'>('lime');
  const [deadlineEnabled, setDeadlineEnabled] = useState(false);
  const [deadlineLocal, setDeadlineLocal] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [minVotes, setMinVotes] = useState(10);
  const [roundHours, setRoundHours] = useState(24);
  const [extensionHours, setExtensionHours] = useState(12);
  const gameId = game?.id;

  useEffect(() => {
    fetch('/api/account').then(async (response) => await response.json() as { account?: AccountView | null }).then((result) => setAccount(result.account ?? null)).catch(() => {});
    const loadWorldwide = () => fetch('/api/brackets?scope=worldwide').then(async (response) => await response.json() as { brackets?: BracketSummary[] }).then((result) => setWorldwide(result.brackets ?? [])).catch(() => {});
    void loadWorldwide(); const timer = setInterval(loadWorldwide, 30000); return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: unknown) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(context.registerTool({
      name: 'configure_bracket',
      title: 'Configure a bracket',
      description: 'Fill the bracket builder with a title and 4, 8, 16, or 32 unique contenders. This prepares the preview; it does not create or publish a bracket.',
      inputSchema: { type: 'object', properties: { title: { type: 'string', maxLength: 80 }, entries: { type: 'array', items: { type: 'string', maxLength: 60 }, minItems: 4, maxItems: 32 } }, required: ['title', 'entries'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const value = input as { title: string; entries: string[] };
        const valid = value && typeof value.title === 'string' && value.title.trim() && value.title.length <= 80
          && Array.isArray(value.entries) && [4, 8, 16, 32].includes(value.entries.length)
          && value.entries.every((entry) => typeof entry === 'string' && entry.trim() && entry.length <= 60)
          && new Set(value.entries.map((entry) => entry.trim().toLowerCase())).size === value.entries.length;
        if (!valid) throw new Error('Provide a title and 4, 8, 16, or 32 unique contender names.');
        if (new URLSearchParams(location.search).has('b')) throw new Error('Open the bracket builder before configuring a new bracket.');
        setTitle(value.title.trim());
        setEntries(value.entries.map((entry) => entry.trim()));
        return { configured: true, contenders: value.entries.length };
      },
    }, { signal: lifecycle.signal })).catch(() => {});
    return () => lifecycle.abort();
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('b');
    if (!id) return;
    let active = true;
    queueMicrotask(() => { if (active) setLoading(true); });
    requestBracket(`/api/brackets/${encodeURIComponent(id)}`)
      .then((result) => { if (active) { setGame(result); setGameMode(result.settings.mode); setVisibility(result.settings.visibility); setAccent(result.settings.accent); setDeadlineEnabled(result.settings.deadlineEnabled); setMinVotes(result.settings.minVotes); setRoundHours(result.settings.roundHours); setExtensionHours(result.settings.extensionHours); if (result.settings.deadlineAt) setDeadlineLocal(new Date(result.settings.deadlineAt).toISOString().slice(0, 16)); } })
      .catch((error) => { if (active) setMessage(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!gameId) return;
    const timer = setInterval(() => requestBracket(`/api/brackets/${encodeURIComponent(gameId)}`).then(setGame).catch(() => {}), 8000);
    return () => clearInterval(timer);
  }, [gameId]);

  function applyKit() {
    const kit = starterKits.find((item) => item.id === kitId);
    if (!kit) return;
    setTitle(kit.title);
    setDescription(kit.description);
    setEntries([...kit.entries]);
    setMessage('Starter kit loaded. Edit any contender or shuffle before creating your bracket.');
  }

  function resize(size: number) {
    setEntries(Array.from({ length: size }, (_, index) => entries[index] ?? ''));
  }

  function settingsPayload() {
    return { mode: gameMode, visibility, accent, deadlineEnabled, deadlineAt: deadlineEnabled ? new Date(deadlineLocal).getTime() : undefined, minVotes, roundHours, extensionHours };
  }

  function shuffle() {
    setEntries((current) => {
      const next = [...current];
      for (let index = next.length - 1; index > 0; index--) {
        const swap = Math.floor(Math.random() * (index + 1));
        [next[index], next[swap]] = [next[swap], next[index]];
      }
      return next;
    });
  }

  async function create() {
    setBusy(true);
    setMessage('');
    try {
      const result = await requestBracket('/api/brackets', { title, description, entries, settings: settingsPayload() });
      setGame(result);
      history.pushState({}, '', `?b=${result.id}`);
      setShareUrl(location.href);
      setShare(true);
      setPreview(false);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function vote(match: number, pick: number) {
    if (!game || busy) return;
    setBusy(true);
    setMessage('');
    try {
      setGame(await requestBracket(`/api/brackets/${game.id}`, { action: 'vote', round: game.current, match, pick }));
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function advance() {
    if (!game) return;
    setBusy(true);
    setMessage('');
    try {
      setGame(await requestBracket(`/api/brackets/${game.id}`, { action: 'advance', round: game.current }));
      setClose(false);
    } catch (error) {
      setMessage((error as Error).message);
      setClose(false);
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    if (!game) return;
    setBusy(true); setMessage('');
    try { const result = await requestBracket(`/api/brackets/${game.id}`, { action: 'configure', settings: settingsPayload() }); setGame(result); setSettingsOpen(false); setMessage('Bracket rules updated.'); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  function openShare() {
    if (!game) return;
    setShareUrl(`${location.origin}/?b=${game.id}`);
    setShare(true);
  }

  function handleAccount(next: AccountView | null) {
    setAccount(next);
    if (gameId) void requestBracket(`/api/brackets/${encodeURIComponent(gameId)}`).then(setGame).catch(() => {});
  }

  const board = <BracketBoard key={`${game?.id ?? 'draft'}-${game?.current ?? 0}-${entries.length}-${game?.settings.accent ?? accent}`} game={game} entries={entries} title={title} busy={busy} onVote={vote} onShare={openShare} onAdvance={() => setClose(true)} />;
  const settingsFields = <div className="settings-fields">
    <label>Voting format<select value={gameMode} onChange={(event) => setGameMode(event.target.value as 'everyone' | 'two_groups')}><option value="everyone">One group · everyone votes on every matchup</option><option value="two_groups">Two groups · each person gets one side</option></select></label>
    <label>Discoverability<select value={visibility} onChange={(event) => setVisibility(event.target.value as 'shared' | 'worldwide')}><option value="shared">Invite link only</option><option value="worldwide" disabled={!account}>Worldwide · shown in public brackets</option></select>{!account && <small>Sign in to publish and manage a worldwide bracket.</small>}</label>
    <label>Bracket color<select value={accent} onChange={(event) => setAccent(event.target.value as typeof accent)}><option value="lime">Club lime</option><option value="ocean">Ocean blue</option><option value="sunset">Sunset coral</option><option value="plum">Electric plum</option></select></label>
    <label className="toggle-row" aria-label="Automatic round deadlines"><input type="checkbox" checked={deadlineEnabled} onChange={(event) => setDeadlineEnabled(event.target.checked)} /><span><strong>Automatic round deadlines</strong><small>Advance when the deadline and vote minimum are met.</small></span></label>
    {deadlineEnabled && <div className="deadline-grid"><label>First deadline<input type="datetime-local" value={deadlineLocal} onChange={(event) => setDeadlineLocal(event.target.value)} /></label><label>Minimum voters<input type="number" min="1" max="10000" value={minVotes} onChange={(event) => setMinVotes(Number(event.target.value))} /></label><label>Next round length<input type="number" min="1" max="720" value={roundHours} onChange={(event) => setRoundHours(Number(event.target.value))} /><small>hours</small></label><label>Extend by<input type="number" min="1" max="168" value={extensionHours} onChange={(event) => setExtensionHours(Number(event.target.value))} /><small>hours</small></label></div>}
  </div>;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/"><span className="brand-symbol"><GitFork size={22} /></span>bracket<span className="brand-light">club</span><span className="brand-dot">®</span></a>
        <span className="top-caption">A little competition. A lot of opinions.</span>
        <div className="top-actions"><button className="secondary small" onClick={() => setAccountOpen(true)}>{account ? <UserRound size={16} /> : <UserRound size={16} />}{account ? account.displayName : 'Sign in'}</button><button className="secondary small" onClick={() => { location.href = '/'; }}><Plus size={16} /> New bracket</button></div>
      </header>
      <main>
        <div className="breadcrumb"><span>Your next great debate</span><span>/</span><span>{game ? 'The bracket' : 'Bracket builder'}</span></div>
        <div className="page-heading"><div><h1>{game ? game.title : 'Big opinions. One winner.'}</h1><p>{game ? game.description : 'Pick the contenders. Rally your friends. Let the best one win.'}</p></div><span className="edition"><GitFork size={16} /> {game ? 'Voting room' : 'Make it a match'}</span></div>
        {message && <output className="notice">{message}<button aria-label="Dismiss message" onClick={() => setMessage('')}>×</button></output>}
        {loading ? <div className="loading">Opening your bracket…</div> : (
          <div className={`workspace ${game ? 'voting-workspace' : 'builder-workspace'}`}>
            <aside className="editor">
              <div className="editor-header"><span className="step-number">{game ? <Users size={18} /> : '01'}</span><h2>{game ? 'The voting room' : 'Build your bracket'}</h2></div>
              {game ? (
                <div className="room-info">
                  <span className="status-pill"><i />{game.champion ? 'Complete' : 'Voting is open'}</span>
                  <h3>{game.champion ? 'We have a winner.' : roundName(game.rounds[game.current].length)}</h3>
                  <p>{game.champion ? 'The votes are in. Your group has crowned a champion.' : 'Choose your favorite in each matchup. You can change your vote until the host closes the round.'}</p>
                  {game.viewerGroup && <div className={`group-assignment group-${game.viewerGroup.toLowerCase()}`}><Users size={17} /><span><strong>You’re in Group {game.viewerGroup}</strong><small>Vote on your half. The other group stays visible live.</small></span></div>}
                  {game.settings.deadlineEnabled && game.settings.deadlineAt && <div className="deadline-card"><Clock3 size={17} /><span><strong>{new Date(game.settings.deadlineAt).toLocaleString()}</strong><small>Auto-advance at {game.settings.minVotes} voters; otherwise extend {game.settings.extensionHours}h.</small></span></div>}
                  <div className="room-stat"><strong>{game.total}</strong><span>votes across all rounds</span></div>
                  <div className="desktop-room-actions"><button className="primary" onClick={openShare}><Link2 size={18} /> Invite friends</button>{game.owner && <button className="secondary" onClick={() => setSettingsOpen(true)}><Settings2 size={16} /> Manage rules</button>}{game.owner && !game.champion && <button className="secondary" onClick={() => setClose(true)}>Close round & advance <ArrowRight size={16} /></button>}</div>
                  {game.owner && <button className="secondary mobile-manage" onClick={() => setSettingsOpen(true)}><Settings2 size={16} /> Manage bracket rules</button>}
                  <div className="tip"><LockKeyhole size={18} /><p>{game.owner ? 'You’re the host on this browser. Close each round when everyone has voted.' : 'The host closes each round and advances the winners.'}</p></div>
                  <a className="text-link" href="/"><Plus size={16} /> Create your own bracket</a>
                </div>
              ) : (
                <>
                  <div className="starter-kit"><div className="field-label">Start with a kit <span>optional</span></div><Select value={kitId} onValueChange={(value) => { if (value) setKitId(value); }}><SelectTrigger className="size-select" aria-label="Starter kit"><SelectValue /></SelectTrigger><SelectContent>{starterKits.map((kit) => <SelectItem key={kit.id} value={kit.id}>{kit.label}</SelectItem>)}</SelectContent></Select><button className="secondary" onClick={applyKit}>Use this kit <ArrowRight size={16} /></button><p>Fills the title, size, and contenders. You can edit everything afterward.</p></div>
                  <label className="field-label" htmlFor="title">Bracket title</label><input id="title" maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What are we deciding?" />
                  <label className="field-label" htmlFor="description">A little context <span>optional</span></label><textarea id="description" maxLength={200} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Give your friends the backstory" />
                  <div className="field-label">Bracket size</div><Select value={String(entries.length)} onValueChange={(value) => resize(Number(value))}><SelectTrigger className="size-select" aria-label="Bracket size"><SelectValue /></SelectTrigger><SelectContent>{[4, 8, 16, 32].map((size) => <SelectItem key={size} value={String(size)}>{size} contenders</SelectItem>)}</SelectContent></Select>
                  <section className="customize-panel"><button className="customize-toggle" aria-expanded={customizeOpen} onClick={() => setCustomizeOpen((value) => !value)}><span><Settings2 size={17} /> Customize game</span><small>{gameMode === 'two_groups' ? 'Two groups' : 'One group'} · {visibility === 'worldwide' ? 'Worldwide' : 'Invite only'}</small></button>{customizeOpen && settingsFields}</section>
                  <div className="entries-heading"><label className="field-label">The contenders <span>{entries.filter((entry) => entry.trim()).length}/{entries.length}</span></label><button className="text-link" onClick={shuffle}><Shuffle size={14} /> Shuffle</button></div>
                  <div className="entry-list">{entries.map((entry, index) => <div className="entry-field" key={index}><span>{String(index + 1).padStart(2, '0')}</span><input aria-label={`Contender ${index + 1}`} maxLength={60} value={entry} placeholder={`Contender ${index + 1}`} onChange={(event) => setEntries(entries.map((value, item) => item === index ? event.target.value : value))} /></div>)}</div>
                  <p className="editor-hint">{entries.length === 32 ? 'Entries 1–16 start on the left; 17–32 start on the right.' : 'Neighbors face off in the first round.'}</p>
                  <button className="preview-trigger secondary" onClick={() => setPreview(true)}>Preview bracket <ArrowRight size={18} /></button>
                  <button className="primary" disabled={busy || !title.trim() || entries.some((entry) => !entry.trim())} onClick={create}>{busy ? 'Creating…' : 'Create & invite friends'}<ArrowRight size={18} /></button>
                  <p className="under-button">Your bracket goes live when you create it.</p>
                </>
              )}
            </aside>
            <div className="inline-board">{board}</div>
          </div>
        )}
        {!game && <section className="worldwide-section" id="worldwide"><div className="section-heading"><div><span className="eyebrow"><Globe2 size={15} /> Live around the world</span><h2>Join a bracket already in motion.</h2><p>Sign in to keep every vote in your history.</p></div></div><div className="world-grid">{worldwide.length ? worldwide.map((item) => <a className={`world-card theme-${item.settings.accent}`} href={`/?b=${item.id}`} key={item.id}><div><span className="live-chip"><i /> {item.champion ? 'Complete' : 'Voting now'}</span>{item.settings.mode === 'two_groups' && <span className="two-group-chip"><Users size={13} /> Two groups</span>}</div><h3>{item.title}</h3><p>{item.description || `${item.size} contenders are competing.`}</p><footer><span>{item.total} votes</span>{item.settings.deadlineAt && !item.champion ? <span><Clock3 size={13} /> {new Date(item.settings.deadlineAt).toLocaleDateString()}</span> : <span>{item.size} entries</span>}</footer></a>) : <div className="world-empty"><Globe2 size={26} /><strong>The worldwide stage is ready.</strong><span>Publish the first public bracket from Customize game.</span></div>}</div></section>}
        <div className="bottom-note"><span><GitFork size={17} /> Built for the group chat.</span><p>{game ? 'Every vote brings you closer to a champion.' : 'Anything can be a bracket. Just bring your opinions.'}</p><span>Let the debate begin ↗</span></div>
      </main>

      <Sheet open={preview} onOpenChange={setPreview}><SheetContent side="right" className="preview-sheet"><SheetHeader><SheetTitle>Bracket preview</SheetTitle><SheetDescription>Check the opening matchups before you create it.</SheetDescription></SheetHeader><div className="preview-sheet-body"><BracketBoard key={`preview-${entries.length}`} game={null} entries={entries} title={title} busy={false} onVote={() => {}} onShare={() => {}} onAdvance={() => {}} preview /></div></SheetContent></Sheet>
      <Dialog open={share} onOpenChange={setShare}><DialogContent className="share-dialog"><div className="dialog-icon"><Link2 /></div><DialogTitle>Bring the group chat.</DialogTitle><DialogDescription>Send this voting link to your friends. You control when each round ends from this browser.</DialogDescription><input aria-label="Voting link" readOnly value={shareUrl} onFocus={(event) => event.target.select()} /><button className="primary" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setMessage('Voting link copied!'); setShare(false); } catch { setMessage('Select and copy the voting link.'); } }}>Copy voting link <Link2 size={16} /></button></DialogContent></Dialog>
      <Dialog open={close} onOpenChange={setClose}><DialogContent><DialogTitle>Close this round?</DialogTitle><DialogDescription>Voting for this round will end. The most-voted contender in each matchup advances. Ties must be broken with more votes before you can advance. This cannot be undone.</DialogDescription><button className="primary" disabled={busy} onClick={advance}>{busy ? 'Advancing…' : 'Close round & advance'}</button><button className="secondary" onClick={() => setClose(false)}>Keep voting</button></DialogContent></Dialog>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="settings-dialog"><DialogTitle>Manage bracket rules</DialogTitle><DialogDescription>Changes apply to the current and future rounds. Existing votes stay in place.</DialogDescription>{settingsFields}<button className="primary" disabled={busy} onClick={saveSettings}>{busy ? 'Saving…' : 'Save rules'}</button></DialogContent></Dialog>
      <AccountPanel open={accountOpen} onOpenChange={setAccountOpen} account={account} onAccount={handleAccount} onMessage={setMessage} />
    </div>
  );
}
