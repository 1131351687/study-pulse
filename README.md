# StudyPulse

StudyPulse is a local-first learning workspace. It is designed to combine computer usage data from ActivityWatch, a daily learning journal, lightweight tasks, schedule blocks, and configurable AI providers to produce daily and weekly learning plans.

The project is currently at `v0.1`: a local runnable skeleton with a FastAPI backend and React/Vite frontend.

## Current Scope

Implemented in this skeleton:

- Local FastAPI API app.
- Health endpoint at `GET /api/health`.
- Public settings placeholder at `GET /api/settings`.
- React/Vite frontend app shell.
- Navigation placeholders for Today, Journal, Tasks, Schedule, and Settings.
- Frontend health badge that checks whether the backend is online.

Not implemented yet:

- ActivityWatch aggregation.
- SQLite persistence.
- Journal, task, and schedule CRUD.
- AI provider calls.
- Daily or weekly plan generation.

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

## Run Locally

Start the backend API:

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
