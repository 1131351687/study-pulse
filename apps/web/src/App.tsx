import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Languages,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  SquarePower,
  Target,
  Trash2,
} from "lucide-react";

import {
  createGoal,
  createTask,
  deleteAISummary,
  deleteGoal,
  deleteTask,
  fetchAIConfig,
  fetchAISummaries,
  fetchDayRecord,
  fetchGoals,
  fetchHealth,
  fetchJournal,
  fetchRuntimeStatus,
  fetchSettings,
  fetchTasks,
  fetchTodayActivity,
  generateAISummary,
  generateAIPlan,
  saveAIConfig,
  saveJournal,
  stopRuntime,
  testAIConfig,
  updateGoal,
  updateTask,
  type ActivityEntry,
  type AIConfig,
  type AIProviderName,
  type AISummaryRecord,
  type DayRecord,
  type HealthResponse,
  type Journal,
  type LearningGoal,
  type PlannedFor,
  type Priority,
  type PublicSettings,
  type RuntimeStatus,
  type Task,
  type TodayActivityResponse,
} from "./api/client";

type Language = "zh" | "en";
type ViewId =
  | "today"
  | "schedule"
  | "tasks"
  | "goals"
  | "aiSummary"
  | "aiPlanning"
  | "journal"
  | "aiConfig"
  | "settings";

type NavItem = {
  id: ViewId;
  zh: string;
  en: string;
  icon: typeof LayoutDashboard;
};

const navItems: NavItem[] = [
  { id: "today", zh: "今日", en: "Today", icon: LayoutDashboard },
  { id: "schedule", zh: "日程记录", en: "Schedule Record", icon: CalendarDays },
  { id: "tasks", zh: "任务", en: "Tasks", icon: CheckSquare },
  { id: "goals", zh: "学习目标", en: "Goals", icon: Target },
  { id: "aiSummary", zh: "AI 总结", en: "AI Summary", icon: Sparkles },
  { id: "aiPlanning", zh: "AI 规划", en: "AI Planning", icon: ClipboardList },
  { id: "journal", zh: "今日日志", en: "Today's Journal", icon: BookOpen },
  { id: "aiConfig", zh: "AI 配置", en: "AI Config", icon: Bot },
  { id: "settings", zh: "设置", en: "Settings", icon: Settings },
];

const languageStorageKey = "study-pulse-language";
const todayIso = localDateString(new Date());

export function App() {
  const [language, setLanguage] = useState<Language>(() =>
    localStorage.getItem(languageStorageKey) === "en" ? "en" : "zh",
  );
  const [view, setView] = useState<ViewId>("today");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [tasksVersion, setTasksVersion] = useState(0);

  useEffect(() => {
    localStorage.setItem(languageStorageKey, language);
  }, [language]);

  const refreshHealth = useCallback(() => {
    fetchHealth()
      .then(setHealth)
      .catch((error: unknown) => {
        setHealth(null);
        setHealthError(error instanceof Error ? error.message : "Backend unavailable");
      });
  }, []);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">SP</div>
          <div>
            <h1>StudyPulse</h1>
            <p>{language === "zh" ? "本地学习工作台" : "Local learning studio"}</p>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item${view === item.id ? " active" : ""}`}
              onClick={() => setView(item.id)}
              type="button"
            >
              <item.icon aria-hidden="true" size={18} />
              <span>{language === "zh" ? item.zh : item.en}</span>
            </button>
          ))}
        </nav>

        <LanguageToggle language={language} onChange={setLanguage} />
      </aside>

      <main className="main-panel">
        <div className="topbar">
          <div>
            <p className="eyebrow">{language === "zh" ? "页面" : "View"}</p>
            <h2>{navLabel(view, language)}</h2>
          </div>
          <div className="topbar-actions">
            <HealthBadge health={health} error={healthError} language={language} />
            <button className="secondary-button" onClick={refreshHealth} type="button">
              <RefreshCw aria-hidden="true" size={16} />
              {language === "zh" ? "刷新状态" : "Refresh"}
            </button>
          </div>
        </div>

        {view === "today" && <TodayView language={language} />}
        {view === "schedule" && <ScheduleView language={language} />}
        {view === "tasks" && <TasksView language={language} tasksVersion={tasksVersion} />}
        {view === "goals" && <GoalsView language={language} />}
        {view === "aiSummary" && <AISummaryView language={language} />}
        {view === "aiPlanning" && <AIPlanningView language={language} onTaskAccepted={() => setTasksVersion((v) => v + 1)} />}
        {view === "journal" && <JournalView language={language} />}
        {view === "aiConfig" && <AIConfigView language={language} />}
        {view === "settings" && <SettingsView language={language} />}
      </main>
    </div>
  );
}

function TodayView({ language }: { language: Language }) {
  const [activity, setActivity] = useState<TodayActivityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchTodayActivity()
      .then(setActivity)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load activity"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="status-note">{language === "zh" ? "正在读取 ActivityWatch 数据..." : "Loading ActivityWatch data..."}</p>;
  }

  return (
    <div className="content-grid">
      <Panel title={language === "zh" ? "今日概览" : "Today Overview"}>
        {error ? (
          <p className="status-note warning">{error}</p>
        ) : activity ? (
          <>
            <p className={activity.available ? "status-note" : "status-note warning"}>{activity.message}</p>
            <dl className="metric-grid">
              <div>
                <dt>{language === "zh" ? "记录时长" : "Tracked Time"}</dt>
                <dd>{formatDuration(activity.totalSeconds)}</dd>
              </div>
              <div>
                <dt>{language === "zh" ? "活跃桶数" : "Buckets"}</dt>
                <dd>{activity.bucketCount}</dd>
              </div>
              <div>
                <dt>{language === "zh" ? "常见标题" : "Top Titles"}</dt>
                <dd>{activity.topTitles.length}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="empty-state">{language === "zh" ? "暂无数据" : "No data yet"}</p>
        )}
      </Panel>

      <Panel title={language === "zh" ? "常用应用" : "Top Apps"}>
        {activity && activity.topApps.length > 0 ? (
          <ActivityList entries={activity.topApps} totalSeconds={activity.totalSeconds} language={language} />
        ) : (
          <p className="empty-state">{language === "zh" ? "这组数据暂时为空。" : "No app data yet."}</p>
        )}
      </Panel>

      <Panel title={language === "zh" ? "常见标题" : "Top Titles"}>
        {activity && activity.topTitles.length > 0 ? (
          <ActivityList entries={activity.topTitles} totalSeconds={activity.totalSeconds} language={language} />
        ) : (
          <p className="empty-state">{language === "zh" ? "这组数据暂时为空。" : "No title data yet."}</p>
        )}
      </Panel>

      <Panel title={language === "zh" ? "后端状态与退出" : "Backend Status & Stop"}>
        <RuntimeControls language={language} />
      </Panel>
    </div>
  );
}

function ScheduleView({ language }: { language: Language }) {
  const [date, setDate] = useState(todayIso);
  const [record, setRecord] = useState<DayRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingSummaryId, setDeletingSummaryId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchDayRecord(date)
      .then(setRecord)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load day record"))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleteSummary = (summaryId: number) => {
    setDeletingSummaryId(summaryId);
    setError(null);
    deleteAISummary(summaryId)
      .then(() => {
        setRecord((current) => current ? {
          ...current,
          aiSummaries: current.aiSummaries.filter((summary) => summary.id !== summaryId),
        } : current);
        load();
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to delete summary"))
      .finally(() => setDeletingSummaryId(null));
  };

  if (loading) {
    return <p className="status-note">{language === "zh" ? "正在读取日程记录..." : "Loading schedule record..."}</p>;
  }

  if (error || !record) {
    return <p className="status-note warning">{error ?? "Failed to load day record"}</p>;
  }

  const activity = record.activity;

  return (
    <div className="single-column" style={{ gap: "16px" }}>
      <div className="panel-toolbar">
        <label className="inline-field">
          <span>{language === "zh" ? "日期" : "Date"}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="secondary-button" onClick={load} type="button">
          <RefreshCw aria-hidden="true" size={16} />
          {language === "zh" ? "刷新" : "Refresh"}
        </button>
      </div>

      <Panel title={language === "zh" ? "ActivityWatch 汇总" : "ActivityWatch Summary"}>
        <p className={activity.available ? "status-note" : "status-note warning"}>{activity.message}</p>
        <dl className="metric-grid">
          <div>
            <dt>{language === "zh" ? "记录时长" : "Tracked Time"}</dt>
            <dd>{formatDuration(activity.totalSeconds)}</dd>
          </div>
          <div>
            <dt>{language === "zh" ? "桶数" : "Buckets"}</dt>
            <dd>{activity.bucketCount}</dd>
          </div>
          <div>
            <dt>{language === "zh" ? "常见应用" : "Top Apps"}</dt>
            <dd>{activity.topApps.length}</dd>
          </div>
        </dl>
        {activity.topApps.length > 0 && (
          <ActivityList entries={activity.topApps} totalSeconds={activity.totalSeconds} language={language} />
        )}
      </Panel>

      <Panel title={language === "zh" ? "日志" : "Journal"}>
        {record.journal.content.trim() ? (
          <p className="readonly-text">{record.journal.content}</p>
        ) : (
          <p className="empty-state">{language === "zh" ? "这一天还没有日志。" : "No journal for this day."}</p>
        )}
        {record.journal.updatedAt && (
          <p className="form-status">{language === "zh" ? `上次保存: ${record.journal.updatedAt}` : `Last saved: ${record.journal.updatedAt}`}</p>
        )}
      </Panel>

      <Panel title={language === "zh" ? "AI 总结" : "AI Summaries"}>
        {record.aiSummaries.length === 0 ? (
          <p className="empty-state">{language === "zh" ? "这一天还没有 AI 总结。" : "No AI summaries for this day."}</p>
        ) : (
          <div className="ai-plan">
            {record.aiSummaries.map((summary) => (
              <SummaryCard
                key={summary.id}
                summary={summary}
                language={language}
                deleting={deletingSummaryId === summary.id}
                onDelete={() => handleDeleteSummary(summary.id)}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel title={language === "zh" ? "今日任务" : "Today's Tasks"}>
        {record.tasks.length === 0 ? (
          <p className="empty-state">{language === "zh" ? "还没有任务。" : "No tasks yet."}</p>
        ) : (
          <ul className="item-list">
            {record.tasks.map((task) => (
              <li key={task.id} className={`item-row${task.completed ? " done" : ""}`}>
                <label className="check-label">
                  <input type="checkbox" checked={task.completed} readOnly />
                  <span>{task.title}</span>
                </label>
                <small>{task.area || "--"} · {task.priority}</small>
              </li>
            ))}
          </ul>
        )}
      </Panel>

    </div>
  );
}

function TasksView({ language, tasksVersion }: { language: Language; tasksVersion: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newArea, setNewArea] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("normal");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchTasks()
      .then(setTasks)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load tasks"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, tasksVersion]);

  const todayTasks = useMemo(() => tasks.filter((task) => task.plannedFor === "today"), [tasks]);

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    createTask({ title, plannedFor: "today", area: newArea.trim(), priority: newPriority })
      .then(() => {
        setNewTitle("");
        load();
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to create task"))
      .finally(() => setCreating(false));
  };

  const handleToggle = (task: Task) => {
    updateTask(task.id, { completed: !task.completed }).then(load).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Failed to update task"),
    );
  };

  const handleDelete = (task: Task) => {
    deleteTask(task.id).then(load).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Failed to delete task"),
    );
  };

  if (loading) {
    return <p className="status-note">{language === "zh" ? "正在读取任务..." : "Loading tasks..."}</p>;
  }

  return (
    <div className="single-column task-layout" style={{ gap: "16px" }}>
      <Panel title={language === "zh" ? "添加今日任务" : "Add Today Task"}>
        <form className="stack-form" onSubmit={handleCreate}>
          <label>
            {language === "zh" ? "任务" : "Task"}
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={language === "zh" ? "阅读 attention 代码" : "Read attention code"}
            />
          </label>
          <div className="form-grid">
            <label>
              {language === "zh" ? "领域" : "Area"}
              <input type="text" value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="AI" />
            </label>
            <label>
              {language === "zh" ? "优先级" : "Priority"}
              <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as Priority)}>
                <option value="low">{language === "zh" ? "低" : "Low"}</option>
                <option value="normal">{language === "zh" ? "普通" : "Normal"}</option>
                <option value="high">{language === "zh" ? "高" : "High"}</option>
              </select>
            </label>
          </div>
          {error && <p className="status-note warning">{error}</p>}
          <div className="form-actions">
            <button className="primary-button" disabled={creating} type="submit">
              <Plus aria-hidden="true" size={16} />
              {language === "zh" ? "添加任务" : "Add Task"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel title={language === "zh" ? `今日任务（${todayTasks.length}）` : `Today Tasks (${todayTasks.length})`}>
        {todayTasks.length === 0 ? (
          <p className="empty-state">{language === "zh" ? "今天还没有任务。" : "No tasks for today."}</p>
        ) : (
          <ul className="item-list">
            {todayTasks.map((task) => (
              <li key={task.id} className={`item-row${task.completed ? " done" : ""}`}>
                <label className="check-label">
                  <input type="checkbox" checked={task.completed} onChange={() => handleToggle(task)} />
                  <span>{task.title}</span>
                </label>
                <small>{task.area || "--"} · {task.priority}</small>
                <button className="icon-button" onClick={() => handleDelete(task)} type="button">
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function GoalsView({ language }: { language: Language }) {
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currentFocus, setCurrentFocus] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchGoals()
      .then(setGoals)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load goals"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    createGoal({ name: trimmed, description: description.trim(), currentFocus: currentFocus.trim(), active: true })
      .then(() => {
        setName("");
        setDescription("");
        setCurrentFocus("");
        load();
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to create goal"))
      .finally(() => setCreating(false));
  };

  const handleToggleActive = (goal: LearningGoal) => {
    updateGoal(goal.id, { active: !goal.active }).then(load).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Failed to update goal"),
    );
  };

  const handleDelete = (goal: LearningGoal) => {
    deleteGoal(goal.id).then(load).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Failed to delete goal"),
    );
  };

  if (loading) {
    return <p className="status-note">{language === "zh" ? "正在读取学习目标..." : "Loading goals..."}</p>;
  }

  return (
    <div className="single-column" style={{ gap: "16px" }}>
      <Panel title={language === "zh" ? "添加学习目标" : "Add Goal"}>
        <form className="stack-form" onSubmit={handleCreate}>
          <label>
            {language === "zh" ? "目标名称" : "Goal Name"}
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={language === "zh" ? "掌握 Transformer" : "Master Transformers"} />
          </label>
          <label>
            {language === "zh" ? "描述" : "Description"}
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            {language === "zh" ? "当前阶段" : "Current Focus"}
            <input type="text" value={currentFocus} onChange={(e) => setCurrentFocus(e.target.value)} placeholder={language === "zh" ? "注意力机制" : "Attention mechanism"} />
          </label>
          {error && <p className="status-note warning">{error}</p>}
          <div className="form-actions">
            <button className="primary-button" disabled={creating} type="submit">
              <Plus aria-hidden="true" size={16} />
              {language === "zh" ? "添加目标" : "Add Goal"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel title={language === "zh" ? `学习目标（${goals.length}）` : `Goals (${goals.length})`}>
        {goals.length === 0 ? (
          <p className="empty-state">{language === "zh" ? "还没有学习目标。" : "No goals yet."}</p>
        ) : (
          <ul className="item-list">
            {goals.map((goal) => (
              <li key={goal.id} className="item-row">
                <strong>{goal.name}</strong>
                <small>
                  {goal.description || "--"} · {language === "zh" ? "阶段" : "Focus"}: {goal.currentFocus || "--"} ·{" "}
                  {goal.active ? (language === "zh" ? "进行中" : "Active") : (language === "zh" ? "已暂停" : "Paused")}
                </small>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="secondary-button" onClick={() => handleToggleActive(goal)} type="button">
                    {goal.active ? (language === "zh" ? "暂停" : "Pause") : (language === "zh" ? "激活" : "Activate")}
                  </button>
                  <button className="icon-button" onClick={() => handleDelete(goal)} type="button">
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function AISummaryView({ language }: { language: Language }) {
  const [date, setDate] = useState(todayIso);
  const [summaries, setSummaries] = useState<AISummaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deletingSummaryId, setDeletingSummaryId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAISummaries(date)
      .then(setSummaries)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load summaries"))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = () => {
    setGenerating(true);
    setError(null);
    generateAISummary(date)
      .then(() => load())
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to generate summary"))
      .finally(() => setGenerating(false));
  };

  const handleDelete = (summaryId: number) => {
    setDeletingSummaryId(summaryId);
    setError(null);
    deleteAISummary(summaryId)
      .then(() => {
        setSummaries((current) => current.filter((summary) => summary.id !== summaryId));
        load();
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to delete summary"))
      .finally(() => setDeletingSummaryId(null));
  };

  return (
    <div className="single-column" style={{ gap: "16px" }}>
      <div className="panel-toolbar">
        <label className="inline-field">
          <span>{language === "zh" ? "日期" : "Date"}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="primary-button" disabled={generating} onClick={handleGenerate} type="button">
          <Sparkles aria-hidden="true" size={16} />
          {language === "zh" ? "生成 AI 总结" : "Generate Summary"}
        </button>
        <button className="secondary-button" onClick={load} type="button">
          <RefreshCw aria-hidden="true" size={16} />
          {language === "zh" ? "刷新" : "Refresh"}
        </button>
      </div>

      {error && <p className="status-note warning">{error}</p>}

      {loading ? (
        <p className="status-note">{language === "zh" ? "正在读取 AI 总结..." : "Loading summaries..."}</p>
      ) : summaries.length === 0 ? (
        <p className="empty-state">{language === "zh" ? "这一天还没有 AI 总结。" : "No AI summaries for this day."}</p>
      ) : (
        <div className="ai-plan">
          {summaries.map((summary) => (
            <SummaryCard
              key={summary.id}
              summary={summary}
              language={language}
              deleting={deletingSummaryId === summary.id}
              onDelete={() => handleDelete(summary.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AIPlanningView({ language, onTaskAccepted }: { language: Language; onTaskAccepted: () => void }) {
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [goalId, setGoalId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadGoals = useCallback(() => {
    fetchGoals()
      .then((data) => {
        setGoals(data);
        if (data.length > 0 && goalId === null) {
          setGoalId(data[0].id);
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load goals"));
  }, [goalId]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleGenerate = () => {
    if (goalId === null) return;
    setGenerating(true);
    setError(null);
    setCreatedTasks([]);
    generateAIPlan({ date, goalId })
      .then((result) => {
        setCreatedTasks(result.tasks);
        onTaskAccepted();
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to generate plan"))
      .finally(() => setGenerating(false));
  };

  const activeGoals = goals.filter((goal) => goal.active);

  return (
    <div className="single-column" style={{ gap: "16px" }}>
      <div className="panel-toolbar">
        <label className="inline-field">
          <span>{language === "zh" ? "目标" : "Goal"}</span>
          <select value={goalId ?? ""} onChange={(e) => setGoalId(e.target.value ? Number(e.target.value) : null)}>
            {activeGoals.length === 0 ? (
              <option value="">{language === "zh" ? "请先创建目标" : "Create a goal first"}</option>
            ) : (
              activeGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="inline-field">
          <span>{language === "zh" ? "日期" : "Date"}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="primary-button" disabled={generating || goalId === null} onClick={handleGenerate} type="button">
          <Sparkles aria-hidden="true" size={16} />
          {generating
            ? (language === "zh" ? "生成中..." : "Generating...")
            : (language === "zh" ? "生成 AI 规划" : "Generate Plan")}
        </button>
      </div>

      {error && <p className="status-note warning">{error}</p>}

      {loading ? (
        <p className="status-note">{language === "zh" ? "正在读取目标..." : "Loading goals..."}</p>
      ) : createdTasks.length > 0 ? (
        <Panel title={language === "zh" ? `已创建 ${createdTasks.length} 个任务` : `${createdTasks.length} tasks created`}>
          <ul className="item-list">
            {createdTasks.map((task) => (
              <li key={task.id} className={`item-row${task.completed ? " done" : ""}`}>
                <label className="check-label">
                  <input type="checkbox" checked={task.completed} readOnly />
                  <span>{task.title}</span>
                </label>
                <small>{task.area || "--"} · {task.priority}</small>
              </li>
            ))}
          </ul>
        </Panel>
      ) : (
        <p className="empty-state">{language === "zh" ? "点击上方按钮生成 AI 规划，今日任务将自动创建。" : "Click Generate to create today's tasks with AI."}</p>
      )}
    </div>
  );
}

function JournalView({ language }: { language: Language }) {
  const [date, setDate] = useState(todayIso);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchJournal(date)
      .then((data) => {
        setJournal(data);
        setDraft(data.content);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load journal"))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = () => {
    setSaving(true);
    setError(null);
    saveJournal(date, draft)
      .then(setJournal)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to save journal"))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return <p className="status-note">{language === "zh" ? "正在读取日志..." : "Loading journal..."}</p>;
  }

  return (
    <div className="single-column" style={{ gap: "16px" }}>
      <div className="panel-toolbar">
        <label className="inline-field">
          <span>{language === "zh" ? "日期" : "Date"}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="secondary-button" onClick={load} type="button">
          <RefreshCw aria-hidden="true" size={16} />
          {language === "zh" ? "刷新" : "Refresh"}
        </button>
      </div>
      {error && <p className="status-note warning">{error}</p>}
      <Panel title={language === "zh" ? "每日学习日志" : "Daily Journal"}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={language === "zh" ? "写下今天学了什么、哪里卡住、明天想继续什么。" : "What did you study today?"}
        />
        <div className="form-actions" style={{ marginTop: 12 }}>
          <button className="primary-button" disabled={saving} onClick={handleSave} type="button">
            <Save aria-hidden="true" size={16} />
            {language === "zh" ? "保存日志" : "Save Journal"}
          </button>
          {journal && (
            <span className="form-status">
              {language === "zh" ? `上次保存: ${journal.updatedAt}` : `Last saved: ${journal.updatedAt}`}
            </span>
          )}
        </div>
      </Panel>
    </div>
  );
}

function AIConfigView({ language }: { language: Language }) {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProviderName>("mock");
  const [endpoint, setEndpoint] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [sendActivityTitles, setSendActivityTitles] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAIConfig()
      .then((data) => {
        setConfig(data);
        setProvider(data.provider);
        setEndpoint(data.endpoint);
        setModel(data.model);
        setSendActivityTitles(data.sendActivityTitles);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load AI config"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    saveAIConfig({
      provider,
      endpoint,
      model,
      apiKey: apiKey.length > 0 ? apiKey : undefined,
      sendActivityTitles,
    })
      .then((data) => {
        setConfig(data);
        setApiKey("");
        setSaveMessage(language === "zh" ? "配置已保存" : "Config saved");
      })
      .catch((err: unknown) => setSaveMessage(err instanceof Error ? err.message : "Failed to save config"))
      .finally(() => setSaving(false));
  };

  const handleTest = () => {
    setTesting(true);
    setTestResult(null);
    testAIConfig({
      provider,
      endpoint,
      model,
      apiKey: apiKey.length > 0 ? apiKey : undefined,
      sendActivityTitles,
    })
      .then((result) =>
        setTestResult(result.ok ? `OK: ${result.message}` : `Failed: ${result.message}`),
      )
      .catch((err: unknown) => setTestResult(err instanceof Error ? err.message : "Test failed"))
      .finally(() => setTesting(false));
  };

  if (loading) {
    return <p className="status-note">{language === "zh" ? "正在读取 AI 配置..." : "Loading AI config..."}</p>;
  }

  if (error || !config) {
    return <p className="status-note warning">{error ?? "Failed to load AI config"}</p>;
  }

  return (
    <div className="single-column" style={{ gap: "16px" }}>
      <Panel title={language === "zh" ? "AI 提供商配置" : "AI Provider Config"}>
        <form className="stack-form" onSubmit={handleSave}>
          <div className="form-grid">
            <label>
              {language === "zh" ? "提供商" : "Provider"}
              <select value={provider} onChange={(e) => setProvider(e.target.value as AIProviderName)}>
                <option value="mock">Mock</option>
                <option value="openai">OpenAI</option>
                <option value="deepseek">DeepSeek</option>
                <option value="ollama">Ollama</option>
              </select>
            </label>
            <label>
              {language === "zh" ? "模型" : "Model"}
              <input type="text" value={model} onChange={(e) => setModel(e.target.value)} />
            </label>
            <label>
              {language === "zh" ? "接口地址" : "Endpoint"}
              <input type="text" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://api.openai.com/v1" />
            </label>
            <label>
              {language === "zh" ? "API Key" : "API Key"}
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={language === "zh" ? "已保存，留空则保持不变" : "Saved, leave blank to keep"} />
            </label>
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={sendActivityTitles}
              onChange={(e) => setSendActivityTitles(e.target.checked)}
            />
            <span>{language === "zh" ? "允许把 ActivityWatch 窗口标题发送给 AI" : "Send ActivityWatch titles to AI"}</span>
          </label>
          {saveMessage && <p className="status-note">{saveMessage}</p>}
          <div className="form-actions">
            <button className="primary-button" disabled={saving} type="submit">
              <Save aria-hidden="true" size={16} />
              {language === "zh" ? "保存配置" : "Save Config"}
            </button>
            <button className="secondary-button" disabled={testing} onClick={handleTest} type="button">
              <RefreshCw aria-hidden="true" size={16} />
              {language === "zh" ? "测试连接" : "Test Connection"}
            </button>
            {testResult && <span className="form-status">{testResult}</span>}
          </div>
        </form>
      </Panel>
    </div>
  );
}

function SettingsView({ language }: { language: Language }) {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load settings"));
  }, []);

  return (
    <div className="single-column settings-layout" style={{ gap: "16px" }}>
      <Panel title={language === "zh" ? "运行设置" : "Runtime Settings"}>
        {error ? (
          <p className="status-note warning">{error}</p>
        ) : settings ? (
          <dl className="settings-list">
            <div>
              <dt>ActivityWatch</dt>
              <dd>{settings.activitywatchUrl}</dd>
            </div>
            <div>
              <dt>Host</dt>
              <dd>{settings.host}</dd>
            </div>
            <div>
              <dt>Port</dt>
              <dd>{settings.port}</dd>
            </div>
          </dl>
        ) : (
          <p className="empty-state">{language === "zh" ? "正在读取..." : "Loading..."}</p>
        )}
      </Panel>

      <Panel title={language === "zh" ? "后端状态与退出" : "Backend Status & Stop"}>
        <RuntimeControls language={language} />
      </Panel>
    </div>
  );
}

function RuntimeControls({ language }: { language: Language }) {
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [status, setStatus] = useState<string>(language === "zh" ? "正在读取后端状态..." : "Loading runtime status...");
  const [stopping, setStopping] = useState(false);

  const load = useCallback(() => {
    fetchRuntimeStatus()
      .then(setRuntime)
      .then(() => setStatus(language === "zh" ? "后端状态已更新" : "Runtime status updated"))
      .catch((err: unknown) => setStatus(err instanceof Error ? err.message : "Failed to load runtime status"));
  }, [language]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStop = () => {
    setStopping(true);
    setStatus(language === "zh" ? "正在退出..." : "Stopping...");
    stopRuntime()
      .then(() => setStatus(language === "zh" ? "已请求退出" : "Stop requested"))
      .catch((err: unknown) => setStatus(err instanceof Error ? err.message : "Failed to stop"))
      .finally(() => setStopping(false));
  };

  return (
    <div>
      <div className="panel-toolbar">
        <button className="secondary-button" onClick={load} type="button">
          <RefreshCw aria-hidden="true" size={16} />
          {language === "zh" ? "刷新状态" : "Refresh"}
        </button>
        <button className="danger-button" onClick={handleStop} disabled={stopping} type="button">
          <SquarePower aria-hidden="true" size={16} />
          {language === "zh" ? "退出程序" : "Stop"}
        </button>
        <span>{status}</span>
      </div>
      {runtime && (
        <div className="runtime-grid">
          <RuntimeCard title={language === "zh" ? "后端" : "Backend"} process={runtime.backend} language={language} />
          <RuntimeCard title={language === "zh" ? "前端" : "Frontend"} process={runtime.frontend} language={language} />
          <p className="form-status runtime-meta">
            {runtime.managed
              ? `${language === "zh" ? "更新时间" : "Updated"}: ${runtime.updatedAt || "--"}`
              : language === "zh" ? "非托管模式" : "Unmanaged"}
          </p>
        </div>
      )}
    </div>
  );
}

function RuntimeCard({
  title,
  process,
  language,
}: {
  title: string;
  process: RuntimeStatus["backend"];
  language: Language;
}) {
  return (
    <div className="runtime-card">
      <strong>{title}</strong>
      <span>{process.running ? (language === "zh" ? "运行中" : "Running") : (language === "zh" ? "已停止" : "Stopped")}</span>
      <small>
        {language === "zh" ? "PID" : "PID"}: {process.pid ?? "--"}
      </small>
      <small>{process.startedAt || "--"}</small>
    </div>
  );
}

function SummaryCard({
  summary,
  language,
  deleting = false,
  onDelete,
}: {
  summary: AISummaryRecord;
  language: Language;
  deleting?: boolean;
  onDelete?: () => void;
}) {
  const result = summary.result;
  return (
    <div className="ai-section">
      <div className="section-heading-row">
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <strong>{language === "zh" ? "评分" : "Score"}: {summary.score}</strong>
          <small>{summary.provider} · {summary.createdAt}</small>
        </div>
        {onDelete && (
          <button
            className="icon-button"
            disabled={deleting}
            onClick={onDelete}
            title={language === "zh" ? "删除 AI 总结" : "Delete AI summary"}
            type="button"
          >
            <Trash2 aria-hidden="true" size={16} />
          </button>
        )}
      </div>
      <p className="summary-text">{result.summary}</p>
      {result.strengths.length > 0 && (
        <div className="ai-section">
          <h4>{language === "zh" ? "亮点" : "Strengths"}</h4>
          <ol className="plain-list compact-list">
            {result.strengths.map((item, index) => <li key={index}>{item}</li>)}
          </ol>
        </div>
      )}
      {result.blockers.length > 0 && (
        <div className="ai-section">
          <h4>{language === "zh" ? "阻碍" : "Blockers"}</h4>
          <ol className="plain-list compact-list">
            {result.blockers.map((item, index) => <li key={index}>{item}</li>)}
          </ol>
        </div>
      )}
      {result.improvements.length > 0 && (
        <div className="ai-section">
          <h4>{language === "zh" ? "改进建议" : "Improvements"}</h4>
          <ol className="plain-list compact-list">
            {result.improvements.map((item, index) => <li key={index}>{item}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

function LanguageToggle({ language, onChange }: { language: Language; onChange: (lang: Language) => void }) {
  return (
    <div className="segmented-control" aria-label="Language">
      <Languages aria-hidden="true" size={16} />
      <button className={language === "zh" ? "active" : ""} onClick={() => onChange("zh")} type="button">
        中
      </button>
      <button className={language === "en" ? "active" : ""} onClick={() => onChange("en")} type="button">
        EN
      </button>
    </div>
  );
}

function HealthBadge({ health, error, language }: { health: HealthResponse | null; error: string | null; language: Language }) {
  if (health) {
    return (
      <div className="status-badge online" title={`${health.appName} ${health.version}`}>
        {language === "zh" ? "API 在线" : "API Online"}
      </div>
    );
  }
  return (
    <div className="status-badge offline" title={error ?? "Backend unavailable"}>
      {language === "zh" ? "API 离线" : "API Offline"}
    </div>
  );
}

function ActivityList({
  entries,
  totalSeconds,
  language,
}: {
  entries: ActivityEntry[];
  totalSeconds: number;
  language: Language;
}) {
  if (entries.length === 0) {
    return <p className="empty-state">{language === "zh" ? "这组数据暂时为空。" : "No data."}</p>;
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

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function navLabel(view: ViewId, language: Language): string {
  const item = navItems.find((entry) => entry.id === view);
  if (!item) return language === "zh" ? "今日" : "Today";
  return language === "zh" ? item.zh : item.en;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
