# BracketClubGame

Bracket Club lets you create a tournament, share a voting link, and crown a champion together.

[Play Bracket Club](https://bracket-club-play.smita-chauri-6218.chatgpt.site)

## Features

- 4, 8, 16, or 32 contenders; the 32-entry bracket has 16 on each side and a center final.
- Optional starter kits: 32 famous movies, 16 video games, and 8 sitcoms.
- Phone-friendly round selection, left/right side selection, and large voting controls.
- Shared votes stored in Cloudflare D1, with host-controlled round advancement.
- One vote per matchup per browser, editable until the round closes. Ties need more votes before advancing.

Host access is held in an HTTP-only browser cookie. Keep the creating browser's cookies to manage its brackets. Voting is intended for casual groups, not verified-person elections.

## Development

Install with `npm install`, run `npm run db:generate` after schema changes, apply the generated migration to local D1, and start `npm run dev`. Build with `npm run build`.

The application runs on Cloudflare Workers with a D1 binding named `DB`. GitHub stores the source; GitHub Pages cannot host its voting backend. The `.openai/hosting.json` file identifies the existing Sites deployment and contains no credentials.

## Validation

`node tests/flow.mjs` checks creation, shared state, authorization, vote changes, concurrent voting, ties, all five rounds of a 32-entry bracket, champion selection, starter kits, and input validation against a running local server.

The optional `configure_bracket` WebMCP tool is feature-detected. No supported WebMCP validation context was available during implementation, so its runtime contract was not verified. Browser UI testing was not requested.
