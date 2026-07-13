-- Sing Creative Advisor — Supabase schema
-- Run this once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/onzvbofjdhdfsghgzmve/sql/new
--
-- All access from the app happens server-side via the service_role key,
-- which bypasses RLS. RLS is enabled with no policies so the anon key
-- (used only for realtime/future client features) has zero direct access.

create extension if not exists pgcrypto;

do $$ begin
  create type chat_tab as enum ('advisor', 'persona');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_role as enum ('user', 'assistant', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type file_status as enum ('uploaded', 'chunking', 'embedding', 'vectorized', 'error');
exception when duplicate_object then null; end $$;

-- One row per chat "session" in either the Advisor or Persona Interview tab.
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  tab chat_tab not null,
  title text not null default 'Untitled session',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role message_role not null,
  content text not null,
  rag_metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_id_idx on chat_messages(session_id);

-- If chat_messages already exists without rag_metadata, run once in SQL editor:
-- alter table chat_messages add column if not exists rag_metadata jsonb;

-- Question-generation outputs are tracked separately from the raw chat
-- transcript so the Persona Interview tab can export "just the questions".
create table if not exists generated_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists generated_questions_session_id_idx on generated_questions(session_id);

-- Tracks each file through the GCS upload -> chunk -> embed -> Pinecone pipeline.
create table if not exists uploaded_files (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  gcs_path text not null,
  mime_type text,
  size_bytes bigint,
  status file_status not null default 'uploaded',
  error_message text,
  chunk_count integer,
  pinecone_namespace text,
  uploaded_at timestamptz not null default now(),
  vectorized_at timestamptz
);

-- Generated process-flow-chart images (Advisor tab), linked back to the
-- session that produced them.
create table if not exists flow_charts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete set null,
  prompt text not null,
  image_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists flow_charts_session_id_idx on flow_charts(session_id);

-- Keep chat_sessions.updated_at current whenever a message is added.
create or replace function touch_chat_session()
returns trigger as $$
begin
  update chat_sessions set updated_at = now() where id = new.session_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists touch_chat_session_on_message on chat_messages;
create trigger touch_chat_session_on_message
  after insert on chat_messages
  for each row execute function touch_chat_session();

alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table generated_questions enable row level security;
alter table uploaded_files enable row level security;
alter table flow_charts enable row level security;
