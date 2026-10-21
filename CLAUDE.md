# CLAUDE.md

Small TypeScript checkout service used to demo monitoring-driven auto-fixes.

## Conventions

- Money is always an integer number of cents in storage and calculations.
- Never mutate function arguments; return new objects/arrays.
- Every promise must be awaited or explicitly handled. Never swallow errors silently.
- Tests use `node:test` and live next to the code as `*.test.ts`.

## Fixing bugs and incidents

- Reproduce first: add a failing test that captures the reported behavior, then fix the root cause.
- Follow the behavior documented in doc comments; if the intended behavior is unclear, ask on the issue instead of guessing.
- Never "fix" a crash by catching and ignoring the error.
- Run `npm ci` once, then `npm test` and `npm run typecheck` before every commit. Do not push if either fails.

## Review guidelines

- Write all review comments in Traditional Chinese (繁體中文). Keep code identifiers in English.
- Focus on correctness, security and data integrity. Skip formatting nits.
