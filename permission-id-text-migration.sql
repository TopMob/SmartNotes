begin;

alter table public.note_permissions
    drop constraint if exists note_permissions_note_id_fkey;

alter table public.folder_permissions
    drop constraint if exists folder_permissions_folder_id_fkey;

alter table public.note_permissions
    alter column note_id type text using note_id::text;

alter table public.folder_permissions
    alter column folder_id type text using folder_id::text;

alter table public.note_permissions
    add constraint note_permissions_note_id_fkey
    foreign key (note_id) references public.notes (id) on delete cascade;

alter table public.folder_permissions
    add constraint folder_permissions_folder_id_fkey
    foreign key (folder_id) references public.folders (id) on delete cascade;

commit;
