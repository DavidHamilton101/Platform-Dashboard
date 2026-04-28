# utils

Shared utilities used across all modules.

## Modules

| File | Purpose |
|---|---|
| `env-validator.ts` | Validates all required environment variables on startup using Zod; fails fast with missing variable names (never values) |
| `logger.ts` | Pino-based structured logger; JSON in production, human-readable in development; redacts credentials from all output |
| `error-handler.ts` | Typed custom error classes (`ApiError`, `StorageError`, `ValidationError`, `AlertError`) with severity levels |

## Rules

- No module outside `utils` should use `console.log` — use `createModuleLogger` instead
- Never add business logic here — utilities only
- Every export must be unit-tested in `/tests/utils/`
