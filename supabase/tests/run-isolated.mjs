// Disposable in-memory PostgreSQL. Never reads application credentials or URLs.
// Auth/Realtime fixtures exercise SQL policies, not hosted service behavior.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';

const db = new PGlite({ extensions: { vector } });
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, aud text, role text, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
      )::uuid
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create schema realtime;
    create function realtime.topic() returns text language sql stable as $$
      select nullif(current_setting('realtime.topic', true), '')
    $$;
    create table realtime.messages(
      id uuid primary key default gen_random_uuid(),
      topic text not null, extension text not null,
      payload jsonb, event text, private boolean default false,
      updated_at timestamp not null default now(),
      inserted_at timestamp not null default now()
    );
    alter table realtime.messages enable row level security;
    grant usage on schema realtime to anon, authenticated;
    grant execute on function realtime.topic() to anon, authenticated;
    grant select, insert on realtime.messages to anon, authenticated;
  `);
  await db.exec(await fs.readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  const results = await db.exec(await fs.readFile(new URL('rls.sql', import.meta.url), 'utf8'));
  const checks = results.flatMap(result => result.rows ?? []).filter(row => row.test);
  assert.ok(checks.length >= 76, 'Expected behavioral assertions were not executed');
  const rollback = await db.query(`select
    (select count(*)::int from auth.users) as users,
    to_regprocedure('public.archelens_test_count(text,bigint,text)') is null as helpers_removed`);
  assert.equal(rollback.rows[0].users, 0, 'Test Auth fixtures must roll back');
  assert.equal(rollback.rows[0].helpers_removed, true, 'Test helpers must roll back');
  console.log(`${checks.length} SQL policy assertions passed; all test fixtures rolled back.`);
  console.log('Isolated PostgreSQL/PGlite + pgvector; hosted Auth, Realtime and Dashboard configuration are not integration-tested.');
} finally {
  await db.close();
}
