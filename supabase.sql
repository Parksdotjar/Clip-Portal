create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  title text not null,
  tags text[] default '{}',
  notes text,
  file_url text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

alter table public.clips enable row level security;

create policy "Public read clips"
  on public.clips
  for select
  using (true);

create policy "Users insert own clips"
  on public.clips
  for insert
  with check (auth.uid() = user_id);

create policy "Users delete own clips"
  on public.clips
  for delete
  using (auth.uid() = user_id);

-- Storage policies for bucket "clips"
create policy "Public read clips bucket"
  on storage.objects
  for select
  using (bucket_id = 'clips');

create policy "Authenticated upload clips"
  on storage.objects
  for insert
  with check (bucket_id = 'clips' and auth.role() = 'authenticated');

create policy "Users delete own uploads"
  on storage.objects
  for delete
  using (
    bucket_id = 'clips'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storyboard boards
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  color text,
  audio_url text,
  audio_name text,
  audio_duration integer,
  drawing_data text,
  created_at timestamptz default now()
);

create table if not exists public.board_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references public.boards on delete cascade,
  user_id uuid references auth.users on delete cascade,
  type text not null,
  x numeric default 0,
  y numeric default 0,
  width numeric,
  height numeric,
  content text,
  meta jsonb,
  created_at timestamptz default now()
);

alter table public.boards enable row level security;
alter table public.board_items enable row level security;

create policy "Users manage own boards"
  on public.boards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own board items"
  on public.board_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage policies for bucket "boards-audio"
create policy "Public read boards audio"
  on storage.objects
  for select
  using (bucket_id = 'boards-audio');

create policy "Authenticated upload boards audio"
  on storage.objects
  for insert
  with check (bucket_id = 'boards-audio' and auth.role() = 'authenticated');

create policy "Users delete own boards audio"
  on storage.objects
  for delete
  using (
    bucket_id = 'boards-audio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
