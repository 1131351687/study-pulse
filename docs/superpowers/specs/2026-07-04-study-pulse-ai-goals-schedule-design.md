# StudyPulse AI Goals and Schedule Design

Date: 2026-07-04
Status: Draft approved for planning
Project root: `D:\try\xm`
Depends on: `2026-07-03-study-pulse-design.md`

## 1. Purpose

This design refines the learning workflow after the first AI planning loop. The project should move from a generic daily AI plan toward a clearer structure built around two axes:

- Date-based daily learning records.
- Goal-based AI planning.

The main change is that the product should no longer treat history, schedule, journal, task execution, AI summaries, and AI planning as loosely related panels. Instead, it should present them as one coherent learning system.

## 2. Product Direction

The product should follow a goal-driven and date-anchored model.

Daily learning should be understood through a date record:

- What was planned.
- What was actually studied.
- What the user wrote.
- What AI concluded.

Longer-term learning should be understood through goals:

- What the user is trying to learn.
- How progress has evolved across days.
- What should be studied today and this week.

This split gives each module a clear purpose:

- `Schedule` becomes the main date view for both today and history.
- `Tasks` becomes the execution list for today.
- `AI Summary` becomes the daily review module.
- `AI Planning` becomes the goal-driven planning module.

## 3. Revised Information Architecture

The navigation should be reshaped to reflect the new responsibilities.

Recommended navigation:

- `Today`
- `Schedule`
- `Tasks`
- `Learning Goals`
- `AI Summary`
- `AI Planning`
- `Journal`
- `Settings`

The previous `History` page should be removed. Its responsibilities should move into `Schedule`.

### Today

`Today` remains a quick overview page. It should answer:

- How much time was tracked today.
- What the main applications and topics were.
- Whether the backend and ActivityWatch are healthy.
- Where the user should go next.

It should not be the main editing surface for history or AI planning.

### Schedule

`Schedule` becomes the main date-centered workspace. It should merge the old schedule and history concepts.

For a selected date, it should show:

- Schedule blocks for that day.
- Manual journal content for that day.
- ActivityWatch day summary.
- AI summary records for that day.
- AI planning records generated for that day.

This page should work for both today and past dates. It is the primary place to review learning progress over time.

### Tasks

`Tasks` should be narrowed to today's execution layer.

The page should support:

- Add today's tasks.
- View today's tasks.
- Mark tasks complete.
- Delete tasks.
- Accept selected AI-planned tasks into today's list.

This page should no longer be used as the main history browser.

### Learning Goals

`Learning Goals` is a new module. It is the foundation for AI planning.

Each goal should include:

- Name.
- Description.
- Current focus or stage.
- Active flag.

Goals should be editable locally and selectable by AI planning.

### AI Summary

`AI Summary` is a new daily review module.

It should generate a summary for a selected date using:

- The day's schedule.
- The day's journal.
- The day's task completion state.
- The day's ActivityWatch data.

It should produce structured output including:

- Score.
- Summary.
- Strengths.
- Blockers.
- Improvement suggestions.

Multiple summaries for the same date may exist. They should be grouped under that date and displayed together on the schedule page.

### AI Planning

`AI Planning` is a new goal-driven planning module.

Planning should always be generated for one selected goal at a time. It should consider:

- The goal itself.
- Recent learning progress.
- Past AI summaries.
- Recent journals, schedules, and tasks.

It should produce:

- Today's learning plan.
- This week's learning plan.
- Suggested task list.

Suggested tasks must remain suggestions until the user explicitly chooses to add them to today's tasks.

### Journal

The journal remains the user's manual high-trust input. It should remain a separate page for direct editing.

However, on the schedule page the journal should appear as part of the selected date record, alongside AI summaries and planning output.

## 4. Functional Requirements

### 4.1 AI Summary Behavior

AI summary generation should:

- Work per date.
- Save results as separate records.
- Not automatically overwrite or physically rewrite the journal body.
- Be shown together with the day's journal and schedule in the schedule page.

The user asked that same-day summary content should be added together under the same date. This design interprets that as display-level composition rather than raw text mutation. This keeps the journal editable and preserves clean structure.

### 4.2 AI Planning Behavior

AI planning should:

- Require a selected learning goal.
- Generate goal-specific plans.
- Include both daily and weekly scope.
- Generate suggested tasks.
- Never auto-insert suggested tasks into the tasks table.
- Allow the user to manually choose which suggested tasks to adopt.

### 4.3 Tasks Behavior

Tasks should be treated as today's actionable list rather than the main archive of learning progress.

Tasks accepted from AI planning should default to `today` unless the user explicitly chooses another placement later.

### 4.4 Schedule and History Merge

The schedule page should be date-switchable and should absorb historical review.

The result should be a "daily learning record" view rather than a narrow time-block editor.

## 5. Data Model Changes

The current database stores:

- `journals`
- `tasks`
- `schedule_blocks`
- `generated_plans`
- `ai_config`

That is not enough for goal-driven planning and structured daily summaries.

Recommended additions:

### `learning_goals`

Stores user-defined learning goals.

Suggested fields:

- `id`
- `name`
- `description`
- `current_focus`
- `active`
- `created_at`
- `updated_at`

### `ai_summaries`

Stores structured AI daily summaries.

Suggested fields:

- `id`
- `date`
- `provider`
- `score`
- `content_json`
- `created_at`

The JSON should include summary, strengths, blockers, and improvement suggestions.

### `ai_plans`

Stores structured AI plans for a goal and date.

Suggested fields:

- `id`
- `date`
- `goal_id`
- `provider`
- `content_json`
- `created_at`

The JSON should include today's plan, this week's plan, and suggested tasks.

### `ai_plan_suggested_tasks`

Optional but recommended if suggested tasks need individual acceptance tracking.

Suggested fields:

- `id`
- `plan_id`
- `title`
- `reason`
- `accepted`
- `accepted_task_id`
- `created_at`

This table is optional if the same information can stay inside `ai_plans.content_json`, but a separate table makes partial acceptance easier to manage.

## 6. Data Composition Strategy

The schedule page should compose a selected day from multiple sources:

```text
selected date
  -> journal
  -> schedule blocks
  -> ActivityWatch summary
  -> AI summaries for the date
  -> AI plans for the date
```

This composition should happen in the backend route or in a lightweight frontend aggregator, but the stored records should remain separate.

The system should prefer composition over destructive merging.

## 7. Backend API Direction

Recommended new or revised endpoints:

### Goals

- `GET /api/goals`
- `POST /api/goals`
- `PATCH /api/goals/{goal_id}`
- `DELETE /api/goals/{goal_id}` or soft-disable through `active`

### AI Summary

- `POST /api/ai/summary`
- `GET /api/ai/summary/{date}`

### AI Planning

- `POST /api/ai/plan`
- `GET /api/ai/plan/{date}/{goal_id}`
- `POST /api/ai/plan/{plan_id}/accept-task`

### Schedule Page Composition

Either:

- Extend `GET /api/schedule/{date}` to include the composed daily record.

Or:

- Add a dedicated route such as `GET /api/day-record/{date}`.

The dedicated day-record route is cleaner and is recommended.

## 8. Frontend Behavior

### Schedule Page

The page should include:

- Date picker.
- Schedule blocks.
- Journal preview or embedded journal panel.
- AI summaries list for the selected date.
- AI plans list for the selected date.
- ActivityWatch summary.

This page is the main history browser.

### AI Summary Page

The page should include:

- Date picker.
- Generate summary button.
- Saved summaries for the selected date.
- Score display.
- Summary sections for strengths, blockers, and improvements.

### AI Planning Page

The page should include:

- Goal selector.
- Date selector.
- Generate planning button.
- Today's plan block.
- This week's plan block.
- Suggested tasks with per-task acceptance actions.

### Tasks Page

The page should present only today's task workflow. It may show accepted AI-planned tasks, but it should not behave like the primary history page.

## 9. Error Handling

The AI modules should continue the newer pattern already introduced:

- Return readable backend error messages.
- Support provider test failures with explicit details.
- Keep planning and summary failures isolated from the rest of the app.

If ActivityWatch is unavailable, AI summary and planning should still work with journal, tasks, and schedule data, but the output should reflect the missing activity source.

If no learning goals exist, AI planning should not generate a plan. The page should guide the user to create a goal first.

## 10. Testing Strategy

The implementation should be verified with focused checks:

1. Backend import check.
2. Frontend build.
3. CRUD smoke tests for goals.
4. Mock AI summary generation.
5. Mock AI planning generation for a selected goal.
6. Manual acceptance flow that converts one suggested task into a real task.
7. Day-record route smoke test for current and previous dates.

## 11. Acceptance Criteria

This redesign is complete when:

1. The navigation no longer includes a separate history page.
2. The schedule page can browse dates and show the full daily learning record.
3. The tasks page is focused on today's tasks.
4. The user can create and manage one or more learning goals.
5. The user can generate AI summaries per day.
6. AI summaries are stored by date and shown together with the day record.
7. The user can generate AI plans per goal.
8. AI plans include both today's and this week's recommended study content.
9. Suggested tasks remain optional until the user explicitly accepts them.
10. Accepted suggested tasks appear in today's tasks.

## 12. Out of Scope for This Iteration

The following remain intentionally out of scope:

- Automatic task acceptance.
- Automatic journal rewriting.
- Long-term goal analytics such as completion percentage.
- Embeddings, semantic search, or memory retrieval beyond simple recent-history context.
- Full calendar synchronization.

## 13. Recommendation

Use a balanced implementation approach:

- Reshape the information architecture now.
- Add structured tables for goals, summaries, and plans.
- Keep the journal body intact.
- Compose same-day content in the schedule view instead of mutating stored journal text.

This approach keeps the product simple enough for the current codebase while giving it a stable foundation for future weekly review, target tracking, and longitudinal learning analysis.
