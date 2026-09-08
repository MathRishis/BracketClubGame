'use client';
import { useEffect, useState } from 'react';
import type { BracketView } from './bracket-board';
export type EntryDetails = {
  name?: string;
  image?: string;
  description?: string;
  link?: string;
};
export async function api(path: string, data?: unknown) {
  const r = await fetch(path, {
    method: data ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  const value = (await r.json()) as any;
  if (!r.ok) throw new Error(value.error || 'Please try again.');
  return value;
}
export function parseEntries(source: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\t')) {
      row.push(cell);
      cell = '';
    } else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('A quoted field is missing its closing quote.');
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  if (rows[0]?.[0].trim().toLowerCase() === 'name') rows.shift();
  if (![4, 8, 16, 32].includes(rows.length))
    throw new Error('Import exactly 4, 8, 16, or 32 entries.');
  const entries = rows.map((r) => r[0].trim());
  if (
    entries.some((n) => !n || n.length > 60) ||
    new Set(entries.map((n) => n.toLowerCase())).size !== entries.length
  )
    throw new Error('Use unique names of 1–60 characters.');
  return {
    entries,
    details: rows.map((r) => ({
      name: r[0].trim(),
      image: r[1]?.trim() ?? '',
      description: r[2]?.trim() ?? '',
      link: r[3]?.trim() ?? '',
    })),
  };
}
export function EntryEditor({
  entries,
  setEntries,
  details,
  setDetails,
}: {
  entries: string[];
  setEntries: (v: string[]) => void;
  details: EntryDetails[];
  setDetails: (v: EntryDetails[]) => void;
}) {
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  function load(text: string) {
    try {
      const result = parseEntries(text);
      setEntries(result.entries);
      setDetails(result.details);
      setError('Entries imported.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function move(i: number, j: number) {
    const next = [...entries],
      meta = [...details];
    [next[i], next[j]] = [next[j], next[i]];
    [meta[i], meta[j]] = [meta[j] ?? {}, meta[i] ?? {}];
    setEntries(next);
    setDetails(meta);
  }
  return (
    <>
      <details className="import-panel">
        <summary>Paste entries or import CSV</summary>
        <p>
          One name per line, or CSV columns: name, image URL, description, link.
          An optional header is supported.
        </p>
        <textarea
          aria-label="Paste contenders"
          rows={4}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
        <button className="secondary" onClick={() => load(source)}>
          Import pasted entries
        </button>
        <label>
          CSV file
          <input
            type="file"
            accept=".csv,.txt"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > 64000) {
                  setError('Keep imports under 64 KB.');
                  return;
                }
                load(await f.text());
              }
            }}
          />
        </label>
        {error && <output>{error}</output>}
      </details>
      <div className="rich-entry-list">
        {entries.map((entry, i) => (
          <div className="rich-entry" key={i}>
            <div className="entry-field">
              <span>{i + 1}</span>
              <input
                aria-label={`Contender ${i + 1}`}
                maxLength={60}
                value={entry}
                onChange={(e) =>
                  setEntries(
                    entries.map((v, j) => (j === i ? e.target.value : v)),
                  )
                }
              />
              <button
                aria-label={`Move contender ${i + 1} up`}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                ↑
              </button>
              <button
                aria-label={`Move contender ${i + 1} down`}
                disabled={i === entries.length - 1}
                onClick={() => move(i, i + 1)}
              >
                ↓
              </button>
            </div>
            <details>
              <summary>Artwork & details</summary>
              {(['image', 'description', 'link'] as const).map((key) => (
                <label key={key}>
                  {key === 'image'
                    ? 'Image URL'
                    : key === 'link'
                      ? 'Learn more URL'
                      : 'Description'}
                  <input
                    value={details[i]?.[key] ?? ''}
                    maxLength={key === 'description' ? 240 : 2000}
                    onChange={(e) =>
                      setDetails(
                        entries.map((_, j) =>
                          j === i
                            ? { ...details[j], [key]: e.target.value }
                            : (details[j] ?? {}),
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </details>
          </div>
        ))}
      </div>
    </>
  );
}
export function RoomExtras({
  game,
  onMessage,
}: {
  game: BracketView;
  onMessage: (s: string) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [reason, setReason] = useState('');
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const eligible = game.rounds[game.current].filter((m) => m.canVote);
  const picked = eligible.filter((m) => m.pick !== undefined).length;
  const remaining = Math.max(0, (game.settings.deadlineAt ?? 0) - now);
  const hours = Math.floor(remaining / 3600000),
    minutes = Math.floor(remaining / 60000) % 60;
  return (
    <section className="room-extras">
      <div className="participation">
        <strong>
          {game.lifecycle === 'active' ? 'Your round progress' : game.lifecycle}
        </strong>
        <span>
          {picked} / {eligible.length} votes cast
        </span>
        <progress max={eligible.length || 1} value={picked} />
        <small>{game.participants ?? 0} participants in this round</small>
      </div>
      {game.settings.deadlineEnabled && !game.champion && (
        <p>
          {remaining ? `${hours}h ${minutes}m remaining` : 'Deadline due'} ·
          checked when this bracket is accessed.
        </p>
      )}
      {game.extensionReason && <p className="notice">{game.extensionReason}</p>}
      {game.creatorId && (
        <a href={`/creator/${game.creatorId}`}>View creator profile →</a>
      )}
      <a className="secondary" href={`/?copy=${game.id}`}>
        Duplicate this bracket
      </a>
      {game.owner && (
        <a className="secondary" href="/dashboard">
          Open creator dashboard
        </a>
      )}
      <details>
        <summary>Report this bracket</summary>
        <label>
          What should we review?
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
        </label>
        <button
          className="secondary"
          onClick={() =>
            api('/api/community', { action: 'report', id: game.id, reason })
              .then(() => {
                setReason('');
                onMessage('Report submitted.');
              })
              .catch((e) => onMessage(e.message))
          }
        >
          Submit report
        </button>
      </details>
    </section>
  );
}
