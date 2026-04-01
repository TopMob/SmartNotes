# Changelog

## 2026-04-01 — Оптимизация startup и модульной архитектуры

### Added
- CI workflow с проверками `npm test`, `check:module-graph`, `check:domain-boundaries`, `check:unused-exports`.
- Скрипты контроля качества модульного графа, доменных границ и неиспользуемых экспортов.
- Единый `GlobalApi` для публикации модулей в `window.SmartNotes.modules`.
- Модуль `NoteActionsUI` для централизованной UI-обработки действий заметок.
- Отчёт `docs/repository-health-check-2026-04-01.md`.

### Changed
- Редактор переведён на lazy-init через `js/editor/bootstrap.js` и `js/editor/runtime-loader.js`.
- `index.html` очищен от прямой ранней загрузки тяжёлых editor runtime скриптов.
- Auth/external storage поток обновлён: синхронизация статуса провайдера запускается по необходимости (OAuth redirect flag).

### Removed
- Неиспользуемые модули/экспорты: `js/editor/core.js`, `js/editor/core-utils.js`, `requestGoogleAccessToken`.
