import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  Settings,
} from "lucide-react";

import { fetchHealth, type HealthResponse } from "./api/client";

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

export function App() {
  const [activeView, setActiveView] = useState<ViewId>("today");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

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

  const content = useMemo(() => renderView(activeView), [activeView]);

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
            <p className="eyebrow">v0.1 skeleton</p>
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

function renderView(view: ViewId) {
  switch (view) {
    case "today":
      return (
        <section className="content-grid">
          <Panel title="Today overview">
            <dl className="metric-grid">
              <div>
                <dt>Tracked time</dt>
                <dd>--</dd>
              </div>
              <div>
                <dt>Learning time</dt>
                <dd>--</dd>
              </div>
              <div>
                <dt>Completed tasks</dt>
                <dd>0 / 0</dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Next milestones">
            <ul className="plain-list">
              <li>Connect ActivityWatch aggregation.</li>
              <li>Add journal, tasks, and schedule persistence.</li>
              <li>Add AI summary and planning providers.</li>
            </ul>
          </Panel>
        </section>
      );
    case "journal":
      return <Placeholder title="Daily journal" body="A date-based learning journal editor will land in v0.3." />;
    case "tasks":
      return <Placeholder title="Task list" body="Simple task creation, completion, and planning buckets will land in v0.3." />;
    case "schedule":
      return <Placeholder title="Daily schedule" body="Editable time blocks and AI suggestions will land after the local data model is ready." />;
    case "settings":
      return <Placeholder title="Settings" body="ActivityWatch and AI provider settings will be wired through the local API." />;
  }
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
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
