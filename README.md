# Bracket Club

A shared bracket game with 4, 8, 16, or 32 contenders, per-browser voting, host-controlled rounds, and durable D1 storage. Ties must receive more votes before advancing. Host access is held in an HTTP-only browser cookie; keep the creating browser's cookies to manage its brackets. Voting is intended for casual groups, not verified-person elections.

## Development

Install with `npm install`, run `npm run db:generate` after schema changes, apply the generated migration to local D1, and start `npm run dev`. Build with `npm run build`.

## Validation

`node tests/flow.mjs` checks creation, shared state, authorization, vote changes, concurrent voting, tie handling, advancement, stale rounds, champion selection, and input validation against a running local server.

The optional `configure_bracket` WebMCP tool is feature-detected. No supported WebMCP validation context was available during implementation, so its runtime contract was not verified. Browser UI testing was not requested.
