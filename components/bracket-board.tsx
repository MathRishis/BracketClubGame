'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GitFork,
  Link2,
  Trophy,
} from 'lucide-react';

export type BracketSettings = {
  mode: 'everyone' | 'two_groups';
  visibility: 'shared' | 'worldwide';
  accent: 'lime' | 'ocean' | 'sunset' | 'plum';
  deadlineEnabled: boolean;
  deadlineAt?: number;
  minVotes: number;
  roundHours: number;
  extensionHours: number;
};
export type MatchView = {
  a: string;
  b: string;
  votes: number[];
  pick?: number;
  winner?: string;
  group?: 'A' | 'B' | null;
  canVote?: boolean;
};
export type BracketView = {
  id: string;
  title: string;
  description: string;
  rounds: MatchView[][];
  current: number;
  owner: boolean;
  champion?: string;
  total: number;
  settings: BracketSettings;
  viewerGroup?: 'A' | 'B' | null;
  groupStatus?: { group: 'A' | 'B'; voters: number; matchups: number }[];
  createdAt?: number;
  lifecycle?: string;
  startsAt?: number;
  category?: string;
  moderation?: string;
  featured?: boolean;
  official?: boolean;
  extensionReason?: string;
  participants?: number;
  creatorId?: string | null;
  contenders?: {
    name: string;
    image?: string;
    description?: string;
    link?: string;
  }[];
};

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

export function BracketBoard({
  game,
  entries,
  title,
  busy,
  onVote,
  onShare,
  onAdvance,
  preview = false,
}: Props) {
  const initial: MatchView[] = Array.from(
    { length: entries.length / 2 },
    (_, index) => ({
      a: entries[index * 2] || `Entry ${index * 2 + 1}`,
      b: entries[index * 2 + 1] || `Entry ${index * 2 + 2}`,
      votes: [0, 0],
    }),
  );
  const rounds = game ? game.rounds : [initial];
  const size = rounds[0].length * 2;
  const roundCount = Math.log2(size);
  const [phoneRound, setPhoneRound] = useState(game?.current ?? 0);
  const [phoneSide, setPhoneSide] = useState<'left' | 'right'>(
    game?.viewerGroup === 'B' ? 'right' : 'left',
  );
  const [detailName, setDetailName] = useState<string | null>(null);
  const previousRound = useRef(game?.current ?? 0);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const round = Number(q.get('round'));
    if (
      q.has('round') &&
      Number.isInteger(round) &&
      round >= 0 &&
      round < roundCount
    )
      setPhoneRound(round);
    if (q.get('side') === 'right' || q.get('side') === 'left')
      setPhoneSide(q.get('side') as 'left' | 'right');
  }, []);
  useEffect(() => {
    if (game && game.current !== previousRound.current) {
      setPhoneRound((r) => (r === previousRound.current ? game.current : r));
      previousRound.current = game.current;
    }
  }, [game?.current]);
  const detail = game?.contenders?.find((c) => c.name === detailName);
  async function shareView() {
    const url = new URL(location.href);
    url.searchParams.set('round', String(shownPhoneRound));
    url.searchParams.set('side', phoneSide);
    try {
      await navigator.clipboard.writeText(url.href);
      setShareMessage('Round link copied.');
    } catch {
      setShareMessage(url.href);
    }
  }
  const [shareMessage, setShareMessage] = useState('');
  function downloadChampion() {
    if (!game?.champion) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#17201c';
    ctx.fillRect(0, 0, 1200, 630);
    ctx.fillStyle = '#d5f967';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('BRACKET CLUB / CHAMPION', 70, 100);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 58px sans-serif';
    const words = game.champion.split(' ');
    let line = '',
      y = 235;
    for (const word of words) {
      if (ctx.measureText(line + word).width > 1050) {
        ctx.fillText(line, 70, y);
        line = '';
        y += 72;
      }
      line += word + ' ';
    }
    ctx.fillText(line, 70, y);
    ctx.font = '28px sans-serif';
    ctx.fillStyle = '#c3cbbf';
    ctx.fillText(game.title, 70, 480, 1050);
    ctx.fillText(
      game.total + ' votes · ' + size + ' contenders · One winner',
      70,
      545,
    );
    const a = document.createElement('a');
    a.download = 'bracket-club-champion.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  }
  const tabletTrack = useRef<HTMLDivElement>(null);

  const shownPhoneRound = Math.min(phoneRound, roundCount - 1);
  const phoneRoundMatches = size / 2 ** (shownPhoneRound + 1);
  const phoneHasSides =
    phoneRoundMatches > 1 &&
    (size === 32 || game?.settings.mode === 'two_groups');

  function renderRound(round: number, side?: 'left' | 'right', idPrefix = '') {
    const totalMatches = size / 2 ** (round + 1);
    const count = side ? totalMatches / 2 : totalMatches;
    const offset = side === 'right' ? count : 0;
    const isOpen = Boolean(
      game &&
      round === game.current &&
      !game.champion &&
      (!game.lifecycle || game.lifecycle === 'active'),
    );
    return (
      <div
        className={`round-column ${side ?? ''}`}
        key={`${idPrefix}-${side ?? 'all'}-${round}`}
      >
        <div className={`round-heading ${isOpen ? 'active' : ''}`}>
          <span>{roundName(totalMatches)}</span>
          <small>{String(round + 1).padStart(2, '0')}</small>
        </div>
        <div className="match-stack">
          {Array.from({ length: count }, (_, localIndex) => {
            const matchIndex = localIndex + offset;
            const match = rounds[round]?.[matchIndex];
            const canVote = isOpen && (match?.canVote ?? true);
            return (
              <div
                className={`match ${match ? '' : 'pending'} ${isOpen && !canVote ? 'watch-only' : ''}`}
                key={matchIndex}
              >
                {match?.group && (
                  <span
                    className={`match-group group-${match.group.toLowerCase()}`}
                  >
                    Group {match.group}
                  </span>
                )}
                {[0, 1].map((pick) => {
                  const name = match
                    ? pick === 0
                      ? match.a
                      : match.b
                    : 'Awaiting winner';
                  return (
                    <button
                      className={`contender ${match?.pick === pick ? 'picked ' : ''}${match?.winner === name ? 'won' : ''}`}
                      disabled={!canVote || busy || preview}
                      key={pick}
                      onClick={() => onVote(matchIndex, pick)}
                      aria-label={canVote ? `Vote for ${name}` : undefined}
                    >
                      <span className="seed">
                        {round === 0 ? (
                          matchIndex * 2 + pick + 1
                        ) : (
                          <GitFork size={13} />
                        )}
                      </span>
                      {game?.contenders?.find((c) => c.name === name)
                        ?.image && (
                        <img
                          className="contender-art"
                          src={
                            game.contenders.find((c) => c.name === name)!.image
                          }
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.visibility = 'hidden';
                          }}
                        />
                      )}
                      <span className="contender-name">{name}</span>
                      {game && match ? (
                        <span className="vote-count">
                          {match.pick === pick && <Check size={13} />}{' '}
                          {match.votes[pick]}
                        </span>
                      ) : (
                        <span className="empty-dot" />
                      )}
                    </button>
                  );
                })}
                {match &&
                  game?.contenders?.some(
                    (c) =>
                      (c.name === match.a || c.name === match.b) &&
                      (c.description || c.link || c.image),
                  ) && (
                    <div className="entry-info-buttons">
                      <button
                        aria-label={`Details about ${match.a}`}
                        onClick={() => setDetailName(match.a)}
                      >
                        About {match.a}
                      </button>
                      <button
                        aria-label={`Details about ${match.b}`}
                        onClick={() => setDetailName(match.b)}
                      >
                        About {match.b}
                      </button>
                    </div>
                  )}
                {isOpen && !preview && (
                  <span className="match-note">
                    {canVote
                      ? match?.pick !== undefined
                        ? 'Your vote is in'
                        : 'Tap to vote'
                      : `Group ${match?.group} voting · watch live`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function championCard(compact = false) {
    return (
      <div
        className={`champion ${game?.champion ? 'crowned' : ''} ${compact ? 'compact' : ''}`}
      >
        <div className="trophy-circle">
          <Trophy size={compact ? 27 : 32} strokeWidth={1.5} />
        </div>
        <span className="champion-label">Champion</span>
        <strong>{game?.champion || 'Only one takes it.'}</strong>
        <p>
          {game?.champion ? 'Chosen by your people.' : 'Your group decides.'}
        </p>
        {game?.champion && (
          <button className="secondary" onClick={downloadChampion}>
            Download champion card
          </button>
        )}
      </div>
    );
  }

  function scrollTablet(round: number) {
    (
      tabletTrack.current?.children.item(round) as HTMLElement | null
    )?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'nearest',
      inline: 'start',
    });
  }

  return (
    <section
      className={`board-panel theme-${game?.settings.accent ?? 'lime'} ${preview ? 'preview-board' : ''}`}
      aria-label="Tournament bracket"
    >
      <div className="board-top">
        <div>
          <span className={`status-pill ${game ? '' : 'draft'}`}>
            <i />
            {game
              ? game.champion
                ? 'Champion crowned'
                : 'Live bracket'
              : 'Live preview'}
          </span>
          <h2>{game ? 'The road to a winner' : title || 'Your bracket'}</h2>
          {game?.viewerGroup && (
            <span
              className={`your-group group-${game.viewerGroup.toLowerCase()}`}
            >
              You’re in Group {game.viewerGroup}
            </span>
          )}
        </div>
        <div className="board-count">
          <span>{size} contenders</span>
          <b>·</b>
          <span>{roundCount} rounds</span>
          <b>·</b>
          <span>1 champion</span>
        </div>
      </div>
      {game?.groupStatus && game.groupStatus.length > 0 && (
        <div className="group-status-row">
          {game.groupStatus.map((status) => (
            <div key={status.group}>
              <span
                className={`group-dot group-${status.group.toLowerCase()}`}
              />{' '}
              <strong>Group {status.group}</strong>
              <span>
                {status.matchups
                  ? `${status.voters} voters · ${status.matchups} matchups`
                  : 'Finalists decided'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="phone-board">
        <div className="round-tabs" role="tablist" aria-label="Bracket rounds">
          {Array.from({ length: roundCount }, (_, round) => (
            <button
              aria-current={shownPhoneRound === round ? 'page' : undefined}
              aria-selected={shownPhoneRound === round}
              className={shownPhoneRound === round ? 'active' : ''}
              key={round}
              onClick={() => setPhoneRound(round)}
              role="tab"
            >
              {roundName(size / 2 ** (round + 1))}
              {game?.current === round && !game.champion && (
                <i aria-label="Voting open" />
              )}
            </button>
          ))}
        </div>
        {phoneHasSides && (
          <div
            className="side-switcher"
            aria-label={
              game?.settings.mode === 'two_groups'
                ? 'Voting group'
                : 'Bracket side'
            }
          >
            <button
              className={phoneSide === 'left' ? 'active' : ''}
              onClick={() => setPhoneSide('left')}
            >
              {game?.settings.mode === 'two_groups' ? 'Group A' : 'Left · 1–16'}
            </button>
            <button
              className={phoneSide === 'right' ? 'active' : ''}
              onClick={() => setPhoneSide('right')}
            >
              {game?.settings.mode === 'two_groups'
                ? 'Group B'
                : 'Right · 17–32'}
            </button>
          </div>
        )}
        <button className="text-link share-round" onClick={shareView}>
          Share this round & side
        </button>
        {shareMessage && (
          <output className="share-result">{shareMessage}</output>
        )}
        <div className="phone-round" role="tabpanel">
          {renderRound(
            shownPhoneRound,
            phoneHasSides ? phoneSide : undefined,
            'phone',
          )}
        </div>
        <div className="round-pager">
          <button
            disabled={shownPhoneRound === 0}
            onClick={() => setPhoneRound((value) => Math.max(0, value - 1))}
          >
            <ArrowLeft size={17} /> Previous
          </button>
          <span>
            {shownPhoneRound + 1} of {roundCount}
          </span>
          <button
            disabled={shownPhoneRound === roundCount - 1}
            onClick={() =>
              setPhoneRound((value) => Math.min(roundCount - 1, value + 1))
            }
          >
            Next <ArrowRight size={17} />
          </button>
        </div>
        {game && shownPhoneRound !== game.current && !game.champion && (
          <button
            className="secondary go-live"
            onClick={() => setPhoneRound(game.current)}
          >
            Go to open voting <ArrowRight size={17} />
          </button>
        )}
        {game?.champion && championCard(true)}
        {game && !preview && (
          <div className="mobile-action-dock">
            <button className="primary" onClick={onShare}>
              <Link2 size={18} /> Invite friends
            </button>
            {game.owner && !game.champion && (
              <button className="secondary" onClick={onAdvance}>
                Close round <ArrowRight size={17} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="tablet-board">
        <div className="tablet-nav" aria-label="Jump to round">
          {Array.from({ length: roundCount }, (_, round) => (
            <button key={round} onClick={() => scrollTablet(round)}>
              {roundName(size / 2 ** (round + 1))}
              {game?.current === round && !game.champion && <i />}
            </button>
          ))}
        </div>
        <div className="tablet-track" ref={tabletTrack}>
          {Array.from({ length: roundCount }, (_, round) =>
            renderRound(round, undefined, 'tablet-round'),
          )}
          <div className="tablet-champion">
            <div className="round-heading">
              <span>Champion</span>
            </div>
            {championCard()}
          </div>
        </div>
      </div>

      <div className="desktop-board">
        {size === 32 && (
          <div className="split-guide">
            <span>Left side · Entries 1–16</span>
            <span>Final in the center</span>
            <span>Right side · Entries 17–32</span>
          </div>
        )}
        <div
          className="bracket-scroll"
          aria-label="Scrollable tournament board"
        >
          <div
            className={`bracket-grid ${size === 32 ? 'split-bracket' : ''}`}
            style={
              size === 32
                ? {
                    gridTemplateColumns:
                      'repeat(4,minmax(185px,1fr)) 210px repeat(4,minmax(185px,1fr))',
                    minWidth: 2114,
                  }
                : {
                    gridTemplateColumns: `repeat(${roundCount}, minmax(185px,1fr)) 150px`,
                    minWidth: roundCount * 220 + 150,
                  }
            }
          >
            {size === 32 ? (
              <>
                {[0, 1, 2, 3].map((round) =>
                  renderRound(round, 'left', 'desktop-left'),
                )}
                <div className="center-final">
                  {renderRound(4, undefined, 'desktop-final')}
                  <div className="champion-column">{championCard()}</div>
                </div>
                {[3, 2, 1, 0].map((round) =>
                  renderRound(round, 'right', 'desktop-right'),
                )}
              </>
            ) : (
              <>
                {Array.from({ length: roundCount }, (_, round) =>
                  renderRound(round, undefined, 'desktop'),
                )}
                <div className="champion-column">
                  <div className="round-heading">
                    <span>Champion</span>
                  </div>
                  {championCard()}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <Dialog
        open={!!detailName}
        onOpenChange={(open) => {
          if (!open) setDetailName(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{detailName}</DialogTitle>
          <DialogDescription>
            {detail?.description || 'Learn more about this contender.'}
          </DialogDescription>
          {detail?.image && (
            <img
              className="detail-art"
              src={detail.image}
              alt={detailName ?? ''}
              referrerPolicy="no-referrer"
            />
          )}
          {detail?.link && (
            <a
              className="secondary"
              href={detail.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more ↗
            </a>
          )}
        </DialogContent>
      </Dialog>
      <div className="board-footer">
        <span>
          <span className="legend-dot" />
          {game ? 'Votes refresh automatically' : 'First-round matchups'}
        </span>
        <span>
          {game
            ? 'One vote per matchup, per player'
            : 'Winners advance each round'}{' '}
          <ArrowRight size={14} />
        </span>
      </div>
    </section>
  );
}
