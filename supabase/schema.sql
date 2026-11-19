-- ArcheLens Open Source: apply ONCE to a fresh, dedicated Supabase project.
-- This is not an in-place migration of an existing ArcheLens database.
-- Requires Supabase Auth, Realtime and pgvector. No service-role key is needed.
begin;

create schema if not exists extensions;
create extension if not exists vector with schema extensions;
-- Fail clearly instead of accidentally using a differently located extension.
do $$
begin
  if not exists (
    select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'vector' and n.nspname = 'extensions'
  ) then
    raise exception 'Enable pgvector in the extensions schema in a fresh project.';
  end if;
  if to_regclass('realtime.messages') is null then
    raise exception 'Supabase Realtime must be installed before this baseline.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'realtime.messages'::regclass) then
    raise exception 'The managed realtime.messages table must already have RLS enabled.';
  end if;
end $$;

revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant usage on schema extensions to authenticated;
-- Avoid Supabase project-specific broad default grants on future app objects.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  result_json jsonb not null,
  image_url text,
  created_at timestamptz not null default now()
);

create table public.artifact_embeddings (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  content text not null check (char_length(content) <= 100000),
  embedding extensions.vector(768) not null
);
create index artifact_embeddings_analysis_idx on public.artifact_embeddings(analysis_id);
create index artifact_embeddings_vector_idx on public.artifact_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);
create index analyses_owner_idx on public.analyses(owner_id);

create table public.analysis_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  result_json jsonb not null,
  image_url text,
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);
create index analysis_workspaces_owner_idx on public.analysis_workspaces(owner_id);

-- The composite FK proves who owns the workspace without recursive RLS or a
-- SECURITY DEFINER helper. Owners can invite an existing Auth user by UUID.
create table public.workspace_members (
  workspace_id uuid not null,
  workspace_owner_id uuid not null default auth.uid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  foreign key (workspace_id, workspace_owner_id)
    references public.analysis_workspaces(id, owner_id) on delete cascade
);
create index workspace_members_user_idx on public.workspace_members(user_id, workspace_id);

create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.analysis_workspaces(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_name text not null check (char_length(user_name) between 1 and 200),
  user_color text not null check (user_color ~ '^#[0-9A-Fa-f]{6}$'),
  type text not null check (type in ('draw', 'text', 'marker')),
  data jsonb not null check (octet_length(data::text) <= 262144),
  created_at timestamptz not null default now()
);
create index annotations_workspace_idx on public.annotations(workspace_id);
create index annotations_author_idx on public.annotations(user_id);

create table public.museums (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 500),
  description text not null default '',
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
create index museums_owner_idx on public.museums(owner_id);
create table public.museum_rooms (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 500),
  layout text not null default 'square' check (layout in ('square', 'gallery', 'circular')),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
create index museum_rooms_museum_idx on public.museum_rooms(museum_id);
create table public.museum_artifacts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.museum_rooms(id) on delete cascade,
  artifact_id text not null,
  artifact_data jsonb not null,
  artifact_image text constraint museum_artifact_image_safe check (
    artifact_image is null or (
      case when octet_length(artifact_image) <= 2796227
        and artifact_image ~ '^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
      then
        octet_length(decode(split_part(artifact_image, ',', 2), 'base64')) <= 2097152
        and case
          when artifact_image like 'data:image/png;base64,%' then
            substring(decode(split_part(artifact_image, ',', 2), 'base64') from 1 for 8) = decode('89504e470d0a1a0a', 'hex')
          when artifact_image like 'data:image/jpeg;base64,%' then
            substring(decode(split_part(artifact_image, ',', 2), 'base64') from 1 for 3) = decode('ffd8ff', 'hex')
          when artifact_image like 'data:image/webp;base64,%' then
            substring(decode(split_part(artifact_image, ',', 2), 'base64') from 1 for 4) = decode('52494646', 'hex')
            and substring(decode(split_part(artifact_image, ',', 2), 'base64') from 9 for 4) = decode('57454250', 'hex')
          else false
        end
      else false end
    )
  ),
  position jsonb not null default '{"x":0,"y":0,"z":0}',
  rotation jsonb not null default '{"x":0,"y":0,"z":0}',
  scale double precision not null default 1 check (scale > 0 and scale <= 100),
  created_at timestamptz not null default now()
);
create index museum_artifacts_room_idx on public.museum_artifacts(room_id);

-- Identity/parent links cannot be reassigned, even between two owned resources.
-- Both old-row USING and new-row WITH CHECK predicates still enforce ownership.
create schema archelens_private;
revoke all on schema archelens_private from public, anon, authenticated;
create function archelens_private.keep_identity() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare i integer;
begin
  for i in 0..tg_nargs - 1 loop
    if pg_catalog.to_jsonb(new) -> tg_argv[i]
       is distinct from pg_catalog.to_jsonb(old) -> tg_argv[i] then
      raise exception 'Resource identity and ownership cannot be reassigned' using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;
revoke all on function archelens_private.keep_identity() from public, anon, authenticated;
create trigger analyses_identity before update on public.analyses
  for each row execute function archelens_private.keep_identity('id', 'owner_id');
create trigger embeddings_identity before update on public.artifact_embeddings
  for each row execute function archelens_private.keep_identity('id', 'analysis_id');
create trigger workspaces_identity before update on public.analysis_workspaces
  for each row execute function archelens_private.keep_identity('id', 'owner_id');
create trigger annotations_identity before update on public.annotations
  for each row execute function archelens_private.keep_identity('id', 'workspace_id', 'user_id');
create trigger museums_identity before update on public.museums
  for each row execute function archelens_private.keep_identity('id', 'owner_id');
create trigger rooms_identity before update on public.museum_rooms
  for each row execute function archelens_private.keep_identity('id', 'museum_id');
create trigger artifacts_identity before update on public.museum_artifacts
  for each row execute function archelens_private.keep_identity('id', 'room_id');

alter table public.analyses enable row level security;
alter table public.artifact_embeddings enable row level security;
alter table public.analysis_workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.annotations enable row level security;
alter table public.museums enable row level security;
alter table public.museum_rooms enable row level security;
alter table public.museum_artifacts enable row level security;

revoke all on public.analyses, public.artifact_embeddings, public.analysis_workspaces,
  public.workspace_members, public.annotations, public.museums, public.museum_rooms,
  public.museum_artifacts from public, anon, authenticated;
grant select, insert, update, delete on public.analyses, public.artifact_embeddings,
  public.analysis_workspaces, public.annotations, public.museums, public.museum_rooms,
  public.museum_artifacts to authenticated;
grant select, insert, delete on public.workspace_members to authenticated;
grant select on public.museums, public.museum_rooms, public.museum_artifacts to anon;

create policy analyses_read on public.analyses for select to authenticated
  using (owner_id = (select auth.uid()));
create policy analyses_create on public.analyses for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy analyses_edit on public.analyses for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy analyses_delete on public.analyses for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy embeddings_read on public.artifact_embeddings for select to authenticated
  using (exists (select 1 from public.analyses a where a.id = analysis_id and a.owner_id = (select auth.uid())));
create policy embeddings_create on public.artifact_embeddings for insert to authenticated
  with check (exists (select 1 from public.analyses a where a.id = analysis_id and a.owner_id = (select auth.uid())));
create policy embeddings_edit on public.artifact_embeddings for update to authenticated
  using (exists (select 1 from public.analyses a where a.id = analysis_id and a.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.analyses a where a.id = analysis_id and a.owner_id = (select auth.uid())));
create policy embeddings_delete on public.artifact_embeddings for delete to authenticated
  using (exists (select 1 from public.analyses a where a.id = analysis_id and a.owner_id = (select auth.uid())));

create policy members_read on public.workspace_members for select to authenticated
  using (user_id = (select auth.uid()) or workspace_owner_id = (select auth.uid()));
create policy members_invite on public.workspace_members for insert to authenticated
  with check (workspace_owner_id = (select auth.uid()));
create policy members_remove on public.workspace_members for delete to authenticated
  using (workspace_owner_id = (select auth.uid()));
create policy workspaces_read on public.analysis_workspaces for select to authenticated
  using (owner_id = (select auth.uid()) or exists (
    select 1 from public.workspace_members m where m.workspace_id = id and m.user_id = (select auth.uid())
  ));
create policy workspaces_create on public.analysis_workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy workspaces_edit on public.analysis_workspaces for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy workspaces_delete on public.analysis_workspaces for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy annotations_read on public.annotations for select to authenticated
  using (exists (select 1 from public.analysis_workspaces w where w.id = workspace_id));
create policy annotations_create on public.annotations for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.analysis_workspaces w where w.id = workspace_id
  ));
create policy annotations_edit on public.annotations for update to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.analysis_workspaces w where w.id = workspace_id))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.analysis_workspaces w where w.id = workspace_id));
create policy annotations_delete on public.annotations for delete to authenticated
  using (exists (select 1 from public.analysis_workspaces w where w.id = workspace_id
    and (w.owner_id = (select auth.uid()) or annotations.user_id = (select auth.uid()))));

create policy museums_read on public.museums for select to anon, authenticated
  using (is_public or owner_id = (select auth.uid()));
create policy museums_create on public.museums for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy museums_edit on public.museums for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy museums_delete on public.museums for delete to authenticated
  using (owner_id = (select auth.uid()));
create policy rooms_read on public.museum_rooms for select to anon, authenticated
  using (exists (select 1 from public.museums m where m.id = museum_id
    and (m.owner_id = (select auth.uid()) or (m.is_public and museum_rooms.is_public))));
create policy rooms_create on public.museum_rooms for insert to authenticated
  with check (exists (select 1 from public.museums m where m.id = museum_id and m.owner_id = (select auth.uid())));
create policy rooms_edit on public.museum_rooms for update to authenticated
  using (exists (select 1 from public.museums m where m.id = museum_id and m.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.museums m where m.id = museum_id and m.owner_id = (select auth.uid())));
create policy rooms_delete on public.museum_rooms for delete to authenticated
  using (exists (select 1 from public.museums m where m.id = museum_id and m.owner_id = (select auth.uid())));
create policy artifacts_read on public.museum_artifacts for select to anon, authenticated
  using (exists (select 1 from public.museum_rooms r join public.museums m on m.id = r.museum_id
    where r.id = room_id and (m.owner_id = (select auth.uid()) or (m.is_public and r.is_public))));
create policy artifacts_create on public.museum_artifacts for insert to authenticated
  with check (exists (select 1 from public.museum_rooms r join public.museums m on m.id = r.museum_id
    where r.id = room_id and m.owner_id = (select auth.uid())));
create policy artifacts_edit on public.museum_artifacts for update to authenticated
  using (exists (select 1 from public.museum_rooms r join public.museums m on m.id = r.museum_id
    where r.id = room_id and m.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.museum_rooms r join public.museums m on m.id = r.museum_id
    where r.id = room_id and m.owner_id = (select auth.uid())));
create policy artifacts_delete on public.museum_artifacts for delete to authenticated
  using (exists (select 1 from public.museum_rooms r join public.museums m on m.id = r.museum_id
    where r.id = room_id and m.owner_id = (select auth.uid())));

-- Executes under the caller's RLS; matches only the caller's private analyses.
create function public.match_artifacts(
  query_embedding extensions.vector(768),
  match_threshold double precision default 0.65,
  match_count integer default 10
) returns table (id uuid, analysis_id uuid, content text, similarity double precision)
language sql stable security invoker set search_path = '' as $$
  select e.id, e.analysis_id, e.content,
    1 - (e.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.artifact_embeddings e
  where 1 - (e.embedding operator(extensions.<=>) query_embedding)
    > greatest(-1.0, least(1.0, coalesce(match_threshold, 0.65)))
  order by e.embedding operator(extensions.<=>) query_embedding, e.id
  limit greatest(0, least(coalesce(match_count, 10), 50));
$$;
revoke all on function public.match_artifacts(extensions.vector, double precision, integer)
  from public, anon, authenticated;
grant execute on function public.match_artifacts(extensions.vector, double precision, integer) to authenticated;

-- Do NOT ALTER the Supabase-managed realtime.messages table: it already has RLS.
-- This guard also prevents broader permissive policies from opening these topics.
create policy archelens_channel_guard on realtime.messages as restrictive for all to anon, authenticated
  using (topic = (select realtime.topic()) and extension in ('broadcast', 'presence') and (select auth.uid()) is not null and exists (
    select 1 from public.analysis_workspaces w where 'analysis:' || w.id::text = (select realtime.topic())
  ))
  with check (topic = (select realtime.topic()) and extension in ('broadcast', 'presence') and (select auth.uid()) is not null and exists (
    select 1 from public.analysis_workspaces w where 'analysis:' || w.id::text = (select realtime.topic())
  ));
create policy archelens_channel_read on realtime.messages for select to authenticated
  using (topic = (select realtime.topic()) and extension in ('broadcast', 'presence') and exists (
    select 1 from public.analysis_workspaces w where 'analysis:' || w.id::text = (select realtime.topic())
  ));
create policy archelens_channel_write on realtime.messages for insert to authenticated
  with check (topic = (select realtime.topic()) and extension in ('broadcast', 'presence') and exists (
    select 1 from public.analysis_workspaces w where 'analysis:' || w.id::text = (select realtime.topic())
  ));

comment on table public.analysis_workspaces is 'Private to owner and explicitly invited existing Auth users.';
comment on table public.workspace_members is 'Owner-managed memberships; composite FK validates owner claim without bypassing RLS.';
comment on function public.match_artifacts(extensions.vector, double precision, integer)
  is 'Private per-caller similarity search; 768 dimensions, maximum 50 results; SECURITY INVOKER.';
commit;
