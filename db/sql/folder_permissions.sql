create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create table if not exists public.folder_permissions (
    folder_id text not null,
    user_id uuid not null,
    role text not null,
    status text not null default 'pending',
    invited_by_user_id uuid not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.folder_permissions
    add column if not exists folder_id text;

alter table public.folder_permissions
    add column if not exists user_id uuid;

alter table public.folder_permissions
    add column if not exists role text;

alter table public.folder_permissions
    add column if not exists status text;

alter table public.folder_permissions
    add column if not exists invited_by_user_id uuid;

alter table public.folder_permissions
    add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.folder_permissions
    add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.folder_permissions
set status = 'pending'
where status is null;

alter table public.folder_permissions
    alter column folder_id set not null;

alter table public.folder_permissions
    alter column user_id set not null;

alter table public.folder_permissions
    alter column role set not null;

alter table public.folder_permissions
    alter column status set default 'pending';

alter table public.folder_permissions
    alter column status set not null;

alter table public.folder_permissions
    alter column invited_by_user_id set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'folder_permissions_role_check'
          and conrelid = 'public.folder_permissions'::regclass
    ) then
        alter table public.folder_permissions
            add constraint folder_permissions_role_check
            check (role in ('viewer', 'editor'));
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'folder_permissions_status_check'
          and conrelid = 'public.folder_permissions'::regclass
    ) then
        alter table public.folder_permissions
            add constraint folder_permissions_status_check
            check (status in ('pending', 'accepted', 'rejected'));
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'folder_permissions_pkey'
          and conrelid = 'public.folder_permissions'::regclass
    ) then
        alter table public.folder_permissions
            add constraint folder_permissions_pkey primary key (folder_id, user_id);
    end if;
end $$;

create index if not exists folder_permissions_user_id_idx
    on public.folder_permissions (user_id);

create index if not exists folder_permissions_folder_id_idx
    on public.folder_permissions (folder_id);

create index if not exists folder_permissions_status_idx
    on public.folder_permissions (status);

drop trigger if exists set_folder_permissions_updated_at on public.folder_permissions;

create trigger set_folder_permissions_updated_at
before update on public.folder_permissions
for each row
execute function public.set_current_timestamp_updated_at();
