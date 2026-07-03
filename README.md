# StudyPulse

StudyPulse is a local-first learning workspace. It is designed to combine computer usage data from ActivityWatch, a daily learning journal, lightweight tasks, schedule blocks, and configurable AI providers to produce daily and weekly learning plans.

The project is currently at `v0.4`: a local workspace with ActivityWatch aggregation, SQLite persistence, journals, tasks, schedule blocks, and mock-first AI daily planning.

## Current Scope

Implemented so far:

- Local FastAPI API app.
- Health endpoint at `GET /api/health`.
- Public settings placeholder at `GET /api/settings`.
- React/Vite frontend app shell.
- Navigation for Today, Journal, Tasks, Schedule, AI Config, and Settings.
- Chinese/English interface language toggle.
- Dedicated History page for past daily progress.
- Dedicated AI Plan page for per-day generation and review.
- Frontend health badge that checks whether the backend is online.
- ActivityWatch today aggregation at `GET /api/activity/today`.
- SQLite database stored at `data/study-pulse.sqlite` by default.
- Daily journal save/load.
- Task create, complete, and delete.
- Schedule block create and delete.
- Daily AI summary and next-day plan generation at `POST /api/ai/daily-plan`.
- Saved generated plan lookup at `GET /api/ai/daily-plan/{date}`.
- AI provider settings page for `mock`, OpenAI-compatible APIs, and Ollama.
- AI provider connectivity test endpoint and UI button.
- Runtime status panel and stop controls in the web UI.
- One-command local startup script at `start-study-pulse.ps1`.

Not implemented yet:

- Weekly plan generation.
- One-click apply for AI suggestions.
- Advanced editing, filtering, and calendar sync.

## Requirements

- Python 3.11 or newer.
- Node.js 20 or newer.
- npm.

## Setup

Create and activate a local Python virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install backend dependencies:

```powershell
npm run install:api
```

Install frontend dependencies:

```powershell
npm install
```

Optional local environment configuration can be copied from `.env.example`. API keys and local config files should not be committed.

AI defaults to the deterministic `mock` provider, so the app works without credentials. To use another provider, set these environment variables before starting the backend:

```powershell
$env:STUDY_PULSE_AI_PROVIDER="openai"
$env:STUDY_PULSE_AI_ENDPOINT="https://api.openai.com/v1"
$env:STUDY_PULSE_AI_MODEL="gpt-4.1-mini"
$env:STUDY_PULSE_AI_API_KEY="your-api-key"
```

For Ollama:

```powershell
$env:STUDY_PULSE_AI_PROVIDER="ollama"
$env:STUDY_PULSE_AI_ENDPOINT="http://localhost:11434"
$env:STUDY_PULSE_AI_MODEL="llama3.1"
```

Set `STUDY_PULSE_AI_SEND_ACTIVITY_TITLES=false` if ActivityWatch window titles should be omitted from AI context.

## Run Locally

For the simplest local launch on Windows, run:

```powershell
.\start-study-pulse.ps1
```

This creates `.venv` if needed, installs missing dependencies, starts the backend and frontend, and opens the app.

You can also use npm:

```powershell
npm run start:local
```

To start services manually, start the backend API:

```powershell
npm run dev:api
```

Start the frontend in another terminal:

```powershell
npm run dev:web
```

Open the frontend at:

```text
http://127.0.0.1:5173
```

The backend defaults to:

```text
http://127.0.0.1:7788
```

Local user data is stored in:

```text
data/study-pulse.sqlite
```

The `data/` directory is ignored by git.

## Useful Checks

Verify the backend app imports:

```powershell
npm run check:api
```

Build the frontend:

```powershell
npm run build:web
```

## Roadmap

- `v0.1`: Local runnable skeleton.
- `v0.2`: ActivityWatch aggregation and Today usage summary.
- `v0.3`: Journal, tasks, schedule, and SQLite persistence.
- `v0.4`: AI summary and next-day plan generation.
- `v0.5`: Weekly review and open-source polish.

## Documentation

- Design spec: `docs/superpowers/specs/2026-07-03-study-pulse-design.md`
- v0.1 plan: `docs/superpowers/plans/2026-07-03-v0.1-local-runnable-skeleton-plan.md`
- v0.2 plan: `docs/superpowers/plans/2026-07-03-v0.2-activitywatch-aggregation-plan.md`
- v0.3 plan: `docs/superpowers/plans/2026-07-03-v0.3-journal-tasks-schedule-plan.md`
- v0.4 plan: `docs/superpowers/plans/2026-07-03-v0.4-ai-summary-planning-plan.md`
