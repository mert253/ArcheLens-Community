# Database setup and access rules

Supabase is optional for the local artifact-analysis workflow. It provides
sign-in, private collaboration workspaces and museum persistence when enabled.
Use a **new, dedicated Supabase project** for this edition. Do not run this
baseline against an existing ArcheLens project or an existing data set.

## Apply the baseline once

1. Create a fresh Supabase project. Keep its database password outside Git.
2. Open its SQL Editor and execute all of [`supabase/schema.sql`](../supabase/schema.sql).
   The script is transactional and intentionally fails if its application tables
   already exist. Enable pgvector in the `extensions` schema if your project
   requires enabling it first; Supabase Auth and Realtime must be installed.
3. In Authentication, configure the sign-in provider and exact permitted app
   redirect URLs. Use real signed-in users for private features.
4. In the project's Realtime Settings, **disable “Allow public access”**.
   All collaboration channels must use `config: { private: true }` and a current
   signed-in user's access token. Channel topics are exactly
   `analysis:<workspace UUID>`.
5. Set the app's Supabase URL and **publishable/legacy anon key** as described in
   `.env.example`, and restart the frontend. Never put a service-role/secret key
   in browser configuration. These policies do not require one.

With `psql` installed, an alternative to SQL Editor is the following PowerShell
command. Set `ARCHELENS_DATABASE_URL` privately in the current shell to the
**new project's** PostgreSQL connection URI first:

```powershell
psql "$env:ARCHELENS_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/schema.sql
```

There is no dependency on the original project's data, credentials or migrations.
For CLI-managed deployments, see [`supabase/migrations/README.md`](../supabase/migrations/README.md).

## Access model

| Resource | Signed-out visitor | Signed-in owner | Invited workspace member |
| --- | --- | --- | --- |
| Analyses and vector embeddings | No access | Own rows only | No additional access |
| Workspaces | No access | Read, create, edit, delete | Read invited workspace |
| Workspace members | No access | Invite, list, remove | Read own membership |
| Annotations | No access | Read, create, edit own; delete any in own workspace | Read workspace; create/edit/delete own |
| Museums | Read intentionally public museums | Full access to own museums | Same as any signed-in visitor |
| Rooms and artifacts | Read only when **museum and room are both public** | Full access under own museum | Same as any signed-in visitor |
| Realtime broadcast and presence | No access | Own workspace topics | Invited workspace topics |

Every exposed application table has RLS and explicit least-privilege grants.
Private is the default. Authentication alone grants no cross-user access.
`workspace_members.workspace_owner_id` is checked against a composite foreign
key on the workspace, so a caller cannot claim ownership to invite themselves.
No `SECURITY DEFINER` function bypasses these policies. Ownership, primary IDs
and parent links are immutable: moving a room/artifact/annotation requires an
explicit new resource rather than reassignment.

Publishing a museum alone does not publish its rooms. Publishing a room in a
private museum also does not expose it. Set both publication flags intentionally.
### Persisted museum images

`museum_artifacts.artifact_image` accepts only `NULL` or a canonical, 2 MiB maximum Base64 data URL with matching PNG, JPEG or WebP signature. The same check runs in the browser and as a PostgreSQL CHECK constraint, so direct Data API writes cannot store arbitrary tracking URLs. Invalid or legacy values render as placeholders and never trigger arbitrary external image loads.

**Existing databases:** The file `supabase/schema.sql` is a fresh-project baseline, not a migration. Before changing an already deployed database, inventory affected `artifact_image` rows and take a verified backup. Create and test a separate, additive migration that rejects new bad writes without silently deleting old data; migrate existing images only after owner review. Do not run the fresh baseline over existing tables.

Museum artifact content is an explicitly published snapshot, not permission to
read the owner's private `analyses` rows. Unpublishing either parent hides its
descendants from visitors.

### Invite an existing user

The other person must first sign in to the same Supabase project. Obtain their
Auth UUID through your trusted project administration process; never expose
`auth.users` as a public directory. An authenticated workspace owner can execute:

```sql
insert into public.workspace_members (workspace_id, user_id)
values ('WORKSPACE_UUID'::uuid, 'MEMBER_AUTH_UUID'::uuid);
```

For the Dashboard SQL Editor, which normally runs as the database administrator,
replace all placeholders below and explicitly run the operation as the owner
under the authenticated role. The role/claim changes end with the transaction:

```sql
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'OWNER_AUTH_UUID';
set local request.jwt.claims = '{"sub":"OWNER_AUTH_UUID","role":"authenticated"}';
insert into public.workspace_members (workspace_id, user_id)
values ('WORKSPACE_UUID'::uuid, 'MEMBER_AUTH_UUID'::uuid);
commit;
```

To revoke access, use the same owner transaction with:

```sql
delete from public.workspace_members
where workspace_id = 'WORKSPACE_UUID'::uuid
  and user_id = 'MEMBER_AUTH_UUID'::uuid;
```

Database reads and new authorization checks reflect revocation immediately.
Supabase caches Realtime authorization on an existing connection until token
refresh/expiry. Use an appropriately short Auth JWT lifetime and reconnect or
refresh clients after membership changes; removing a membership does not instantly
disconnect an already authorized socket. Broadcast payload names/user IDs are
display data, not an independent proof of the sender's identity. Persisted
annotations bind the author to `auth.uid()`.

### Private vector search

`artifact_embeddings` has an existing `analyses` parent and inherits its private
owner scope through RLS. The optional `match_artifacts` RPC uses `SECURITY INVOKER`,
requires a signed-in caller, accepts 768-dimensional vectors, and clamps its
result count to 0–50. Choose an embedding configuration that actually emits 768
dimensions before writing to this optional table. This schema does not turn
process-local AI context into an automatic cloud backup or shared corpus.

## Regression tests

The isolated suite needs Node.js and downloads two pinned development packages.
It never loads `.env` files, application keys or remote database connections:

```powershell
npm ci --prefix supabase/tests
npm test --prefix supabase/tests
```

It applies the actual baseline to a fresh in-memory PostgreSQL engine (PGlite)
with pgvector and minimal local Supabase Auth/Realtime fixtures, then runs
[`rls.sql`](../supabase/tests/rls.sql) under `anon` and `authenticated` roles.
The suite tests anonymous publication visibility, cross-user CRUD, forged
ownership/authorship, owner invitations, member permissions and revocation,
immutable parent links, private bounded vector search, and broadcast/presence
policy checks. It also introduces an intentionally broad permissive Realtime
policy to verify that the restrictive workspace guard still holds. All test
users, assertions and message fixtures roll back.

For a real Supabase PostgreSQL check, first apply `schema.sql` to a **separate,
disposable test project**, then run the same SQL as its administrator:

```powershell
psql "$env:ARCHELENS_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```

This is a plain SQL suite; no pgTAP extension is required. A failing assertion
raises an error. `ON_ERROR_STOP=1` causes `psql` to exit unsuccessfully and closing
the connection rolls back an aborted transaction. In SQL Editor, execute the
entire file and issue `rollback` if an assertion aborts the transaction.

### Security proof gates

The regression suite covers **owner**, **other signed-in user**, **invited member**, and **signed-out visitor**. It checks public museum AND public room flags together, owner-bound CRUD, workspace invitation/revocation, and the new stored image CHECK constraint. A passing local PGlite test is necessary but does not verify the **currently deployed** project's policies.

Before any public release, run the same SQL against a *disposable* Supabase project, compare its effective policies/grants to `supabase/schema.sql`, review drift and only then schedule approved migrations. Do not run these experiments against a production account or silently overwrite private artifact data. Record the CI run and an operator's confirmation in `docs/security-release-checklist.md`.

The isolated test verifies PostgreSQL policies and pgvector behavior, not hosted
Auth sign-in, WebSocket joins, Supabase-managed schema permissions, or Dashboard
settings. Before deployment, run the SQL suite on your disposable Supabase
project, sign in as two different users, confirm the second cannot join the
first's channel before invitation, invite them, confirm presence/broadcast and
annotations, revoke them and reconnect. Verify that public-channel joins are
disabled in Realtime Settings. Do not add the `realtime` schema to the Data API's
exposed schemas or alter its managed tables; only the policies are customized.

## References

- [Supabase RLS and explicit grants](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase private Realtime authorization and cache behavior](https://supabase.com/docs/guides/realtime/authorization)
- [PGlite extension support](https://pglite.dev/extensions/)
