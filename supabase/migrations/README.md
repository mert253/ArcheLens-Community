# Schema baseline

For a **new, dedicated Supabase project**, apply [`../schema.sql`](../schema.sql)
once. It is the complete, transactional schema baseline, not an upgrade for an
existing deployment. See [`../../docs/database.md`](../../docs/database.md).

There is deliberately no fabricated CLI migration history. When adopting the
Supabase CLI, first inspect `supabase migration new --help`, create a migration
with `supabase migration new initial_schema`, and copy `schema.sql` into the
generated file before applying it to a fresh local project. Do not apply both
the baseline and that migration to the same database.
