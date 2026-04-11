# SmartNotes Site Modules Handbook

## Runtime composition

SmartNotes runtime is assembled from domain modules and orchestrated by `NotesApplication`.

### Runtime modules

- `js/app/runtime/stateRenderer.js`
  - Builds notes view model from `StateStore`.
  - Subscribes to state updates.
  - Triggers rerender of notes list, folders and load-more controls.
- `js/app/runtime/uiEvents.js`
  - Subscribes to `EventBus` events.
  - Translates domain events into toasts and notifications.
  - Centralizes sync error policy and user-facing responses.
- `js/app/runtime/networkLifecycle.js`
  - Handles reconnect lifecycle.
  - Restarts user session subscriptions after network restoration.
- `js/app/runtime/runtimeInitializer.js`
  - Initializes UI shell and editor runtime.
  - Starts renderer, event subscriptions and network lifecycle.
  - Restores user session when user is present.
- `js/notes/app.js`
  - Thin bootstrap layer.
  - Exposes `window.initApp` and starts app on DOM ready.

## Domain structure

### Core domain (`js/core`)

Responsibilities:
- app-wide infrastructure
- backend connectivity and auth
- utility, validation and secure storage

Rules:
- must not import from `js/notes`, `js/editor`, `js/ui`

### Notes domain (`js/notes`)

Responsibilities:
- note/folder/workspace repositories
- query services and pagination
- notes presentation and filtering

Rules:
- may use `js/core`
- must not import from `js/editor`, `js/ui`

### Editor domain (`js/editor`)

Responsibilities:
- rich text editing
- media placement and drawing
- editor command system

Rules:
- may use `js/core`
- must not import from `js/ui`

### UI domain (`js/ui`)

Responsibilities:
- rendering and interactive controls
- modal/navigation/layout behavior
- theme, language application

Rules:
- may use `js/core`, `js/notes`, `js/editor`

### UI feature modules (`js/ui/modules`)

- `js/ui/modules/noteActionsExport.js`
  - Isolates note export helpers (TXT/PDF/print-window construction).
  - Shared by UI note-actions layer without embedding export logic into large layout modules.
- `js/ui/modules/noteActionsPanel.js`
  - Contains note action modal methods (lock/archive/move/export).
  - Keeps `js/ui/layout.js` focused on layout/application flows instead of note-actions feature internals.

## Startup sequence

1. Core and domain scripts load from `index.html`.
2. Runtime modules register global runtime factories.
3. `js/notes/app.js` creates runtime initializer.
4. On DOM ready, initializer starts:
   - `UI.init()`
   - `SmartNotesEditor.init()`
   - state rendering controller
   - UI events controller
   - network lifecycle controller
   - session restore and initial render

## Compatibility policy

- Existing globals remain stable (`UI`, `StateStore`, `SessionService`, `NotesPresenter`, `NotesUIAdapter`).
- Existing Firebase note format remains unchanged.
- Runtime refactors must preserve external behavior and app entrypoint (`window.initApp`).

## Refactor checklist

When adding or moving modules:

1. Keep domain boundaries valid.
2. Preserve startup ordering in `index.html`.
3. Avoid direct cross-domain coupling where a service adapter exists.
4. Keep app bootstrap thin and orchestration-only.
5. Update this handbook for every architectural change.
