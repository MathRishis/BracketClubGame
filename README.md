# BracketClubGame

Bracket Club lets you create a tournament, share a voting link, and crown a champion together.

[Play Bracket Club](https://bracket-club-play.smita-chauri-6218.chatgpt.site)

## Features

- 4, 8, 16, or 32 contenders; the 32-entry bracket has 16 on each side and a center final.
- Optional starter kits: 32 famous movies, 16 video games, and 8 sitcoms.
- Phone-friendly round selection, left/right side selection, and large voting controls.
- Shared votes stored in Cloudflare D1, with host-controlled round advancement.
- One vote per matchup per browser, editable until the round closes. Ties need more votes before advancing.
- Optional two-group games assign each voter to Group A or Group B. Each group votes on one half while both groups remain visible; everyone votes in the final.
- Username/password accounts keep created brackets and voting history available across devices. Passwords use salted PBKDF2 hashes and sessions use HTTP-only cookies.
- Worldwide brackets appear in the public discovery area and can use automatic round deadlines, minimum voter thresholds, and configurable extensions.
- Creator controls include visibility, voting format, deadline rules, and four bracket color themes.

Anonymous host access remains in an HTTP-only browser cookie. Signed-in creators can manage their new brackets from any device. Voting is intended for casual groups, not verified-person elections.

## Development

Install with `npm install`, run `npm run db:generate` after schema changes, apply the generated migration to local D1, and start `npm run dev`. Build with `npm run build`.

The application runs on Cloudflare Workers with a D1 binding named `DB`. GitHub stores the source; GitHub Pages cannot host its voting backend. The `.openai/hosting.json` file identifies the existing Sites deployment and contains no credentials.

## Validation

`node tests/flow.mjs` checks the original creation and voting flow. `node tests/features.mjs` checks accounts, durable ownership, voting history, two-group enforcement, worldwide discovery, customization, deadline extension, and automatic advancement against a running local server.

The optional `configure_bracket` WebMCP tool is feature-detected. No supported WebMCP validation context was available during implementation, so its runtime contract was not verified. Browser UI testing was not requested.

## Community upgrade

The creator dashboard lives at `/dashboard`; instructions live at `/help`. Worldwide listings require explicit administrator approval. Accounts are never promoted based on username. Email, OAuth, browser push, and visitor-independent scheduled jobs are deferred.

Round deadlines and scheduled openings are evaluated on bracket access. Every matchup must meet the minimum vote count and have a clear winner. Anonymous participation can be claimed explicitly, preserving group assignment; existing account participation is skipped.

Validation: `node tests/flow.mjs`, `node tests/features.mjs`, `node tests/community.mjs`, `node tests/moderation.mjs`, `npx tsc --noEmit`, and `npm run build`. Moderation tests are local-only and create a temporary local administrator.

### Release operations

`/api/operations` accepts only the server-configured `OPERATIONS_SECRET` bearer credential. Set it as a secret through Sites. It is never included in client code. Actions: `maintenance` with `enabled`, one-time `reset` (requires maintenance), and `assign-admin` with an explicitly verified `accountId` and `username`. Admin assignment occurs only after the owner creates and identifies their new account.

The authorized fresh start clears all user accounts and game data, including participation and notifications. It is guarded by a durable `fresh-start-complete` marker. A code backup branch is not a database backup. Disable maintenance after checking empty tables, then verify a disposable signup and delete that test account. No user account is created on the owner's behalf.
