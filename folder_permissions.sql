create table if not exists public.folder_permissions (
    folder_id uuid not null references public.folders (id) on delete cascade,
    user_email text not null,
    role text not null check (role in ('viewer', 'editor')),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    primary key (folder_id, user_email)
);

create index if not exists folder_permissions_user_email_idx
    on public.folder_permissions (user_email);

create index if not exists folder_permissions_folder_id_idx
    on public.folder_permissions (folder_id);
