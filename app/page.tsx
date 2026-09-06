'use client';
/* oxlint-disable next/no-html-link-for-pages */

import { useEffect, useState } from 'react';
import { ArrowRight, GitFork, Link2, LockKeyhole, Plus, Shuffle, Users } from 'lucide-react';
import { BracketBoard, type BracketView, roundName } from '@/components/bracket-board';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { starterKits } from '@/lib/starter-kits';

const examples = ['The Office', 'Friends', 'Brooklyn Nine-Nine', 'Parks and Recreation', 'Seinfeld', 'Modern Family', 'Community', 'New Girl'];

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
  const gameId = game?.id;

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
      .then((result) => { if (active) setGame(result); })
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
      const result = await requestBracket('/api/brackets', { title, description, entries });
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

  function openShare() {
    if (!game) return;
    setShareUrl(`${location.origin}/?b=${game.id}`);
    setShare(true);
  }

  const board = <BracketBoard key={`${game?.id ?? 'draft'}-${game?.current ?? 0}-${entries.length}`} game={game} entries={entries} title={title} busy={busy} onVote={vote} onShare={openShare} onAdvance={() => setClose(true)} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/"><span className="brand-symbol"><GitFork size={22} /></span>bracket<span className="brand-light">club</span><span className="brand-dot">®</span></a>
        <span className="top-caption">A little competition. A lot of opinions.</span>
        <button className="secondary small" onClick={() => { location.href = '/'; }}><Plus size={16} /> New bracket</button>
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
                  <div className="room-stat"><strong>{game.total}</strong><span>votes across all rounds</span></div>
                  <div className="desktop-room-actions"><button className="primary" onClick={openShare}><Link2 size={18} /> Invite friends</button>{game.owner && !game.champion && <button className="secondary" onClick={() => setClose(true)}>Close round & advance <ArrowRight size={16} /></button>}</div>
                  <div className="tip"><LockKeyhole size={18} /><p>{game.owner ? 'You’re the host on this browser. Close each round when everyone has voted.' : 'The host closes each round and advances the winners.'}</p></div>
                  <a className="text-link" href="/"><Plus size={16} /> Create your own bracket</a>
                </div>
              ) : (
                <>
                  <div className="starter-kit"><div className="field-label">Start with a kit <span>optional</span></div><Select value={kitId} onValueChange={(value) => { if (value) setKitId(value); }}><SelectTrigger className="size-select" aria-label="Starter kit"><SelectValue /></SelectTrigger><SelectContent>{starterKits.map((kit) => <SelectItem key={kit.id} value={kit.id}>{kit.label}</SelectItem>)}</SelectContent></Select><button className="secondary" onClick={applyKit}>Use this kit <ArrowRight size={16} /></button><p>Fills the title, size, and contenders. You can edit everything afterward.</p></div>
                  <label className="field-label" htmlFor="title">Bracket title</label><input id="title" maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What are we deciding?" />
                  <label className="field-label" htmlFor="description">A little context <span>optional</span></label><textarea id="description" maxLength={200} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Give your friends the backstory" />
                  <div className="field-label">Bracket size</div><Select value={String(entries.length)} onValueChange={(value) => resize(Number(value))}><SelectTrigger className="size-select" aria-label="Bracket size"><SelectValue /></SelectTrigger><SelectContent>{[4, 8, 16, 32].map((size) => <SelectItem key={size} value={String(size)}>{size} contenders</SelectItem>)}</SelectContent></Select>
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
        <div className="bottom-note"><span><GitFork size={17} /> Built for the group chat.</span><p>{game ? 'Every vote brings you closer to a champion.' : 'Anything can be a bracket. Just bring your opinions.'}</p><span>Let the debate begin ↗</span></div>
      </main>

      <Sheet open={preview} onOpenChange={setPreview}><SheetContent side="right" className="preview-sheet"><SheetHeader><SheetTitle>Bracket preview</SheetTitle><SheetDescription>Check the opening matchups before you create it.</SheetDescription></SheetHeader><div className="preview-sheet-body"><BracketBoard key={`preview-${entries.length}`} game={null} entries={entries} title={title} busy={false} onVote={() => {}} onShare={() => {}} onAdvance={() => {}} preview /></div></SheetContent></Sheet>
      <Dialog open={share} onOpenChange={setShare}><DialogContent className="share-dialog"><div className="dialog-icon"><Link2 /></div><DialogTitle>Bring the group chat.</DialogTitle><DialogDescription>Send this voting link to your friends. You control when each round ends from this browser.</DialogDescription><input aria-label="Voting link" readOnly value={shareUrl} onFocus={(event) => event.target.select()} /><button className="primary" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setMessage('Voting link copied!'); setShare(false); } catch { setMessage('Select and copy the voting link.'); } }}>Copy voting link <Link2 size={16} /></button></DialogContent></Dialog>
      <Dialog open={close} onOpenChange={setClose}><DialogContent><DialogTitle>Close this round?</DialogTitle><DialogDescription>Voting for this round will end. The most-voted contender in each matchup advances. Ties must be broken with more votes before you can advance. This cannot be undone.</DialogDescription><button className="primary" disabled={busy} onClick={advance}>{busy ? 'Advancing…' : 'Close round & advance'}</button><button className="secondary" onClick={() => setClose(false)}>Keep voting</button></DialogContent></Dialog>
    </div>
  );
}
