-- Lulu baby tracker — run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  language text not null default 'en',
  time_format text not null default '24h',
  created_at timestamptz not null default now()
);

create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists family_members (
  family_id uuid not null references families on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'parent',
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table if not exists babies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  name text not null,
  birth_date date,
  sex text check (sex in ('female', 'male')),
  photo_path text,
  created_at timestamptz not null default now()
);
alter table babies add column if not exists photo_path text;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references babies on delete cascade,
  family_id uuid not null references families on delete cascade,
  category text not null,
  subtype text,
  started_at timestamptz not null,
  ended_at timestamptz,              -- null = timer running
  logged_by uuid references auth.users on delete set null default auth.uid(),
  note text,
  data jsonb not null default '{}',
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz             -- soft delete, so Undo works
);
create index if not exists events_baby_started on events (baby_id, started_at desc);

-- Projects created with an earlier version of this file: let accounts be deleted.
alter table families drop constraint if exists families_created_by_fkey,
  add constraint families_created_by_fkey foreign key (created_by) references auth.users on delete set null;
alter table events drop constraint if exists events_logged_by_fkey,
  add constraint events_logged_by_fkey foreign key (logged_by) references auth.users on delete set null;

-- Membership check used by every policy. security definer avoids recursive RLS.
create or replace function is_member(fid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from family_members where family_id = fid and user_id = auth.uid());
$$;

create or replace function create_family(fname text) returns families
language plpgsql security definer set search_path = public as $$
declare f families;
begin
  insert into families (name, created_by) values (fname, auth.uid()) returning * into f;
  insert into family_members (family_id, user_id) values (f.id, auth.uid());
  return f;
end $$;

create or replace function join_family(code text) returns families
language plpgsql security definer set search_path = public as $$
declare f families;
begin
  select * into f from families where invite_code = upper(code);
  if f.id is null then raise exception 'Invite code not found'; end if;
  insert into family_members (family_id, user_id) values (f.id, auth.uid()) on conflict do nothing;
  return f;
end $$;

alter table profiles enable row level security;
alter table families enable row level security;
alter table family_members enable row level security;
alter table babies enable row level security;
alter table events enable row level security;

drop policy if exists "own or family profile" on profiles;
create policy "own or family profile" on profiles for select using (
  id = auth.uid() or exists (
    select 1 from family_members a join family_members b on a.family_id = b.family_id
    where a.user_id = auth.uid() and b.user_id = profiles.id));
drop policy if exists "write own profile" on profiles;
create policy "write own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "members read family" on families;
create policy "members read family" on families for select using (is_member(id));
drop policy if exists "members update family" on families;
create policy "members update family" on families for update using (is_member(id));

drop policy if exists "members read members" on family_members;
create policy "members read members" on family_members for select using (is_member(family_id));
drop policy if exists "leave family" on family_members;
create policy "leave family" on family_members for delete using (user_id = auth.uid());

drop policy if exists "members babies" on babies;
create policy "members babies" on babies for all using (is_member(family_id)) with check (is_member(family_id));

drop policy if exists "members events" on events;
create policy "members events" on events for all using (is_member(family_id)) with check (is_member(family_id));

-- Live updates between parents
do $$ begin
  alter publication supabase_realtime add table events, babies;
exception when duplicate_object then null; end $$;

-- Private photo bucket; files live under <family_id>/...
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict do nothing;
drop policy if exists "family photos read" on storage.objects;
create policy "family photos read" on storage.objects for select
  using (bucket_id = 'photos' and is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "family photos write" on storage.objects;
create policy "family photos write" on storage.objects for insert
  with check (bucket_id = 'photos' and is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "family photos delete" on storage.objects;
create policy "family photos delete" on storage.objects for delete
  using (bucket_id = 'photos' and is_member(((storage.foldername(name))[1])::uuid));
