# SmartNotes Agent Notes

## Architecture
- This is not a typical Next.js-only UI. `app/page.tsx` immediately redirects to `/index.html`, and the real product shell lives in `public/index.html` plus `public/js/**`.
- Treat Next App Router as the server/API shell: page routes are thin, while product behavior is mostly in browser-side JS modules under `public/js`.
- Main server areas:
  - `app/api/supabase/**` for notes, folders, sharing, session, settings, feedback, and public Supabase config.
  - `app/api/analyze/**` for AI note analysis.
  - `proxy.ts` sets CSP, `x-nonce`, and the short-lived `smartnotes-supabase-config` cookie for non-API requests.

## Commands
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Full test suite: `npm test`
- Single test file: `node --test tests/editor-enter.test.mjs`
- Single test by name: `node --test --test-name-pattern "Enter splits paragraph" tests/editor-enter.test.mjs`
- JS graph guards used by CI:
  - `npm run check:module-graph`
  - `npm run check:domain-boundaries`
  - `npm run check:unused-exports`

## Verification Order
- For changes in `public/js`, prefer: `npm test` -> relevant `check:*` scripts.
- CI currently runs `npm test`, `check:module-graph`, `check:domain-boundaries`, and `check:unused-exports` only. It does not run `build` or `lint`.
- Because the project is working but bug-heavy, prefer focused verification around touched areas over broad refactors.

## public/js Rules
- `public/index.html` is the startup graph root. If you add a new browser module, make sure it is reachable from existing startup scripts or `public/js/editor/drawing-loader.js`; otherwise `npm run check:module-graph` will fail.
- Keep `public/js` domain imports one-way. `scripts/check-domain-boundaries.mjs` enforces:
  - `core` must not import `notes`, `editor`, or `ui`
  - `notes` must not import `editor` or `ui`
  - `editor` must not import `ui`
- `npm run check:unused-exports` only scans named exports inside `public/js/**/*.js`; adding unused named exports there will fail CI.

## Testing Notes
- Tests use the Node test runner, not Jest/Vitest.
- Editor behavior tests use JSDOM and import modules directly from `public/js/editor/**`.
- Analysis contract tests import server modules directly from `app/api/analyze/**`, so keep those modules side-effect light.

## Env And Security
- Public Supabase browser config is served from `/api/supabase/config` and also mirrored into a cookie by `proxy.ts`; if auth/bootstrap changes, check both paths.
- AI analysis requires the `x-secret` request header. Provider-specific env requirements are documented in `app/api/analyze/providers/README.md`.
- `lib/security/csp.ts` is the centralized CSP source. Update it together with any new external script/image/connect origins.

## Style Of Change
- Prefer surgical fixes. This repo mixes strict TypeScript on the Next side with a large legacy-style browser JS app in `public/js`, so broad rewrites tend to create regressions quickly.
