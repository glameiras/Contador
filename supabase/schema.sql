-- CONTADOR — Execute uma vez no Supabase > SQL Editor.
-- 1 documento JSON por usuário, com revisão otimista para evitar perda por conflito.
-- Todas as leituras/escritas via Auth + Row Level Security (RLS).
create table if not exists public.contador_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint contador_payload_object check (jsonb_typeof(data) = 'object'),
  constraint contador_payload_size check (pg_column_size(data) <= 1048576)
);

alter table public.contador_data enable row level security;
revoke all on table public.contador_data from anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update on table public.contador_data to authenticated;

drop policy if exists "contador: ler próprio" on public.contador_data;
create policy "contador: ler próprio" on public.contador_data
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "contador: inserir próprio" on public.contador_data;
create policy "contador: inserir próprio" on public.contador_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "contador: atualizar próprio" on public.contador_data;
create policy "contador: atualizar próprio" on public.contador_data
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.save_contador(
  p_expected integer,
  p_payload jsonb
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_revision integer;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_expected is null or p_expected < 0 then
    raise exception 'INVALID_REVISION';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
     or p_payload->>'version' is distinct from '1'
     or pg_catalog.pg_column_size(p_payload) > 1048576
     or jsonb_typeof(p_payload->'accounts') is distinct from 'array'
     or jsonb_typeof(p_payload->'transactions') is distinct from 'array'
     or jsonb_typeof(p_payload->'cards') is distinct from 'array'
     or jsonb_typeof(p_payload->'purchases') is distinct from 'array'
     or jsonb_typeof(p_payload->'recurring') is distinct from 'array'
     or jsonb_typeof(p_payload->'goals') is distinct from 'array'
  then
    raise exception 'INVALID_PAYLOAD';
  end if;

  if p_expected = 0 then
    insert into public.contador_data (user_id, data, revision)
    values (v_user, p_payload, 1)
    on conflict (user_id) do nothing
    returning revision into v_revision;
  else
    update public.contador_data
    set data = p_payload, revision = revision + 1, updated_at = now()
    where user_id = v_user and revision = p_expected
    returning revision into v_revision;
  end if;

  if v_revision is null then
    raise exception 'CONFLICT';
  end if;
  return v_revision;
end;
$$;

revoke all on function public.save_contador(integer, jsonb) from public, anon;
grant execute on function public.save_contador(integer, jsonb) to authenticated;

-- ATENÇÃO: não exponha chaves sb_secret_ ou service_role no frontend.
-- Crie no Auth > URL Configuration os Redirect URLs HTTPS de produção.
