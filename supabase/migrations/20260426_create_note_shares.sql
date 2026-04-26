create table if not exists public.note_shares (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  shared_with_user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'viewer' check (role in ('viewer', 'editor')),
  status text not null default 'accepted' check (status in ('pending', 'accepted', 'rejected')),
  invited_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (note_id, shared_with_user_id)
);

create index if not exists note_shares_owner_user_id_idx
  on public.note_shares (owner_user_id);

create index if not exists note_shares_shared_with_user_id_idx
  on public.note_shares (shared_with_user_id);

create index if not exists note_shares_note_id_idx
  on public.note_shares (note_id);

create or replace function public.set_note_shares_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_note_shares_updated_at on public.note_shares;

create trigger trg_note_shares_updated_at
before update on public.note_shares
for each row
execute function public.set_note_shares_updated_at();
