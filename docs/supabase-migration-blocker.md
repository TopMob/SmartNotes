# Supabase Migration Blocker

## Current blocker

SmartNotes still authenticates users through Firebase Auth, while the new Supabase schema uses `public.profiles.id uuid references auth.users(id)` as the root identity key.

That means the current Firebase `uid` cannot be written directly into:

- `profiles.id`
- `folders.user_id`
- `notes.user_id`
- `note_embeddings.user_id`
- `folder_embeddings.user_id`
- `analysis_jobs.user_id`
- `analysis_results.user_id`
- `note_resurfacing_scores.user_id`
- `manual_feedback.user_id`

## Why direct migration is unsafe

- Firebase UIDs are not guaranteed to be UUIDs.
- Supabase row ownership and RLS are based on Supabase Auth user IDs.
- Writing Firebase UIDs into the current schema would break referential integrity and future auth migration.

## Required next step

Before migrating profiles, folders, or notes, the project needs an identity bridge:

1. Sign in with Supabase Auth, or
2. Provision matching Supabase auth users for Firebase users and persist a durable mapping.

## Recommended migration order

1. Identity bridge
2. Profile sync
3. Folder sync
4. Note sync
5. Embedding and retrieval sync

## Temporary rule

Do not write application entity data to Supabase user-scoped tables until identity mapping is implemented.
