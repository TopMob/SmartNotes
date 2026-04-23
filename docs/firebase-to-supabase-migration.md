# Firebase to Supabase Migration

## What this script migrates

- Firebase users from `users/{uid}`
- Firebase notes from `users/{uid}/notes/{noteId}`

## What it writes to Supabase

- `profiles`
- `notes`

## Safety features

- JSON backup before write
- dry-run mode
- idempotent upsert behavior
- preserves `legacy_firebase_uid`
- preserves `legacy_firebase_note_id`

## Required env

- `FIREBASE_ADMIN_JSON` or `FIREBASE_SERVICE_ACCOUNT`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Run dry-run first

```powershell
npm run migrate:firebase-to-supabase -- --dry-run
```

## Run real migration

```powershell
npm run migrate:firebase-to-supabase
```

## Recommended verification after migration

1. Compare count of Firebase users vs Supabase profiles
2. Compare count of Firebase notes vs Supabase notes
3. Check `legacy_firebase_uid`
4. Check `legacy_firebase_note_id`
5. Open several migrated notes manually
