# SmartNotes — актуализация репозитория

Дата: 2026-03-26

## Что уже готово
- Вынесена централизованная backend-конфигурация в модуль `js/core/backendConfig.js`.
- Подключение backend-конфигурации добавлено в `index.html`.
- Интеграция endpoint-конфигурации добавлена в UI-анализатор и Google Drive provider.
- Восстановлен рабочий тестовый контур: добавлен `tests/stability.test.mjs`, соответствующий `npm test`.

## Текущая структура
- `js/core/` — инфраструктурные и платформенные модули приложения.
- `js/ui/` — слой интерфейса, рендеринг, layout и пользовательские события.
- `js/notes/` — бизнес-логика заметок, сервисы, репозитории, presentation.
- `js/editor/` — модуль редактора, медиа, drawing, autosave и команды.
- `docs/` — документация по продукту и техническому состоянию.

## Что можно улучшить дальше
- Перевести критичные legacy-скрипты из глобального namespace в ESM-подмодули с явными контрактами.
- Добавить изолированные unit-тесты для `js/notes/services/*` и `js/ui/render/*`.
- Внедрить обязательный CI-пайплайн с проверкой линтинга, тестов и сборки PR.
- Стандартизировать runtime-конфиг через единый источник (например, `window.__SMARTNOTES_BACKEND_URL__`) для dev/stage/prod.

## Общая информация
- Основной frontend-репозиторий: текущий.
- Дополнительный backend-репозиторий: https://github.com/TopMob/backendfornmartnotes
- Прод backend URL: https://backendfornmartnotes.vercel.app/
- Для переопределения backend без изменения кода можно использовать:
  - `window.__SMARTNOTES_BACKEND_URL__`
  - `localStorage['smartnotes.backendBaseUrl']`
