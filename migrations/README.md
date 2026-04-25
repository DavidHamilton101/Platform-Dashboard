# Migrations

All database schema changes are managed through versioned SQL migration files.
Every migration **must** have both an UP and a DOWN file.

## Naming Convention

```
YYYYMMDD_NNN_description.up.sql
YYYYMMDD_NNN_description.down.sql
```

| Segment | Description |
|---|---|
| `YYYYMMDD` | Date the migration was authored (not run) |
| `NNN` | Three-digit sequence number, starting at `001` per day |
| `description` | Short snake_case summary of what the migration does |

**Example:**

```
20260425_001_create_usage_events.up.sql
20260425_001_create_usage_events.down.sql
```

## Rules

1. **Never edit a migration after it has been run** against any environment. Create a new migration instead.
2. **Every UP file must have a working DOWN file.** The DOWN file must fully reverse the UP — drop tables, remove columns, restore previous state.
3. **Always run against staging first.** Never run a migration directly against production without a successful staging run.
4. **Test the DOWN file.** Run the DOWN migration after the UP in a local environment to confirm it reverses cleanly before committing.
5. **Supabase RLS.** Any migration that creates a new table must also enable Row Level Security in the same UP file.
6. **Document the PR.** Every PR that includes a migration must list the migration filename in the PR description.

## Running Migrations

> Tooling to be added in Phase 1. Until then, run SQL files manually via the Supabase dashboard SQL editor or the `psql` CLI.

### Local / Development

```bash
psql $SUPABASE_URL -f migrations/YYYYMMDD_NNN_description.up.sql
```

### Rolling Back

```bash
psql $SUPABASE_URL -f migrations/YYYYMMDD_NNN_description.down.sql
```
