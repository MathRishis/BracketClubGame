'use client';
/* oxlint-disable next/no-html-link-for-pages */

import { useEffect, useState } from 'react';
import { ArrowRight, LogOut, Trophy, UserRound } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export type AccountView = { id: string; username: string; displayName: string };
type Summary = {
  id: string;
  title: string;
  description: string;
  size: number;
  current: number;
  champion?: string;
  total: number;
  settings: { visibility: string; mode: string };
  viewerGroup?: string | null;
};
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountView | null;
  onAccount: (account: AccountView | null) => void;
  onMessage: (message: string) => void;
};

async function accountRequest(data?: unknown) {
  const response = await fetch('/api/account', {
    method: data ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = (await response.json()) as {
    account: AccountView | null;
    error?: string;
  };
  if (!response.ok)
    throw new Error(result.error || 'Unable to access your account.');
  return result;
}

function BracketList({
  title,
  brackets,
}: {
  title: string;
  brackets: Summary[];
}) {
  return (
    <section className="account-list">
      <h3>{title}</h3>
      {brackets.length === 0 ? (
        <p className="empty-state">Nothing here yet.</p>
      ) : (
        brackets.map((bracket) => (
          <a
            className="account-bracket"
            href={`/?b=${bracket.id}`}
            key={bracket.id}
          >
            <span>
              <strong>{bracket.title}</strong>
              <small>
                {bracket.size} entries · {bracket.total} votes
                {bracket.viewerGroup ? ` · Group ${bracket.viewerGroup}` : ''}
              </small>
            </span>
            {bracket.champion ? (
              <span className="winner-mini">
                <Trophy size={14} /> {bracket.champion}
              </span>
            ) : (
              <ArrowRight size={17} />
            )}
          </a>
        ))
      )}
    </section>
  );
}

export function AccountPanel({
  open,
  onOpenChange,
  account,
  onAccount,
  onMessage,
}: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [owned, setOwned] = useState<Summary[]>([]);
  const [voted, setVoted] = useState<Summary[]>([]);

  useEffect(() => {
    if (!open || !account) return;
    fetch('/api/account/brackets')
      .then(async (response) => {
        const result = (await response.json()) as {
          owned?: Summary[];
          voted?: Summary[];
          error?: string;
        };
        if (!response.ok) throw new Error(result.error);
        setOwned(result.owned ?? []);
        setVoted(result.voted ?? []);
      })
      .catch((reason) => setError(reason.message));
  }, [open, account]);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const result = await accountRequest({
        action: mode,
        username,
        password,
        displayName,
      });
      onAccount(result.account);
      setPassword('');
      onMessage(
        mode === 'signup'
          ? 'Account created. New brackets and votes will appear here.'
          : 'Welcome back.',
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await accountRequest({ action: 'logout' });
      onAccount(null);
      setOwned([]);
      setVoted([]);
      onOpenChange(false);
      onMessage('Signed out.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="account-sheet">
        <SheetHeader>
          <SheetTitle>
            {account
              ? `Hi, ${account.displayName}`
              : 'Your Bracket Club account'}
          </SheetTitle>
          <SheetDescription>
            {account
              ? 'Your brackets and voting history stay with you across devices.'
              : 'Sign in to save the brackets you create and the votes you cast.'}
          </SheetDescription>
        </SheetHeader>
        <div className="account-body">
          {account ? (
            <>
              <div className="account-identity">
                <span>
                  <UserRound size={20} />
                </span>
                <div>
                  <strong>{account.displayName}</strong>
                  <small>@{account.username}</small>
                </div>
                <button className="secondary" disabled={busy} onClick={signOut}>
                  <LogOut size={16} /> Sign out
                </button>
              </div>
              <a className="primary" href="/dashboard">
                Dashboard, inbox & account settings <ArrowRight size={17} />
              </a>
              <BracketList title="Created by you" brackets={owned} />
              <BracketList title="Your voting history" brackets={voted} />
            </>
          ) : (
            <div className="auth-card">
              <div className="auth-tabs">
                <button
                  className={mode === 'login' ? 'active' : ''}
                  onClick={() => setMode('login')}
                >
                  Sign in
                </button>
                <button
                  className={mode === 'signup' ? 'active' : ''}
                  onClick={() => setMode('signup')}
                >
                  Create account
                </button>
              </div>
              {mode === 'signup' && (
                <>
                  <label htmlFor="display-name">Display name</label>
                  <input
                    id="display-name"
                    autoComplete="name"
                    maxLength={40}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </>
              )}
              <label htmlFor="account-username">Username</label>
              <input
                id="account-username"
                autoCapitalize="none"
                autoComplete="username"
                maxLength={24}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              <label htmlFor="account-password">Password</label>
              <input
                id="account-password"
                type="password"
                autoComplete={
                  mode === 'signup' ? 'new-password' : 'current-password'
                }
                maxLength={100}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void submit();
                }}
              />
              {error && <output className="form-error">{error}</output>}
              <button className="primary" disabled={busy} onClick={submit}>
                {busy
                  ? 'Please wait…'
                  : mode === 'signup'
                    ? 'Create my account'
                    : 'Sign in'}{' '}
                <ArrowRight size={17} />
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
