create table if not exists public.note_permissions (
    note_id text not null,
    user_id uuid not null references public.profiles (id) on delete cascade,
    role text not null check (role in ('viewer', 'editor')),
    status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
    invited_by_user_id uuid not null references public.profiles (id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    primary key (note_id, user_id)
);

alter table public.note_permissions
    add column if not exists user_id uuid references public.profiles (id) on delete cascade;

alter table public.note_permissions
    add column if not exists status text not null default 'pending';

alter table public.note_permissions
    add column if not exists invited_by_user_id uuid references public.profiles (id) on delete cascade;

create index if not exists note_permissions_user_id_idx
    on public.note_permissions (user_id);

create index if not exists note_permissions_note_id_idx
    on public.note_permissions (note_id);

create index if not exists note_permissions_status_idx
    on public.note_permissions (status);
