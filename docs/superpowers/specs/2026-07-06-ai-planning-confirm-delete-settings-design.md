# AI Planning Confirm Flow + Task Delete in Schedule Records

Date: 2026-07-06

## Summary

Three interrelated UX improvements to the StudyPulse task and AI planning system:

1. AI planning page shows generated text plan (`todayPlan` / `weekPlan`) alongside suggested tasks
2. AI-suggested tasks require user confirmation before being inserted into the database
3. Schedule record task list gains a per-task delete button, togglable from Settings

---

## Changes

### 1. AI Planning Response — Show Plan Text + Delayed Task Insertion

**Current behavior:**
`POST /api/ai/plan` immediately inserts `suggestedTasks` where `plannedFor == "today"` into the `tasks` table and returns `{"tasks": [...]}`.

**New behavior:**
`POST /api/ai/plan` does NOT write to the `tasks` table. It returns the full AI result:

```json
{
  "todayPlan": ["Read one focused unit for X.", "Write notes about Y."],
  "weekPlan": ["Break goal into subtopics.", "Reserve 3 study blocks."],
  "suggestedTasks": [
    {"title": "Study Transformers", "reason": "Main active target.", "plannedFor": "today"},
    {"title": "Write attention notes", "reason": "Turn study into record.", "plannedFor": "today"}
  ]
}
```

The `_mock_goal_plan` and `_normalize_goal_plan` functions already produce `todayPlan`, `weekPlan`, `suggestedTasks`. The only backend change is removing the DB-insertion loop in `POST /ai/plan` and including the plan text in the response.

### 2. New Endpoint: `POST /api/tasks/batch`

**Purpose:** Bulk-insert user-confirmed AI-suggested tasks.

**Request:**
```json
{
  "tasks": [
    {"title": "Study Transformers", "plannedFor": "today", "area": "ML", "priority": "normal"},
    {"title": "Write notes", "plannedFor": "today", "area": "ML", "priority": "normal"}
  ],
  "forDate": "2026-07-06"
}
```

**Response:** `Task[]` — same shape as `GET /api/tasks` response items.

**Logic:** Iterates `tasks`, inserts each with `for_date = forDate`, returns array of created task objects.

### 3. Frontend: AIPlanningView Redesign

**Layout after generation:**

```
┌─────────────────────────────────┐
│ [Goal ▼]  [Date ▼]  [Generate] │
├─────────────────────────────────┤
│                                 │
│  📋 今日计划                     │
│  • Read one focused unit...     │
│  • Write notes about...         │
│                                 │
│  📋 本周计划                     │
│  • Break goal into subtopics    │
│  • Reserve 3 study blocks       │
│                                 │
│  📋 推荐任务 (勾选后确认添加)     │
│  ☑ Study Transformers           │
│  ☐ Write attention notes        │
│                                 │
│  [确认添加 (2/2)]                │
│                                 │
└─────────────────────────────────┘
```

**States:**

| State | Display |
|---|---|
| Initial | Toolbar + empty state text |
| Generating | Button shows "生成中...", content shows spinner/status |
| Generated | Plan text + checkbox task list + confirm button |
| Confirming | Button shows "添加中...", disabled |
| Confirm done | Toast/summary + reset to initial |
| Error | Warning text below toolbar |

**`handleConfirm` flow:**
1. Collect checked tasks with their titles, `plannedFor`, `area` from goal, `priority: "normal"`
2. Call `POST /api/tasks/batch` with `forDate = date`
3. On success: call `onTaskAccepted()` to refresh task list, reset view to initial/empty state
4. On error: show error

### 4. Frontend: ScheduleView Task Delete Button

**Current task row:**
```
☐ Study Transformers       ML · normal
```

**New task row (when enabled):**
```
☐ Study Transformers       ML · normal  🗑️
```

**Behavior:**
- Trash icon calls `DELETE /api/tasks/{id}`
- On success: reload the day record
- On error: show warning

**Storage:**
- `localStorage.getItem("schedule_task_delete_enabled")` — `"true"` | `"false"`
- Default: `true`

### 5. Frontend: Settings Toggle

Add a new section to `SettingsView`:

```
UI 设置 / UI Settings
┌─────────────────────────────┐
│ ☑ 日程记录显示删除按钮       │
│   Show delete in schedule   │
└─────────────────────────────┘
```

- Checkbox toggles `localStorage.setItem("schedule_task_delete_enabled", ...)`
- Reads initial value from localStorage on mount
- No backend change needed

---

## Files Changed

| File | Change |
|---|---|
| `apps/api/app/routes/ai.py` | Remove DB-insertion loop from `POST /ai/plan`; include `todayPlan`, `weekPlan` in response |
| `apps/api/app/routes/tasks.py` | Add `POST /tasks/batch` endpoint |
| `apps/web/src/api/client.ts` | Add `batchCreateTasks()` function; update `generateAIPlan` return type |
| `apps/web/src/App.tsx` | Redesign `AIPlanningView`; add delete button to ScheduleView task rows; add toggle to SettingsView |

---

## API Contracts

### `POST /api/ai/plan` (changed)

**Request:** (unchanged)
```json
{"date": "2026-07-06", "goalId": 1}
```

**Response:** (changed — tasks no longer have DB ids, plan text added)
```json
{
  "todayPlan": ["..."],
  "weekPlan": ["..."],
  "suggestedTasks": [
    {"title": "...", "reason": "...", "plannedFor": "today"}
  ]
}
```

### `POST /api/tasks/batch` (new)

**Request:**
```json
{
  "tasks": [{"title": "...", "plannedFor": "today", "area": "", "priority": "normal"}],
  "forDate": "2026-07-06"
}
```

**Response:** `Task[]` (standard task objects with DB ids)

---

## Error Handling

| Scenario | Handling |
|---|---|
| AI generation fails | `AIPlanningView` shows error text below toolbar |
| Batch insert partially fails | Backend wraps in transaction — all-or-nothing |
| Delete fails in schedule | Warning text shown; task row remains |
| localStorage setting missing | Default to `true` |
