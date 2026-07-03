import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  Plus,
  Save,
  Settings,
  Trash2,
} from "lucide-react";

import {
  createScheduleBlock,
  createTask,
  deleteScheduleBlock,
  deleteTask,
  fetchHealth,
  fetchJournal,
  fetchSchedule,
  fetchTasks,
  fetchTodayActivity,
  saveJournal,
  updateTask,
  type ActivityEntry,
  type HealthResponse,
  type PlannedFor,
  type Priority,
  type ScheduleBlock,
  type Task,
  type TodayActivityResponse,
} from "./api/client";

type ViewId = "today" | "journal" | "tasks" | "schedule" | "settings";

type NavItem = {
  id: ViewId;
  label: string;
  icon: typeof LayoutDashboard;
};

const navItems: NavItem[] = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "settings", label: "Settings", icon: Settings },
];

const todayIso = new Date().toISOString().slice(0, 10);

export function App() {
  const [activeView, setActiveView] = useState<ViewId>("today");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [activity, setActivity] = useState<TodayActivityResponse | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealth()
      .then((result) => {
        setHealth(result);
        setHealthError(null);
      })
      .catch((error: unknown) => {
        setHealth(null);
        setHealthError(error instanceof Error ? error.message : "Backend unavailable");
      });
  }, []);

  useEffect(() => {
    fetchTodayActivity()
      .then((result) => {
        setActivity(result);
        setActivityError(null);
      })
      .catch((error: unknown) => {
        setActivity(null);
        setActivityError(error instanceof Error ? error.message : "Activity data unavailable");
      });
  }, []);

  const content = useMemo(() => renderView(activeView, activity, activityError), [
    activeView,
    activity,
    activityError,
  ]);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand-block">
          <div className="brand-mark">SP</div>
          <div>
            <h1>StudyPulse</h1>
            <p>Local learning workspace</p>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={item.id === activeView ? "nav-item active" : "nav-item"}
                key={item.id}
                onClick={() => setActiveView(item.id)}
                type="button"
              >
                <Icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">v0.3 local workspace</p>
            <h2>{viewTitle(activeView)}</h2>
          </div>
          <HealthBadge health={health} error={healthError} />
        </header>

        {content}
      </main>
    </div>
  );
}

function HealthBadge({ health, error }: { health: HealthResponse | null; error: string | null }) {
  if (health) {
    return (
      <div className="status-badge online" title={`${health.appName} ${health.version}`}>
        API online
      </div>
    );
  }

  return (
    <div className="status-badge offline" title={error ?? "Backend unavailable"}>
      API offline
    </div>
  );
}

function viewTitle(view: ViewId): string {
  const match = navItems.find((item) => item.id === view);
  return match?.label ?? "Today";
}

function renderView(
  view: ViewId,
  activity: TodayActivityResponse | null,
  activityError: string | null,
) {
  switch (view) {
    case "today":
      return (
        <section className="content-grid">
          <Panel title="Today overview">
            <dl className="metric-grid">
              <div>
                <dt>Tracked time</dt>
                <dd>{activity ? formatDuration(activity.totalSeconds) : "--"}</dd>
              </div>
              <div>
                <dt>Learning time</dt>
                <dd>--</dd>
              </div>
              <div>
                <dt>Activity buckets</dt>
                <dd>{activity?.bucketCount ?? "--"}</dd>
              </div>
            </dl>
            <StatusNote activity={activity} error={activityError} />
          </Panel>
          <Panel title="Top applications">
            <ActivityList entries={activity?.topApps ?? []} totalSeconds={activity?.totalSeconds ?? 0} />
          </Panel>
          <Panel title="Top titles">
            <ActivityList entries={activity?.topTitles ?? []} totalSeconds={activity?.totalSeconds ?? 0} />
          </Panel>
          <Panel title="Next milestones">
            <ul className="plain-list">
              <li>Persist daily activity snapshots in SQLite.</li>
              <li>Add journal, tasks, and schedule editing.</li>
              <li>Use AI to classify learning topics.</li>
            </ul>
          </Panel>
        </section>
      );
    case "journal":
      return <JournalView />;
    case "tasks":
      return <TasksView />;
    case "schedule":
      return <ScheduleView />;
    case "settings":
      return <Placeholder title="Settings" body="ActivityWatch and AI provider settings will be wired through the local API." />;
  }
}

function JournalView() {
  const [date, setDate] = useState(todayIso);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("Loading journal...");

  useEffect(() => {
    fetchJournal(date)
      .then((journal) => {
        setContent(journal.content);
        setStatus(journal.updatedAt ? `Last saved ${journal.updatedAt}` : "No journal saved for this date.");
      })
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : "Could not load journal.");
      });
  }, [date]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Saving...");
    saveJournal(date, content)
      .then((journal) => setStatus(`Saved ${journal.updatedAt}`))
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : "Could not save journal.");
      });
  }

  return (
    <section className="single-column">
      <Panel title="Daily journal">
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            Notes
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write what you learned, what got stuck, and what you want to continue tomorrow."
              rows={12}
            />
          </label>
          <div className="form-actions">
            <button className="primary-button" type="submit">
              <Save aria-hidden="true" size={16} />
              Save journal
            </button>
            <span>{status}</span>
          </div>
        </form>
      </Panel>
    </section>
  );
}

function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [plannedFor, setPlannedFor] = useState<PlannedFor>("today");
  const [priority, setPriority] = useState<Priority>("normal");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("Loading tasks...");

  function reloadTasks() {
    fetchTasks()
      .then((items) => {
        setTasks(items);
        setStatus(items.length ? `${items.length} task(s)` : "No tasks yet.");
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not load tasks."));
  }

  useEffect(() => {
    reloadTasks();
  }, []);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setStatus("Task title is required.");
      return;
    }
    createTask({ title, plannedFor, priority, area })
      .then(() => {
        setTitle("");
        setArea("");
        reloadTasks();
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not create task."));
  }

  function handleToggle(task: Task) {
    updateTask(task.id, { completed: !task.completed })
      .then(reloadTasks)
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not update task."));
  }

  function handleDelete(id: number) {
    deleteTask(id)
      .then(reloadTasks)
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not delete task."));
  }

  return (
    <section className="content-grid task-layout">
      <Panel title="Add task">
        <form className="stack-form" onSubmit={handleCreate}>
          <label>
            Task
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Read attention code" />
          </label>
          <label>
            Area
            <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="AI learning" />
          </label>
          <div className="form-grid">
            <label>
              Plan
              <select value={plannedFor} onChange={(event) => setPlannedFor(event.target.value as PlannedFor)}>
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="week">This week</option>
              </select>
            </label>
            <label>
              Priority
              <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          <button className="primary-button" type="submit">
            <Plus aria-hidden="true" size={16} />
            Add task
          </button>
          <p className="form-status">{status}</p>
        </form>
      </Panel>

      <Panel title="Task list">
        {tasks.length === 0 ? (
          <p className="empty-state">No tasks yet.</p>
        ) : (
          <ul className="item-list">
            {tasks.map((task) => (
              <li key={task.id} className={task.completed ? "item-row done" : "item-row"}>
                <label className="check-label">
                  <input type="checkbox" checked={task.completed} onChange={() => handleToggle(task)} />
                  <span>{task.title}</span>
                </label>
                <small>
                  {task.plannedFor} / {task.priority}{task.area ? ` / ${task.area}` : ""}
                </small>
                <button className="icon-button" onClick={() => handleDelete(task.id)} type="button" title="Delete task">
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}

function ScheduleView() {
  const [date, setDate] = useState(todayIso);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("Loading schedule...");

  function reloadSchedule(targetDate = date) {
    fetchSchedule(targetDate)
      .then((items) => {
        setBlocks(items);
        setStatus(items.length ? `${items.length} block(s)` : "No schedule blocks for this date.");
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not load schedule."));
  }

  useEffect(() => {
    reloadSchedule(date);
  }, [date]);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setStatus("Schedule title is required.");
      return;
    }
    createScheduleBlock({ date, startTime, endTime, title })
      .then(() => {
        setTitle("");
        reloadSchedule();
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not create block."));
  }

  function handleDelete(id: number) {
    deleteScheduleBlock(id)
      .then(() => reloadSchedule())
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not delete block."));
  }

  return (
    <section className="content-grid task-layout">
      <Panel title="Add schedule block">
        <form className="stack-form" onSubmit={handleCreate}>
          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <div className="form-grid">
            <label>
              Start
              <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </label>
            <label>
              End
              <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </label>
          </div>
          <label>
            Block title
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Study attention" />
          </label>
          <button className="primary-button" type="submit">
            <Plus aria-hidden="true" size={16} />
            Add block
          </button>
          <p className="form-status">{status}</p>
        </form>
      </Panel>

      <Panel title="Schedule blocks">
        {blocks.length === 0 ? (
          <p className="empty-state">No schedule blocks for this date.</p>
        ) : (
          <ul className="item-list">
            {blocks.map((block) => (
              <li key={block.id} className="item-row schedule-row">
                <strong>
                  {block.startTime}-{block.endTime}
                </strong>
                <span>{block.title}</span>
                <button className="icon-button" onClick={() => handleDelete(block.id)} type="button" title="Delete block">
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}

function StatusNote({
  activity,
  error,
}: {
  activity: TodayActivityResponse | null;
  error: string | null;
}) {
  if (error) {
    return <p className="status-note warning">{error}</p>;
  }

  if (!activity) {
    return <p className="status-note">Loading ActivityWatch data...</p>;
  }

  return (
    <p className={activity.available ? "status-note" : "status-note warning"}>
      {activity.message}
    </p>
  );
}

function ActivityList({ entries, totalSeconds }: { entries: ActivityEntry[]; totalSeconds: number }) {
  if (entries.length === 0) {
    return <p className="empty-state">No activity data for this list yet.</p>;
  }

  return (
    <ol className="activity-list">
      {entries.map((entry) => {
        const width = totalSeconds > 0 ? Math.max((entry.seconds / totalSeconds) * 100, 3) : 0;
        return (
          <li key={`${entry.name}-${entry.seconds}`}>
            <div className="activity-row">
              <span title={entry.name}>{entry.name}</span>
              <strong>{formatDuration(entry.seconds)}</strong>
            </div>
            <div className="activity-bar" aria-hidden="true">
              <span style={{ width: `${width}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) {
    return "0m";
  }

  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <section className="panel placeholder-panel">
      <h3>{title}</h3>
      <p>{body}</p>
    </section>
  );
}
