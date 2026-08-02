create extension if not exists pgcrypto;

create table public.thoughts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_thought_id uuid,
  title text,
  text text not null check (length(btrim(text)) > 0),
  mode text not null default 'editor' check (mode in ('editor', 'discuss')),
  context_locked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (parent_thought_id, user_id)
    references public.thoughts(id, user_id) on delete set null (parent_thought_id)
);

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thought_id uuid,
  mode text not null default 'editor' check (mode in ('editor', 'discuss')),
  use_global_context boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (thought_id, user_id)
    references public.thoughts(id, user_id) on delete set null (thought_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_session_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now(),
  foreign key (chat_session_id, user_id)
    references public.chat_sessions(id, user_id) on delete cascade
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'ru' check (locale in ('ru', 'en')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  default_mode text not null default 'editor' check (default_mode in ('editor', 'discuss')),
  use_global_context boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index thoughts_user_created_idx on public.thoughts (user_id, created_at desc);
create index chat_sessions_user_created_idx on public.chat_sessions (user_id, created_at desc);
create index messages_session_created_idx on public.messages (chat_session_id, created_at);
create index messages_user_idx on public.messages (user_id);

alter table public.thoughts enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.messages enable row level security;
alter table public.user_settings enable row level security;

revoke all on public.thoughts, public.chat_sessions, public.messages, public.user_settings from anon;
grant select, insert, update, delete on public.thoughts, public.chat_sessions, public.messages, public.user_settings to authenticated;

create policy "thoughts_select_own" on public.thoughts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "thoughts_insert_own" on public.thoughts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "thoughts_update_own" on public.thoughts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "thoughts_delete_own" on public.thoughts for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "chat_sessions_select_own" on public.chat_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "chat_sessions_insert_own" on public.chat_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "chat_sessions_update_own" on public.chat_sessions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "chat_sessions_delete_own" on public.chat_sessions for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "messages_select_own" on public.messages for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "messages_insert_own" on public.messages for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "messages_update_own" on public.messages for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "messages_delete_own" on public.messages for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_settings_select_own" on public.user_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "user_settings_insert_own" on public.user_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "user_settings_update_own" on public.user_settings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_settings_delete_own" on public.user_settings for delete to authenticated
  using ((select auth.uid()) = user_id);
