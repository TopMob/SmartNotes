# SmartNotes

Веб-приложение для создания и организации заметок с рисованием, совместным доступом и AI-инструментами.

**Демо:** [smartnotess.vercel.app](https://smartnotess.vercel.app/)

## Возможности

- папки, многостраничные заметки и архив;
- редактор текста с форматированием и медиа;
- слой рисования с undo/redo;
- общий доступ с ролями `viewer` и `editor`;
- AI-анализ и генерация метаданных;
- offline-режим и синхронизация с Supabase.

## Запуск

```bash
git clone https://github.com/TopMob/SmartNotes.git
cd SmartNotes
npm install
```

Создайте `.env.local` и укажите необходимые значения Supabase и AI-провайдеров. Перечень переменных описан в документации проекта.

```bash
npm run dev
```

## Проверки

```bash
npm run lint
npm test
npm run check:module-graph
npm run check:domain-boundaries
npm run check:unused-exports
```

## Документация

- [архитектура](docs/architecture.md);
- [AI-интеграция](docs/ai-engine.md);
- [редактор и UI](docs/editor-and-ui.md);
- [roadmap](docs/roadmap.md).

## Стек

Next.js, TypeScript, Vanilla JS ES Modules, Supabase, PostgreSQL, Service Worker и Canvas API.

Проект развивается; конфигурация и API могут изменяться.
