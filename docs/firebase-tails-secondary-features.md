# Firebase Tails In Secondary Features

This document tracks Firebase-only tails that are intentionally kept out of the primary runtime path during the Supabase core cutover.

## Safely isolated now

- `public/js/core/googleDriveMedia.js`
  - Google Drive external storage service remains Firebase-era secondary functionality.
  - Guarded behind `window.AppFeatures.googleDrive`.
  - Returns `configured: false` and prevents connect/unlink/upload/backup calls when disabled.

- `public/js/load-notes-stack.js`
  - Shared notes subscriptions (`sharedNotes`) remain Firebase-backed.
  - Shared workspaces subscriptions and mutation flows (`workspaces`, `workspaceShares`) remain Firebase-backed.
  - Subscription entry points now short-circuit to safe no-op behavior when `sharedAccess` / `workspaces` are disabled.
  - Workspace mutation methods now return `null` / `false` / `[]` when disabled.

- `public/js/load-ui-render.js`
  - Feedback submission still targets Firestore collection `feedback`.
  - Poll submission still targets Firestore collection `feedback` with `type: "survey"`.
  - Both paths are blocked by feature guards and no longer participate in primary runtime.

- `public/js/load-ui-core.js`
  - Shared/workspace actions are guarded and hidden from reachable UI paths.
  - Feedback entry points are guarded and hidden from reachable UI paths.
  - Google Drive backup actions are guarded and hidden from reachable UI paths.

## Still present for later cleanup

- Firestore payload creation inside disabled feedback/poll flows in `public/js/load-ui-render.js`.
- Firestore timestamps and collection writes inside disabled shared/workspace mutation flows in `public/js/load-notes-stack.js`.
- Legacy shared/workspace state plumbing in `public/js/load-notes-stack.js` that still exists structurally even though entry points are disabled.
- Legacy Google Drive provider wiring in `public/js/core/googleDriveMedia.js` that remains compiled but inactive.

## Not touched in this pass

- Primary core runtime files.
- Supabase auth / infra / API implementation.
- Any migration of these secondary features to Supabase.

## Removal strategy later

1. Delete disabled UI entry points for shared/workspaces/feedback/poll/Drive.
2. Remove Firebase-backed services and repositories for those features.
3. Remove Firestore-specific payload helpers that become unreachable afterward.
4. Remove Firebase provider code once no import path depends on it.
