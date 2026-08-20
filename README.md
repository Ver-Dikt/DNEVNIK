# ЕЖЕДНЕВНИК

Персональное PWA-приложение для быстрого сохранения задач, покупок, идей, ссылок, цен и заметок. Главный сценарий: быстро написать или надиктовать текст, получить структурированный preview и сохранить результат.

## Стек

- Next.js App Router
- React
- TypeScript strict
- Tailwind CSS
- Supabase-ready schema
- PWA manifest + service worker
- AI provider abstraction: mock и OpenAI-compatible adapter

## Локальный запуск

```bash
npm install
npm run dev
```

Открой `http://localhost:3000`.

## Проверки

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Environment

Скопируй `.env.example` в `.env.local` и заполни значения.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

AI_ENABLED=false
AI_PROVIDER=mock
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
```

Ключи AI используются только на сервере в `/api/ai/parse` и `/api/ai/query`.

## Supabase

1. Создай проект Supabase.
2. Укажи `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Примени migration из `supabase/migrations/20260820122000_initial_schema.sql`.

Схема содержит:

- `profiles`
- `projects`
- `entries`

Для всех таблиц включен RLS, данные привязаны к `auth.uid()`.

## AI provider

По умолчанию работает `MockAIProvider`, поэтому приложение можно использовать без ключей и баланса.

Для Groq, Qwen, OpenAI или другого OpenAI-compatible API:

```env
AI_ENABLED=true
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.example.com/v1
AI_API_KEY=...
AI_MODEL=...
```

Логика выбора провайдера находится в `src/lib/ai-provider.ts`.

## Что работает в MVP

- Главный экран "Сегодня"
- Быстрое добавление
- AI preview перед сохранением
- Local Smart Parser для идей, покупок, задач, ожидания, цен, количества, URL, дат, проектов и confidence
- Разделы: Сегодня, Неделя, Задачи, Проекты, Покупки, Идеи, Inbox, Настройки
- Редактирование заголовка записи
- Завершение задачи с Undo
- Удаление записей
- Локальное хранение в `localStorage`
- Learned rules в `localStorage` (`dnevnik.learnedRules`)
- PWA manifest и базовый offline shell
- Supabase migration

## Smart Parser

Parser находится в `src/lib/smart-parser/`.

Модули:

- `normalizer.ts`
- `tokenizer.ts`
- `intent-detector.ts`
- `date-parser.ts`
- `price-parser.ts`
- `quantity-parser.ts`
- `url-parser.ts`
- `project-matcher.ts`
- `priority-parser.ts`
- `status-parser.ts`
- `entity-extractor.ts`
- `confidence.ts`
- `learned-rules.ts`

Логика `/api/ai/parse`: сначала local parser, затем optional AI fallback только при низкой уверенности и включенном AI provider.

## Следующие шаги

- Подключить полноценную авторизацию Supabase в UI.
- Синхронизировать локальные записи с таблицей `entries`.
- Расширить parser тестами из мастер-ТЗ.
- Добавить отдельные формы редактирования покупок и проектов.
- Подключить speech-to-text API как замену browser speech recognition.
