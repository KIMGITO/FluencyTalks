-- Stand-ins for the parts of Supabase that a plain Postgres does not have (auth, storage, realtime,
-- the API roles), so the migrations can be tested on any throwaway Postgres 15+. Test use only:
-- never run this on a Supabase project. On `supabase start` you do not need it.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator nologin; end if;
end $$;
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create schema if not exists auth; create schema if not exists storage; create schema if not exists extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', created_at timestamptz default now(), email_confirmed_at timestamptz default now(), last_sign_in_at timestamptz);
create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, friendly_name text, status text not null default 'unverified');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
create publication supabase_realtime;
create schema if not exists realtime;
create table realtime.messages (id uuid default gen_random_uuid(), topic text, extension text, payload jsonb);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$ select nullif(current_setting('realtime.topic', true), '') $$;
-- Hosted Supabase rejects direct DELETEs on its storage tables ("Use the Storage API instead").
create function storage.protect_delete() returns trigger language plpgsql as $$
begin raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.' using errcode = '42501'; end $$;
create trigger protect_buckets_delete before delete on storage.buckets for each statement execute function storage.protect_delete();
create trigger protect_objects_delete before delete on storage.objects for each statement execute function storage.protect_delete();
grant usage on schema public, auth, storage to anon, authenticated, service_role;
-- Hosted Supabase gives every new table to the API roles. The migrations have to take that back themselves,
-- so this has to be in place before they run.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage on sequences to authenticated;
