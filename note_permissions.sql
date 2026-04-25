create table if not exists public.note_permissions (
    note_id uuid not null references public.notes (id) on delete cascade,
    user_email text not null,
    role text not null check (role in ('viewer', 'editor')),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    primary key (note_id, user_email)
);

create index if not exists note_permissions_user_email_idx
    on public.note_permissions (user_email);

create index if not exists note_permissions_note_id_idx
    on public.note_permissions (note_id);
