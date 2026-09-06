'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, GitFork, Link2, Trophy } from 'lucide-react';

export type MatchView = { a: string; b: string; votes: number[]; pick?: number; winner?: string };
export type BracketView = { id: string; title: string; description: string; rounds: MatchView[][]; current: number; owner: boolean; champion?: string; total: number };

type Props = {
  game: BracketView | null;
  entries: string[];
  title: string;
  busy: boolean;
  onVote: (match: number, pick: number) => void;
  onShare: () => void;
  onAdvance: () => void;
  preview?: boolean;
};

export function roundName(matches: number) {
  if (matches === 1) return 'Final';
  if (matches === 2) return 'Semifinals';
  if (matches === 4) return 'Quarterfinals';
  if (matches === 8) return 'Round of 16';
  return 'Round of 32';
}

export function BracketBoard({ game, entries, title, busy, onVote, onShare, onAdvance, preview = false }: Props) {
  const initial: MatchView[] = Array.from({ length: entries.length / 2 }, (_, index) => ({
    a: entries[index * 2] || `Entry ${index * 2 + 1}`,
    b: entries[index * 2 + 1] || `Entry ${index * 2 + 2}`,
    votes: [0, 0],
  }));
  const rounds = game ? game.rounds : [initial];
  const size = rounds[0].length * 2;
  const roundCount = Math.log2(size);
  const [phoneRound, setPhoneRound] = useState(game?.current ?? 0);
  const [phoneSide, setPhoneSide] = useState<'left' | 'right'>('left');
  const tabletTrack = useRef<HTMLDivElement>(null);

  const shownPhoneRound = Math.min(phoneRound, roundCount - 1);

  function renderRound(round: number, side?: 'left' | 'right', idPrefix = '') {
    const totalMatches = size / 2 ** (round + 1);
    const count = side ? totalMatches / 2 : totalMatches;
    const offset = side === 'right' ? count : 0;
    const isOpen = Boolean(game && round === game.current && !game.champion);
    return (
      <div className={`round-column ${side ?? ''}`} key={`${idPrefix}-${side ?? 'all'}-${round}`}>
        <div className={`round-heading ${isOpen ? 'active' : ''}`}><span>{roundName(totalMatches)}</span><small>{String(round + 1).padStart(2, '0')}</small></div>
        <div className="match-stack">
          {Array.from({ length: count }, (_, localIndex) => {
            const matchIndex = localIndex + offset;
            const match = rounds[round]?.[matchIndex];
            return (
              <div className={`match ${match ? '' : 'pending'}`} key={matchIndex}>
                {[0, 1].map((pick) => {
                  const name = match ? (pick === 0 ? match.a : match.b) : 'Awaiting winner';
                  return (
                    <button className={`contender ${match?.pick === pick ? 'picked ' : ''}${match?.winner === name ? 'won' : ''}`} disabled={!isOpen || busy || preview} key={pick} onClick={() => onVote(matchIndex, pick)} aria-label={isOpen ? `Vote for ${name}` : undefined}>
                      <span className="seed">{round === 0 ? matchIndex * 2 + pick + 1 : <GitFork size={13} />}</span>
                      <span className="contender-name">{name}</span>
                      {game && match ? <span className="vote-count">{match.pick === pick && <Check size={13} />} {match.votes[pick]}</span> : <span className="empty-dot" />}
                    </button>
                  );
                })}
                {isOpen && !preview && <span className="match-note">{match?.pick !== undefined ? 'Your vote is in' : 'Tap to vote'}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function championCard(compact = false) {
    return (
      <div className={`champion ${game?.champion ? 'crowned' : ''} ${compact ? 'compact' : ''}`}>
        <div className="trophy-circle"><Trophy size={compact ? 27 : 32} strokeWidth={1.5} /></div>
        <span className="champion-label">Champion</span>
        <strong>{game?.champion || 'Only one takes it.'}</strong>
        <p>{game?.champion ? 'Chosen by your people.' : 'Your group decides.'}</p>
      </div>
    );
  }

  function scrollTablet(round: number) {
    (tabletTrack.current?.children.item(round) as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  }

  return (
    <section className={`board-panel ${preview ? 'preview-board' : ''}`} aria-label="Tournament bracket">
      <div className="board-top"><div><span className={`status-pill ${game ? '' : 'draft'}`}><i />{game ? (game.champion ? 'Champion crowned' : 'Live bracket') : 'Live preview'}</span><h2>{game ? 'The road to a winner' : title || 'Your bracket'}</h2></div><div className="board-count"><span>{size} contenders</span><b>·</b><span>{roundCount} rounds</span><b>·</b><span>1 champion</span></div></div>

      <div className="phone-board">
        <div className="round-tabs" role="tablist" aria-label="Bracket rounds">
          {Array.from({ length: roundCount }, (_, round) => <button aria-current={shownPhoneRound === round ? 'page' : undefined} aria-selected={shownPhoneRound === round} className={shownPhoneRound === round ? 'active' : ''} key={round} onClick={() => setPhoneRound(round)} role="tab">{roundName(size / 2 ** (round + 1))}{game?.current === round && !game.champion && <i aria-label="Voting open" />}</button>)}
        </div>
        {size === 32 && shownPhoneRound < 4 && <div className="side-switcher" aria-label="Bracket side"><button className={phoneSide === 'left' ? 'active' : ''} onClick={() => setPhoneSide('left')}>Left · 1–16</button><button className={phoneSide === 'right' ? 'active' : ''} onClick={() => setPhoneSide('right')}>Right · 17–32</button></div>}
        <div className="phone-round" role="tabpanel">{renderRound(shownPhoneRound, size === 32 && shownPhoneRound < 4 ? phoneSide : undefined, 'phone')}</div>
        <div className="round-pager"><button disabled={shownPhoneRound === 0} onClick={() => setPhoneRound((value) => Math.max(0, value - 1))}><ArrowLeft size={17} /> Previous</button><span>{shownPhoneRound + 1} of {roundCount}</span><button disabled={shownPhoneRound === roundCount - 1} onClick={() => setPhoneRound((value) => Math.min(roundCount - 1, value + 1))}>Next <ArrowRight size={17} /></button></div>
        {game && shownPhoneRound !== game.current && !game.champion && <button className="secondary go-live" onClick={() => setPhoneRound(game.current)}>Go to open voting <ArrowRight size={17} /></button>}
        {game?.champion && championCard(true)}
        {game && !preview && <div className="mobile-action-dock"><button className="primary" onClick={onShare}><Link2 size={18} /> Invite friends</button>{game.owner && !game.champion && <button className="secondary" onClick={onAdvance}>Close round <ArrowRight size={17} /></button>}</div>}
      </div>

      <div className="tablet-board">
        <div className="tablet-nav" aria-label="Jump to round">{Array.from({ length: roundCount }, (_, round) => <button key={round} onClick={() => scrollTablet(round)}>{roundName(size / 2 ** (round + 1))}{game?.current === round && !game.champion && <i />}</button>)}</div>
        <div className="tablet-track" ref={tabletTrack}>{Array.from({ length: roundCount }, (_, round) => renderRound(round, undefined, 'tablet-round'))}<div className="tablet-champion"><div className="round-heading"><span>Champion</span></div>{championCard()}</div></div>
      </div>

      <div className="desktop-board">
        {size === 32 && <div className="split-guide"><span>Left side · Entries 1–16</span><span>Final in the center</span><span>Right side · Entries 17–32</span></div>}
        <div className="bracket-scroll" aria-label="Scrollable tournament board">
          <div className={`bracket-grid ${size === 32 ? 'split-bracket' : ''}`} style={size === 32 ? { gridTemplateColumns: 'repeat(4,minmax(185px,1fr)) 210px repeat(4,minmax(185px,1fr))', minWidth: 2114 } : { gridTemplateColumns: `repeat(${roundCount}, minmax(185px,1fr)) 150px`, minWidth: roundCount * 220 + 150 }}>
            {size === 32 ? <>{[0, 1, 2, 3].map((round) => renderRound(round, 'left', 'desktop-left'))}<div className="center-final">{renderRound(4, undefined, 'desktop-final')}<div className="champion-column">{championCard()}</div></div>{[3, 2, 1, 0].map((round) => renderRound(round, 'right', 'desktop-right'))}</> : <>{Array.from({ length: roundCount }, (_, round) => renderRound(round, undefined, 'desktop'))}<div className="champion-column"><div className="round-heading"><span>Champion</span></div>{championCard()}</div></>}
          </div>
        </div>
      </div>
      <div className="board-footer"><span><span className="legend-dot" />{game ? 'Votes refresh automatically' : 'First-round matchups'}</span><span>{game ? 'One vote per matchup, per browser' : 'Winners advance each round'} <ArrowRight size={14} /></span></div>
    </section>
  );
}
