-- Run as the database administrator on a DISPOSABLE Supabase test project.
-- Every fixture and helper is rolled back. Any failed assertion aborts the run.
-- psql "$env:ARCHELENS_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
begin;

-- A deliberately broad test policy proves that the restrictive guard still
-- rejects unrelated topics if another permissive policy is later introduced.
create policy archelens_test_realtime_allow on realtime.messages for all to anon, authenticated
  using (true) with check (true);

create function public.archelens_test_count(query_sql text, expected bigint, label text)
returns text language plpgsql security invoker set search_path = '' as $$
declare actual bigint;
begin
  execute query_sql into actual;
  if actual is distinct from expected then
    raise exception '%: expected %, got %', label, expected, actual;
  end if;
  return label;
end $$;
create function public.archelens_test_changes(query_sql text, expected bigint, label text)
returns text language plpgsql security invoker set search_path = '' as $$
declare actual bigint;
begin
  execute query_sql;
  get diagnostics actual = row_count;
  if actual is distinct from expected then
    raise exception '%: expected % affected rows, got %', label, expected, actual;
  end if;
  return label;
end $$;
create function public.archelens_test_denied(query_sql text, expected_code text, label text)
returns text language plpgsql security invoker set search_path = '' as $$
begin
  begin
    execute query_sql;
  exception when others then
    if sqlstate = expected_code then return label; end if;
    raise exception '%: expected SQLSTATE %, got % (%)', label, expected_code, sqlstate, sqlerrm;
  end;
  raise exception '%: operation unexpectedly succeeded', label;
end $$;
grant execute on function public.archelens_test_count(text,bigint,text),
  public.archelens_test_changes(text,bigint,text), public.archelens_test_denied(text,text,text)
  to anon, authenticated;

insert into auth.users(id,aud,role,email) values
  ('10000000-0000-4000-8000-000000000001','authenticated','authenticated','owner@archelens-test.invalid'),
  ('10000000-0000-4000-8000-000000000002','authenticated','authenticated','other@archelens-test.invalid'),
  ('10000000-0000-4000-8000-000000000003','authenticated','authenticated','member@archelens-test.invalid');

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.archelens_test_changes($q$insert into public.analyses(id,title,result_json)
  values ('a0000000-0000-4000-8000-000000000001','Owner analysis','{}')$q$,1,'owner creates private analysis') as test;
insert into public.artifact_embeddings(analysis_id,content,embedding)
  select 'a0000000-0000-4000-8000-000000000001','owner-' || n,
    ('[1,' || repeat('0,',766) || '0]')::extensions.vector from generate_series(1,55) n;
insert into public.analysis_workspaces(id,title,result_json)
  values ('b0000000-0000-4000-8000-000000000001','Owner workspace','{}');
insert into public.annotations(id,workspace_id,user_name,user_color,type,data)
  values ('f0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Owner','#123456','text','{}');
insert into public.museums(id,name,is_public) values
  ('c0000000-0000-4000-8000-000000000001','Private museum',false),
  ('c0000000-0000-4000-8000-000000000003','Public museum',true);
insert into public.museum_rooms(id,museum_id,name,is_public) values
  ('d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','Private room',false),
  ('d0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000003','Public room',true),
  ('d0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000001','Public room private parent',true),
  ('d0000000-0000-4000-8000-000000000005','c0000000-0000-4000-8000-000000000003','Private room public parent',false);
insert into public.museum_artifacts(id,room_id,artifact_id,artifact_data) values
  ('e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','private','{}'),
  ('e0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000003','public','{}'),
  ('e0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000004','private-parent','{}'),
  ('e0000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000005','private-room','{}');
-- Stored museum images must be safe even when clients bypass the React validator.
select public.archelens_test_denied($q$insert into public.museum_artifacts(room_id,artifact_id,artifact_data,artifact_image) values ('d0000000-0000-4000-8000-000000000003','tracker','{}','https://tracker.invalid/pixel.png')$q$,'23514','reject external museum image insert') as test;
select public.archelens_test_denied($q$update public.museum_artifacts set artifact_image='https://tracker.invalid/pixel.png' where id='e0000000-0000-4000-8000-000000000003'$q$,'23514','reject external museum image update') as test;
select public.archelens_test_denied($q$update public.museum_artifacts set artifact_image='data:image/svg+xml;base64,PHN2Zz4=' where id='e0000000-0000-4000-8000-000000000003'$q$,'23514','reject SVG museum image') as test;
select public.archelens_test_denied($q$update public.museum_artifacts set artifact_image='data:image/png;base64,/9j/4AA=' where id='e0000000-0000-4000-8000-000000000003'$q$,'23514','reject spoofed museum image MIME') as test;
select public.archelens_test_changes($q$update public.museum_artifacts set artifact_image='data:image/png;base64,iVBORw0KGgoA' where id='e0000000-0000-4000-8000-000000000003'$q$,1,'accept valid stored PNG signature') as test;
select public.archelens_test_count('select count(*) from public.museum_rooms',4,'owner reads all own rooms') as test;
select public.archelens_test_changes($q$update public.analysis_workspaces set title='Renamed' where id='b0000000-0000-4000-8000-000000000001'$q$,1,'owner edits workspace') as test;
select public.archelens_test_count($q$select count(*) from public.match_artifacts(('[1,' || repeat('0,',766) || '0]')::extensions.vector,-1,999999)$q$,50,'vector RPC caps result count at 50') as test;
select public.archelens_test_count($q$select count(*) from public.match_artifacts(('[1,' || repeat('0,',766) || '0]')::extensions.vector,-1,-5)$q$,0,'vector RPC clamps negative count to zero') as test;
select public.archelens_test_denied($q$update public.analyses set owner_id='10000000-0000-4000-8000-000000000002'$q$,'42501','analysis owner cannot be reassigned') as test;
select public.archelens_test_denied($q$update public.analysis_workspaces set owner_id='10000000-0000-4000-8000-000000000002'$q$,'42501','workspace owner cannot be reassigned') as test;
select public.archelens_test_denied($q$update public.museums set owner_id='10000000-0000-4000-8000-000000000002'$q$,'42501','museum owner cannot be reassigned') as test;
select public.archelens_test_denied($q$update public.museum_rooms set museum_id='c0000000-0000-4000-8000-000000000003' where id='d0000000-0000-4000-8000-000000000001'$q$,'42501','room parent remains immutable even within same owner') as test;

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
insert into public.analyses(id,title,result_json) values ('a0000000-0000-4000-8000-000000000002','Other analysis','{}');
insert into public.artifact_embeddings(analysis_id,content,embedding)
  values ('a0000000-0000-4000-8000-000000000002','other',('[1,' || repeat('0,',766) || '0]')::extensions.vector);
insert into public.analysis_workspaces(id,title,result_json) values ('b0000000-0000-4000-8000-000000000002','Other workspace','{}');
insert into public.museums(id,name) values ('c0000000-0000-4000-8000-000000000002','Other museum');
insert into public.museum_rooms(id,museum_id,name) values ('d0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000002','Other room');
-- Signed-in nonowners may see genuinely public museums, but never private parents/rooms.
select public.archelens_test_count($q$select count(*) from public.museums where id='c0000000-0000-4000-8000-000000000003'$q$,1,'signed-in visitor reads public museum') as test;
select public.archelens_test_count($q$select count(*) from public.museums where id='c0000000-0000-4000-8000-000000000001'$q$,0,'signed-in visitor cannot read private museum') as test;
select public.archelens_test_count($q$select count(*) from public.museum_rooms where id='d0000000-0000-4000-8000-000000000003'$q$,1,'signed-in visitor reads public room in public museum') as test;
select public.archelens_test_count($q$select count(*) from public.museum_rooms where id in ('d0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000005')$q$,0,'signed-in visitor cannot infer a room through mixed flags') as test;
select public.archelens_test_count($q$select count(*) from public.museum_artifacts where id='e0000000-0000-4000-8000-000000000003'$q$,1,'signed-in visitor reads published artifact') as test;
select public.archelens_test_count($q$select count(*) from public.museum_artifacts where id in ('e0000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000005')$q$,0,'signed-in visitor cannot read unpublished artifact') as test;
select public.archelens_test_count('select count(*) from public.analyses',1,'other user reads only own analyses') as test;
select public.archelens_test_count('select count(*) from public.artifact_embeddings',1,'other user reads only own embeddings') as test;
select public.archelens_test_count($q$select count(*) from public.match_artifacts(('[1,' || repeat('0,',766) || '0]')::extensions.vector,-1,50)$q$,1,'vector RPC cannot return another tenant embeddings') as test;
select public.archelens_test_count($q$select count(*) from public.analysis_workspaces where id='b0000000-0000-4000-8000-000000000001'$q$,0,'uninvited user cannot read workspace') as test;
select public.archelens_test_count('select count(*) from public.annotations',0,'uninvited user cannot read annotations') as test;
select public.archelens_test_changes($q$update public.analyses set title='stolen' where id='a0000000-0000-4000-8000-000000000001'$q$,0,'cross-tenant analysis update affects no rows') as test;
select public.archelens_test_changes($q$delete from public.analyses where id='a0000000-0000-4000-8000-000000000001'$q$,0,'cross-tenant analysis delete affects no rows') as test;
select public.archelens_test_changes($q$update public.analysis_workspaces set title='stolen' where id='b0000000-0000-4000-8000-000000000001'$q$,0,'cross-tenant workspace update affects no rows') as test;
select public.archelens_test_changes($q$delete from public.analysis_workspaces where id='b0000000-0000-4000-8000-000000000001'$q$,0,'cross-tenant workspace delete affects no rows') as test;
select public.archelens_test_denied($q$insert into public.analyses(owner_id,title,result_json) values ('10000000-0000-4000-8000-000000000001','forged','{}')$q$,'42501','cannot forge analysis owner') as test;
select public.archelens_test_denied($q$insert into public.analysis_workspaces(owner_id,title,result_json) values ('10000000-0000-4000-8000-000000000001','forged','{}')$q$,'42501','cannot forge workspace owner') as test;
select public.archelens_test_denied($q$insert into public.artifact_embeddings(analysis_id,content,embedding) values ('a0000000-0000-4000-8000-000000000001','forged',('[1,' || repeat('0,',766) || '0]')::extensions.vector)$q$,'42501','cannot insert embedding into another analysis') as test;
select public.archelens_test_changes($q$update public.artifact_embeddings set content='forged' where analysis_id='a0000000-0000-4000-8000-000000000001'$q$,0,'cannot update another analysis embeddings') as test;
select public.archelens_test_changes($q$delete from public.artifact_embeddings where analysis_id='a0000000-0000-4000-8000-000000000001'$q$,0,'cannot delete another analysis embeddings') as test;
select public.archelens_test_denied($q$insert into public.annotations(workspace_id,user_name,user_color,type,data) values ('b0000000-0000-4000-8000-000000000001','Other','#123456','text','{}')$q$,'42501','uninvited user cannot annotate') as test;
select public.archelens_test_denied($q$insert into public.workspace_members(workspace_id,workspace_owner_id,user_id) values ('b0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002')$q$,'42501','cannot forge inviter owner') as test;
select public.archelens_test_denied($q$insert into public.workspace_members(workspace_id,user_id) values ('b0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002')$q$,'23503','composite FK prevents claiming another workspace') as test;
select public.archelens_test_denied($q$update public.museum_rooms set museum_id='c0000000-0000-4000-8000-000000000001' where id='d0000000-0000-4000-8000-000000000002'$q$,'42501','cannot reparent own room into another museum') as test;
select public.archelens_test_denied($q$insert into public.museum_rooms(museum_id,name) values ('c0000000-0000-4000-8000-000000000001','forged')$q$,'42501','cannot create room in another museum') as test;
select public.archelens_test_changes($q$update public.museums set name='stolen' where id='c0000000-0000-4000-8000-000000000001'$q$,0,'cannot edit another private museum') as test;
select public.archelens_test_changes($q$delete from public.museums where id='c0000000-0000-4000-8000-000000000001'$q$,0,'cannot delete another private museum') as test;
select public.archelens_test_changes($q$delete from public.museum_rooms where id='d0000000-0000-4000-8000-000000000001'$q$,0,'cannot delete another private room') as test;
select public.archelens_test_denied($q$insert into public.museum_artifacts(room_id,artifact_id,artifact_data) values ('d0000000-0000-4000-8000-000000000003','forged','{}')$q$,'42501','public view does not grant artifact insert') as test;
select public.archelens_test_changes($q$update public.museum_artifacts set artifact_id='forged' where id='e0000000-0000-4000-8000-000000000003'$q$,0,'public view does not grant artifact update') as test;
select public.archelens_test_changes($q$delete from public.museum_artifacts where id='e0000000-0000-4000-8000-000000000003'$q$,0,'public view does not grant artifact delete') as test;
set local realtime.topic = 'analysis:b0000000-0000-4000-8000-000000000001';
select public.archelens_test_denied($q$insert into realtime.messages(topic,extension,event,payload,private) values (realtime.topic(),'broadcast','test','{}',true)$q$,'42501','uninvited user cannot broadcast to owner workspace') as test;

reset role;
set local role anon;
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{"role":"anon"}';
select public.archelens_test_count('select count(*) from public.museums',1,'anon sees only public museums') as test;
select public.archelens_test_count('select count(*) from public.museum_rooms',1,'anon requires public room AND public museum') as test;
select public.archelens_test_count('select count(*) from public.museum_artifacts',1,'anon artifacts require both public parents') as test;
select public.archelens_test_denied('select * from public.analyses','42501','anon cannot access analyses') as test;
select public.archelens_test_denied('select * from public.artifact_embeddings','42501','anon cannot access embeddings') as test;
select public.archelens_test_denied('select * from public.analysis_workspaces','42501','anon cannot access workspaces') as test;
select public.archelens_test_denied('select * from public.workspace_members','42501','anon cannot access memberships') as test;
select public.archelens_test_denied('select * from public.annotations','42501','anon cannot access annotations') as test;
select public.archelens_test_denied($q$select * from public.match_artifacts(('[1,' || repeat('0,',766) || '0]')::extensions.vector)$q$,'42501','anon cannot execute vector RPC') as test;
select public.archelens_test_denied($q$insert into public.museums(name) values ('anon')$q$,'42501','anon cannot create museum') as test;
select public.archelens_test_denied($q$update public.museum_rooms set name='anon'$q$,'42501','anon cannot edit rooms') as test;
select public.archelens_test_denied('delete from public.museum_artifacts','42501','anon cannot delete artifacts') as test;

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select public.archelens_test_count('select count(*) from public.analysis_workspaces',0,'future member cannot read before invitation') as test;
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.archelens_test_changes($q$insert into public.workspace_members(workspace_id,user_id) values ('b0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003')$q$,1,'owner invites existing Auth UUID') as test;
select public.archelens_test_count('select count(*) from public.workspace_members',1,'owner can list invitations') as test;
set local realtime.topic = 'analysis:b0000000-0000-4000-8000-000000000001';
select public.archelens_test_changes($q$insert into realtime.messages(topic,extension,event,payload,private) values (realtime.topic(),'broadcast','test','{}',true)$q$,1,'owner can broadcast on private topic') as test;
select public.archelens_test_denied($q$insert into realtime.messages(topic,extension,event,payload,private) values ('analysis:b0000000-0000-4000-8000-000000000002','broadcast','test','{}',true)$q$,'42501','message topic must match authorized connection topic') as test;
select public.archelens_test_denied($q$insert into realtime.messages(topic,extension,event,payload,private) values (realtime.topic(),'unexpected-extension','test','{}',true)$q$,'42501','unexpected realtime extension is denied') as test;

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select public.archelens_test_count('select count(*) from public.analysis_workspaces',1,'member reads invited workspace only') as test;
select public.archelens_test_count('select count(*) from public.annotations',1,'member reads workspace annotations') as test;
select public.archelens_test_count('select count(*) from public.analyses',0,'workspace invitation does not expose private analyses') as test;
select public.archelens_test_changes($q$insert into public.annotations(id,workspace_id,user_name,user_color,type,data) values ('f0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','Member','#123456','text','{}')$q$,1,'member creates annotation as self') as test;
select public.archelens_test_changes($q$update public.annotations set data='{"text":"updated"}' where id='f0000000-0000-4000-8000-000000000002'$q$,1,'member edits own annotation') as test;
select public.archelens_test_changes($q$update public.annotations set data='{}' where id='f0000000-0000-4000-8000-000000000001'$q$,0,'member cannot edit owner annotation') as test;
select public.archelens_test_changes($q$delete from public.annotations where id='f0000000-0000-4000-8000-000000000001'$q$,0,'member cannot delete owner annotation') as test;
select public.archelens_test_denied($q$insert into public.annotations(workspace_id,user_id,user_name,user_color,type,data) values ('b0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','forged','#123456','text','{}')$q$,'42501','member cannot forge annotation author') as test;
select public.archelens_test_denied($q$update public.annotations set user_id='10000000-0000-4000-8000-000000000001' where id='f0000000-0000-4000-8000-000000000002'$q$,'42501','annotation author is immutable') as test;
select public.archelens_test_denied($q$update public.annotations set workspace_id='b0000000-0000-4000-8000-000000000002' where id='f0000000-0000-4000-8000-000000000002'$q$,'42501','annotation cannot move between tenants') as test;
select public.archelens_test_changes($q$update public.analysis_workspaces set title='takeover'$q$,0,'member cannot change workspace metadata') as test;
select public.archelens_test_changes('delete from public.workspace_members',0,'member cannot revoke invitations') as test;
select public.archelens_test_denied($q$insert into public.workspace_members(workspace_id,workspace_owner_id,user_id) values ('b0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002')$q$,'42501','member cannot invite other users') as test;
select public.archelens_test_changes($q$insert into realtime.messages(topic,extension,event,payload,private) values (realtime.topic(),'presence','test','{}',true)$q$,1,'member can publish presence on private topic') as test;
select public.archelens_test_count('select count(*) from realtime.messages',2,'member can receive private broadcast and presence') as test;
set local realtime.topic = 'analysis:b0000000-0000-4000-8000-000000000002';
select public.archelens_test_denied($q$insert into realtime.messages(topic,extension,event,payload,private) values (realtime.topic(),'presence','test','{}',true)$q$,'42501','member cannot access another workspace topic') as test;
set local realtime.topic = 'analysis:not-a-uuid';
select public.archelens_test_denied($q$insert into realtime.messages(topic,extension,event,payload,private) values (realtime.topic(),'broadcast','test','{}',true)$q$,'42501','malformed topic is denied without UUID cast errors') as test;
select public.archelens_test_changes($q$delete from public.annotations where id='f0000000-0000-4000-8000-000000000002'$q$,1,'member can delete own annotation') as test;
insert into public.annotations(id,workspace_id,user_name,user_color,type,data)
  values ('f0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','Member','#123456','text','{}');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.archelens_test_changes($q$delete from public.annotations where id='f0000000-0000-4000-8000-000000000002'$q$,1,'workspace owner can moderate member annotation') as test;
select public.archelens_test_changes($q$delete from public.workspace_members where user_id='10000000-0000-4000-8000-000000000003'$q$,1,'owner revokes membership') as test;
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000003';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select public.archelens_test_count('select count(*) from public.analysis_workspaces',0,'revoked member loses database read immediately') as test;
select public.archelens_test_count('select count(*) from public.annotations',0,'revoked member loses annotation reads') as test;
set local realtime.topic = 'analysis:b0000000-0000-4000-8000-000000000001';
select public.archelens_test_denied($q$insert into realtime.messages(topic,extension,event,payload,private) values (realtime.topic(),'broadcast','test','{}',true)$q$,'42501','revoked member fails a fresh realtime authorization check') as test;
reset role;
select public.archelens_test_count($q$select count(*) from pg_class where oid in (
  'public.analyses'::regclass,'public.artifact_embeddings'::regclass,'public.analysis_workspaces'::regclass,
  'public.workspace_members'::regclass,'public.annotations'::regclass,'public.museums'::regclass,
  'public.museum_rooms'::regclass,'public.museum_artifacts'::regclass) and relrowsecurity$q$,8,'all exposed application tables have RLS') as test;
select public.archelens_test_count($q$select count(*) from pg_proc where oid='public.match_artifacts(extensions.vector,double precision,integer)'::regprocedure and not prosecdef$q$,1,'vector RPC remains SECURITY INVOKER') as test;
rollback;
