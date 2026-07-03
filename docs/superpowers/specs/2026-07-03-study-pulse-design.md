# StudyPulse Design

Date: 2026-07-03
Status: Draft approved for planning
Project root: `D:\try\xm`

## 1. Product Positioning

StudyPulse is a local-first personal learning workspace. It helps the user understand how computer time was spent, supplement that record with a daily learning journal, manage simple tasks and schedules, and use configurable AI providers to generate daily and weekly learning plans.

The first version is for personal use and open-source self-hosting. It should be simple to run locally, simple to interact with, and careful with privacy.

Core daily loop:

1. Read computer usage data from ActivityWatch.
2. Let the user add a daily learning journal, tasks, and schedule blocks.
3. Use AI to summarize actual learning content, time distribution, blockers, and unfinished work.
4. Generate suggested tasks and plans for the next day or week.
5. Let the user review and confirm AI suggestions before saving them.

## 2. MVP Scope

The MVP includes:

- Local browser UI served from a local web app.
- FastAPI backend listening on localhost only.
- SQLite database for local persistence.
- ActivityWatch integration through its local REST API.
- Manual learning journal per day.
- Simple task list with completion state.
- Simple daily schedule blocks.
- Configurable AI provider support for OpenAI-compatible APIs and Ollama.
- Daily summary and next-day plan generation.
- Manual weekly summary and weekly plan generation.
- Settings for ActivityWatch, AI provider, model, endpoint, and privacy behavior.

The MVP excludes:

- Account system, cloud sync, and hosted SaaS behavior.
- Full desktop app packaging.
- Complex calendar integrations such as Google Calendar or Outlook.
- Screenshot capture, OCR, or screen recording.
- Full project management features such as nested task trees, kanban boards, or team collaboration.

## 3. Architecture

The recommended architecture is:

```text
Browser UI
  -> Local Web API
  -> SQLite + ActivityWatch + AI Provider
```

The frontend runs in the browser and focuses on a small number of views: Today, Journal, Tasks, Schedule, and Settings. The backend runs as a local FastAPI service, reads ActivityWatch data, stores local data, calls AI providers, and exposes simple API routes for the UI.

The service should default to `127.0.0.1` and should not expose itself to the local network unless the user explicitly configures that later.

## 4. Main Modules

### ActivityWatch Adapter

Responsibilities:

- Connect to the configured ActivityWatch URL, defaulting to `http://localhost:5600`.
- Discover relevant buckets.
- Read events for a selected day.
- Extract application names, window titles, browser titles or URLs when available, timestamps, durations, and active or idle state.
- Aggregate raw events into day-level snapshots.

The first version should store aggregated snapshots instead of every raw ActivityWatch event. This keeps the database smaller and reduces privacy exposure.

### Activity Classifier

Responsibilities:

- Convert aggregated activity records into learning-oriented categories.
- Use deterministic rules for obvious applications and websites.
- Use AI only when useful for topic inference and summary generation.

Initial categories:

- Programming or project practice.
- Reading and notes.
- Video learning.
- Search and reference lookup.
- Social or entertainment.
- Uncategorized.

### Planner Core

Responsibilities:

- Manage journals, tasks, schedule blocks, summaries, and generated plans.
- Build the daily context passed to AI providers.
- Keep AI suggestions separate from confirmed user data.
- Apply confirmed suggestions to tasks and schedule blocks only after user approval.

### AI Provider Layer

Responsibilities:

- Provide a unified interface for text generation and structured JSON responses.
- Support OpenAI-compatible APIs.
- Support Ollama for local model usage.
- Keep provider-specific request details outside the planner logic.

The provider layer should make it easy to add more providers later.

### Local Database

SQLite stores:

- Daily learning journals.
- Tasks and completion state.
- Daily schedule blocks.
- ActivityWatch aggregated snapshots.
- AI-generated summaries and plans.
- Non-secret settings.

API keys should not be committed to git. The first version may use local environment variables or a local ignored config file. Later versions can use OS keychain integration.

## 5. Core Views

### Today

The default landing view. It shows:

- Total active computer usage for the day.
- Estimated learning time.
- Application and website time distribution.
- Inferred learning topics.
- Today's task completion status.
- Buttons to generate today's summary and tomorrow's plan.

The Today view should answer, within a few seconds: where did the day go, what did I learn, and what should happen next?

### Journal

A simple date-based learning journal editor. The journal is a high-trust input for AI analysis and should take priority over guesses based on window titles.

Example journal style:

```text
今天主要学习了 transformer 的 attention 机制，看了 minimind 相关代码。
卡住的地方：RoPE 和 KV cache 还没完全理解。
明天想继续：手写一遍 attention forward。
```

### Tasks

A simple task list with:

- Create task.
- Mark complete.
- Delete task.
- Assign to today, tomorrow, or this week.
- Optional priority.
- Optional area, such as `AI学习`, `英语`, or `项目开发`.

The first version should avoid nested task trees and heavy project-management concepts.

### Schedule

A daily schedule made of simple time blocks:

```text
09:00-10:30 学 attention
14:00-15:00 写项目 README
20:00-20:30 复盘
```

AI may generate suggested schedule blocks, but the user must review and confirm them before they are saved.

### Settings

Settings include:

- ActivityWatch URL.
- AI provider type: OpenAI-compatible or Ollama.
- API endpoint.
- Model.
- Privacy mode for sending activity titles to AI.
- Daily planning preference: light, standard, or strict.

## 6. Data Flow

Daily analysis follows this flow:

```text
ActivityWatch aggregated data
        +
User journal / tasks / schedule
        -> Build daily context locally
        -> AI generates summary and plan suggestions
        -> User reviews or edits suggestions
        -> Confirmed data is saved to SQLite
```

AI should not directly mutate tasks or schedules. It only proposes summaries, tasks, and schedule blocks. User confirmation is required before suggestions become saved plans.

## 7. AI Input and Output

The AI input should use the minimum necessary context. Instead of sending a full raw activity stream, the backend should send a compact daily context such as:

```text
日期：2026-07-03
今日活动聚合：
- VS Code / minimind / attention.py: 95 分钟
- Chrome / PyTorch docs / MultiheadAttention: 40 分钟
- Obsidian / LLM学习笔记: 30 分钟

用户日志：
今天主要学习 attention 和 RoPE。

今日任务：
- 完成 attention 代码阅读：已完成
- 写 RoPE 笔记：未完成
```

AI output should be structured JSON that the application can render, edit, and save:

```json
{
  "summary": "今天主要学习了 Transformer attention 机制...",
  "topics": ["Transformer", "Attention", "RoPE"],
  "timeInsights": ["编程实践时间较多，笔记整理偏少"],
  "unfinishedReasons": ["RoPE 笔记任务未完成，可能需要拆小"],
  "suggestedTasks": [],
  "tomorrowSchedule": []
}
```

## 8. Privacy Behavior

The settings page should expose a clear privacy choice:

- Send aggregated title summaries to AI.
- Send only local rule-based categories, without specific titles.
- Use local model only.

The recommended default is to send aggregated title summaries instead of raw event streams. This gives AI enough context to be useful while avoiding unnecessary exposure of all activity details.

## 9. Technical Stack

Recommended stack:

```text
Frontend: React + TypeScript + Vite
Backend: Python + FastAPI
Database: SQLite
AI: OpenAI-compatible API + Ollama adapter
Activity: ActivityWatch REST API adapter
```

Rationale:

- Python and FastAPI are a good fit for local services, time-data processing, ActivityWatch integration, and AI API calls.
- SQLite is enough for personal local use and easy to back up.
- React and Vite provide a comfortable foundation for dashboard interactions.
- A thin AI provider abstraction keeps future provider changes contained.
- The web app can later be wrapped with Tauri if a desktop app becomes useful.

Suggested project structure:

```text
study-pulse/
  apps/
    web/
    api/
  packages/
    shared/
  data/
    study-pulse.sqlite
  docs/
    superpowers/
      specs/
  README.md
```

Suggested backend structure:

```text
apps/api/
  app/
    main.py
    config.py
    db.py
    models/
    activity/
    ai/
    planner/
    routes/
    prompts/
```

Suggested frontend structure:

```text
apps/web/src/
  pages/
    Today.tsx
    Journal.tsx
    Tasks.tsx
    Schedule.tsx
    Settings.tsx
  components/
    ActivitySummary.tsx
    TaskList.tsx
    PlanPreview.tsx
    ProviderSettings.tsx
  api/
    client.ts
```

## 10. MVP Acceptance Criteria

The MVP is complete when:

1. A local user can start the backend and frontend and open the browser UI.
2. The backend listens on localhost by default.
3. The user can configure the ActivityWatch URL.
4. The Today view shows current-day ActivityWatch aggregation when ActivityWatch is available.
5. The app shows a clear non-blocking message when ActivityWatch is unavailable.
6. The user can create and edit a daily learning journal.
7. The user can create, complete, and delete tasks.
8. The user can create and edit daily schedule blocks.
9. The user can configure an OpenAI-compatible provider or Ollama.
10. The user can generate a daily summary and next-day plan.
11. AI-generated tasks and schedule blocks require user confirmation before being saved.
12. The user can manually trigger a weekly summary and weekly plan from the last seven days of data.
13. Local data files and API keys are ignored by git.
14. README explains installation, local startup, ActivityWatch setup, AI setup, and privacy behavior.

## 11. Roadmap

### v0.1: Local Runnable Skeleton

- Create backend, frontend, SQLite setup, settings page, and basic README.

### v0.2: ActivityWatch Aggregation

- Read ActivityWatch data for today.
- Display application and website time distribution.
- Handle missing ActivityWatch gracefully.

### v0.3: Journal, Tasks, and Schedule

- Add daily journal editing.
- Add simple task management.
- Add daily schedule blocks.

### v0.4: AI Summary and Next-Day Plan

- Add OpenAI-compatible provider.
- Add Ollama provider.
- Generate structured daily summaries and tomorrow plans.
- Add suggestion review and confirmation flow.

### v0.5: Weekly Review and Open-Source Polish

- Generate recent-seven-day summary.
- Generate weekly plan.
- Add screenshots and clearer docs.
- Clean up example config and privacy notes.

## 12. Later Extensions

Potential future features:

- Tauri desktop wrapper with tray, startup, and local notifications.
- Browser history, editor plugins, Git commits, and Obsidian diary integration.
- Long-term learning topic tracking.
- Weak-point and review suggestions.
- `.ics` calendar export.
- Local embedding search over journals and summaries.

## 13. Open Decisions

These are intentionally deferred until implementation planning:

- Exact frontend component library.
- Exact SQLite migration tool.
- Whether to use SQLModel, SQLAlchemy, or direct SQLite access.
- How to store secrets in the first version beyond git-ignored local configuration.
- Exact prompt templates and JSON schema validation details.

