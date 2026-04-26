# tests

Unit and integration tests using [Vitest](https://vitest.dev).

## Structure

```
tests/
  utils/          # Unit tests for /src/utils
  ingestion/      # Unit tests for /src/ingestion (Phase 1)
  storage/        # Unit tests for /src/storage (Phase 1)
  analysis/       # Unit tests for /src/analysis (Phase 2)
  api/            # Integration tests for /src/api (Phase 1)
```

## Running tests

```bash
npm test               # Run all tests once
npm run test:watch     # Watch mode
npm test -- --coverage # Run with coverage report
```

## Coverage requirement

All PRs must meet a minimum of **70%** across lines, functions, branches, and statements.
The threshold is enforced in `vitest.config.ts` and checked by CI on every PR.

## Conventions

- Test files are named `<module>.test.ts` and mirror the `src/` path under `tests/`
- No real network calls in unit tests — mock or stub all external services
- Integration tests (in `tests/api/`) may use a local Supabase instance
- Never commit `.env.*` files or real credentials to the test directory
