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
