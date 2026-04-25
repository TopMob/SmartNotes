begin;

alter table public.note_permissions
    drop constraint if exists note_permissions_note_id_fkey;

alter table public.note_permissions
    drop constraint if exists note_permissions_user_id_fkey;

alter table public.note_permissions
    drop constraint if exists note_permissions_invited_by_user_id_fkey;

alter table public.folder_permissions
    drop constraint if exists folder_permissions_folder_id_fkey;

alter table public.folder_permissions
    drop constraint if exists folder_permissions_user_id_fkey;

alter table public.folder_permissions
    drop constraint if exists folder_permissions_invited_by_user_id_fkey;

alter table public.note_permissions
    alter column note_id type text using note_id::text;

alter table public.folder_permissions
    alter column folder_id type text using folder_id::text;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'notes'
          and column_name = 'id'
          and data_type = 'text'
    ) then
        alter table public.note_permissions
            add constraint note_permissions_note_id_fkey
            foreign key (note_id) references public.notes (id) on delete cascade;
    else
        raise notice 'Skipped note_permissions_note_id_fkey: public.notes.id is not text';
    end if;
end $$;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'folders'
          and column_name = 'id'
          and data_type = 'text'
    ) then
        alter table public.folder_permissions
            add constraint folder_permissions_folder_id_fkey
            foreign key (folder_id) references public.folders (id) on delete cascade;
    else
        raise notice 'Skipped folder_permissions_folder_id_fkey: public.folders.id is not text';
    end if;
end $$;

commit;
