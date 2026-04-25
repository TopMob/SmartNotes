create table if not exists public.folder_permissions (
    folder_id text not null,
    user_id uuid not null,
    role text not null check (role in ('viewer', 'editor')),
    status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
    invited_by_user_id uuid not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    primary key (folder_id, user_id)
);

alter table public.folder_permissions
    add column if not exists user_id uuid;

alter table public.folder_permissions
    add column if not exists status text not null default 'pending';

alter table public.folder_permissions
    add column if not exists invited_by_user_id uuid;

create index if not exists folder_permissions_user_id_idx
    on public.folder_permissions (user_id);

create index if not exists folder_permissions_folder_id_idx
    on public.folder_permissions (folder_id);

create index if not exists folder_permissions_status_idx
    on public.folder_permissions (status);
