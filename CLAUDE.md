# CLAUDE.md

Small TypeScript checkout service used to demo monitoring-driven auto-fixes.

## Conventions

- Money is always an integer number of cents in storage and calculations.
- Never mutate function arguments; return new objects/arrays.
- Every promise must be awaited or explicitly handled. Never swallow errors silently.
- Tests use `node:test` and live next to the code as `*.test.ts`.

## Fixing bugs and incidents

- Scope: change only the behavior the issue describes. Doc comments tell you what correct behavior is; they do not authorize implementing other missing or broken behavior. Report anything else you notice instead of fixing it.
- If an unrelated failing test or bug blocks verification, stop and report it as blocking. Do not repair it.
- Reproduce first: make sure a test fails because of the reported behavior, then fix the root cause.
- Never "fix" a crash by catching and ignoring the error.
- If the intended behavior is unclear, report that instead of guessing.

## Review guidelines

- Write all review comments in Traditional Chinese (繁體中文). Keep code identifiers in English.
- Focus on correctness, security and data integrity. Skip formatting nits.
