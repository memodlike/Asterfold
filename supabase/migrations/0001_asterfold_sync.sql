-- Asterfold optional cloud transport. Local IndexedDB remains the source of truth.
-- Apply with the Supabase CLI, then configure the extension with the public
-- project URL and publishable/anon key only. Never bundle a service-role key.

create extension if not exists pgcrypto;

create sequence if not exists public.asterfold_server_version_seq;

create table if not exists public.sync_entities (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('page', 'board', 'bookmark', 'settings', 'theme')),
  entity_id text not null,
  entity_version bigint not null check (entity_version > 0),
  server_version bigint not null default nextval('public.asterfold_server_version_seq'),
  operation_id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id),
  unique (user_id, operation_id)
);

create index if not exists sync_entities_pull_idx
  on public.sync_entities (user_id, server_version);

create table if not exists public.sync_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  applied_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);

alter table public.sync_entities enable row level security;
alter table public.sync_entities force row level security;
alter table public.sync_receipts enable row level security;
alter table public.sync_receipts force row level security;

drop policy if exists "owners read sync entities" on public.sync_entities;
create policy "owners read sync entities"
  on public.sync_entities for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "owners insert sync entities" on public.sync_entities;
create policy "owners insert sync entities"
  on public.sync_entities for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "owners update sync entities" on public.sync_entities;
create policy "owners update sync entities"
  on public.sync_entities for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "owners delete sync entities" on public.sync_entities;
create policy "owners delete sync entities"
  on public.sync_entities for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "owners read sync receipts" on public.sync_receipts;
create policy "owners read sync receipts"
  on public.sync_receipts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "owners insert sync receipts" on public.sync_receipts;
create policy "owners insert sync receipts"
  on public.sync_receipts for insert to authenticated
  with check ((select auth.uid()) = user_id);

create or replace function public.apply_sync_operation(
  p_operation_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_operation text,
  p_payload jsonb,
  p_expected_version bigint
) returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_inserted integer := 0;
  v_server_version bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;
  if p_entity_type not in ('page', 'board', 'bookmark', 'settings', 'theme') then
    raise exception 'unsupported entity type';
  end if;
  if p_operation not in ('upsert', 'delete', 'restore') then
    raise exception 'unsupported operation';
  end if;
  if p_expected_version < 1 or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid operation payload';
  end if;

  insert into public.sync_receipts (user_id, operation_id)
  values (v_user_id, p_operation_id)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select server_version into v_server_version
    from public.sync_entities
    where user_id = v_user_id and operation_id = p_operation_id;
    return coalesce(v_server_version, 0);
  end if;

  insert into public.sync_entities (
    user_id, entity_type, entity_id, entity_version, operation_id,
    payload, deleted_at, updated_at
  ) values (
    v_user_id, p_entity_type, p_entity_id, p_expected_version, p_operation_id,
    p_payload,
    case when p_operation = 'delete' then now() else null end,
    now()
  )
  on conflict (user_id, entity_type, entity_id) do update set
    entity_version = excluded.entity_version,
    server_version = nextval('public.asterfold_server_version_seq'),
    operation_id = excluded.operation_id,
    payload = excluded.payload,
    deleted_at = excluded.deleted_at,
    updated_at = excluded.updated_at
  where excluded.entity_version >= public.sync_entities.entity_version
  returning server_version into v_server_version;

  if v_server_version is null then
    select server_version into v_server_version
    from public.sync_entities
    where user_id = v_user_id
      and entity_type = p_entity_type
      and entity_id = p_entity_id;
  end if;
  return v_server_version;
end;
$$;

revoke all on public.sync_entities from anon;
revoke all on public.sync_receipts from anon;
revoke all on function public.apply_sync_operation(uuid, text, text, text, jsonb, bigint) from public, anon;
grant select, insert, update, delete on public.sync_entities to authenticated;
grant select, insert on public.sync_receipts to authenticated;
grant usage, select on sequence public.asterfold_server_version_seq to authenticated;
grant execute on function public.apply_sync_operation(uuid, text, text, text, jsonb, bigint) to authenticated;
