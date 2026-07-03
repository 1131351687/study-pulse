import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Bot,
  BookOpen,
  CalendarDays,
  CheckSquare,
  History as HistoryIcon,
  Languages,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  SquarePower,
  Trash2,
} from "lucide-react";

import {
  createScheduleBlock,
  createTask,
  deleteScheduleBlock,
  deleteTask,
  fetchAIConfig,
  fetchDailyPlan,
  fetchHealth,
  fetchHistoryDays,
  fetchJournal,
  fetchRuntimeStatus,
  fetchSchedule,
  fetchSettings,
  fetchTasks,
  fetchTodayActivity,
  generateDailyPlan,
  saveAIConfig,
  saveJournal,
  stopRuntime,
  testAIConfig,
  updateTask,
  type ActivityEntry,
  type AIProviderName,
  type DailyPlanResponse,
  type DailyPlanResult,
  type HealthResponse,
  type HistoryDay,
  type PlannedFor,
  type Priority,
  type PublicSettings,
  type RuntimeStatus,
  type ScheduleBlock,
  type SuggestedScheduleBlock,
  type SuggestedTask,
  type Task,
  type TodayActivityResponse,
} from "./api/client";

type Language = "zh" | "en";
type ViewId = "today" | "history" | "journal" | "tasks" | "schedule" | "aiPlan" | "aiConfig" | "settings";
type I18nKey = keyof typeof translations.en;

type NavItem = {
  id: ViewId;
  labelKey: I18nKey;
  icon: typeof LayoutDashboard;
};

const navItems: NavItem[] = [
  { id: "today", labelKey: "nav.today", icon: LayoutDashboard },
  { id: "history", labelKey: "nav.history", icon: HistoryIcon },
  { id: "journal", labelKey: "nav.journal", icon: BookOpen },
  { id: "tasks", labelKey: "nav.tasks", icon: CheckSquare },
  { id: "schedule", labelKey: "nav.schedule", icon: CalendarDays },
  { id: "aiPlan", labelKey: "nav.aiPlan", icon: Sparkles },
  { id: "aiConfig", labelKey: "nav.aiConfig", icon: Bot },
  { id: "settings", labelKey: "nav.settings", icon: Settings },
];

const todayIso = localDateString(new Date());
const languageStorageKey = "study-pulse-language";

const translations = {
  zh: {
    "brand.subtitle": "本地学习工作台",
    "language.label": "界面语言",
    "api.online": "API 在线",
    "api.offline": "API 离线",
    "nav.today": "今日",
    "nav.history": "历史",
    "nav.journal": "日志",
    "nav.tasks": "任务",
    "nav.schedule": "日程",
    "nav.aiPlan": "AI 计划",
    "nav.aiConfig": "AI 配置",
    "nav.settings": "设置",
    "today.overview": "今日概览",
    "today.trackedTime": "记录时长",
    "today.learningTime": "学习时长",
    "today.activityBuckets": "活动桶",
    "today.topApps": "常用应用",
    "today.topTitles": "常见标题",
    "today.backendHint": "后端状态和退出控制在“设置”页面。",
    "activity.loading": "正在读取 ActivityWatch 数据...",
    "activity.empty": "这组数据暂时为空。",
    "field.date": "日期",
    "field.days": "天数",
    "journal.title": "每日学习日志",
    "journal.loading": "正在读取日志...",
    "journal.lastSaved": "上次保存",
    "journal.none": "这一天还没有日志。",
    "journal.loadError": "无法读取日志。",
    "journal.saving": "正在保存...",
    "journal.saved": "已保存",
    "journal.saveError": "无法保存日志。",
    "journal.notes": "内容",
    "journal.placeholder": "写下今天学了什么、哪里卡住、明天想继续什么。",
    "journal.save": "保存日志",
    "tasks.loading": "正在读取任务...",
    "tasks.count": "个任务",
    "tasks.none": "还没有任务。",
    "tasks.loadError": "无法读取任务。",
    "tasks.titleRequired": "任务标题不能为空。",
    "tasks.createError": "无法创建任务。",
    "tasks.updateError": "无法更新任务。",
    "tasks.deleteError": "无法删除任务。",
    "tasks.add": "添加任务",
    "tasks.task": "任务",
    "tasks.placeholder": "阅读 attention 代码",
    "tasks.area": "领域",
    "tasks.areaPlaceholder": "AI 学习",
    "tasks.plan": "计划",
    "tasks.today": "今天",
    "tasks.tomorrow": "明天",
    "tasks.week": "本周",
    "tasks.priority": "优先级",
    "tasks.low": "低",
    "tasks.normal": "普通",
    "tasks.high": "高",
    "tasks.addButton": "添加任务",
    "tasks.list": "任务列表",
    "tasks.delete": "删除任务",
    "schedule.loading": "正在读取日程...",
    "schedule.count": "个时间块",
    "schedule.noneForDate": "这一天还没有日程块。",
    "schedule.loadError": "无法读取日程。",
    "schedule.titleRequired": "日程标题不能为空。",
    "schedule.createError": "无法创建日程块。",
    "schedule.deleteError": "无法删除日程块。",
    "schedule.add": "添加日程块",
    "schedule.start": "开始",
    "schedule.end": "结束",
    "schedule.blockTitle": "标题",
    "schedule.placeholder": "学习 attention",
    "schedule.addButton": "添加日程",
    "schedule.blocks": "日程块",
    "schedule.delete": "删除日程块",
    "history.title": "历史进展",
    "history.loading": "正在读取历史记录...",
    "history.loadError": "无法读取历史记录。",
    "history.empty": "暂无历史数据。",
    "history.reload": "刷新历史",
    "history.journal": "日志",
    "history.schedule": "日程",
    "history.plan": "AI 计划",
    "history.noPlan": "无 AI 计划",
    "history.activityUnavailable": "无 ActivityWatch 记录",
    "aiPlan.title": "AI 计划",
    "aiPlan.loading": "正在读取已保存计划...",
    "aiPlan.saved": "已保存",
    "aiPlan.none": "还没有生成计划。",
    "aiPlan.loadError": "无法读取计划。",
    "aiPlan.generating": "正在生成...",
    "aiPlan.generatingShort": "生成中",
    "aiPlan.generate": "生成计划",
    "aiPlan.generatedWith": "生成模型",
    "aiPlan.generateError": "无法生成计划。",
    "aiPlan.empty": "这一天还没有计划。",
    "aiPlan.timeInsights": "时间洞察",
    "aiPlan.openLoops": "未完成线索",
    "aiPlan.suggestedTasks": "建议任务",
    "aiPlan.tomorrowSchedule": "建议日程",
    "aiPlan.anytime": "任意时间",
    "aiConfig.title": "AI 配置",
    "aiConfig.loading": "正在读取 AI 配置...",
    "aiConfig.loaded": "AI 配置已读取。",
    "aiConfig.loadError": "无法读取 AI 配置。",
    "aiConfig.saving": "正在保存...",
    "aiConfig.saved": "AI 配置已保存。",
    "aiConfig.saveError": "无法保存 AI 配置。",
    "aiConfig.testing": "正在测试连接...",
    "aiConfig.provider": "Provider",
    "aiConfig.endpoint": "Endpoint",
    "aiConfig.model": "Model",
    "aiConfig.apiKey": "API Key",
    "aiConfig.apiKeySaved": "已保存，留空则保持不变",
    "aiConfig.apiKeyPlaceholder": "mock 或 ollama 可留空",
    "aiConfig.sendTitles": "允许把 ActivityWatch 窗口标题发送给 AI",
    "aiConfig.save": "保存配置",
    "aiConfig.test": "测试连接",
    "aiConfig.testOk": "连接可用",
    "aiConfig.testFail": "连接失败",
    "settings.title": "设置",
    "settings.loading": "正在读取设置...",
    "settings.loaded": "设置已读取。",
    "settings.loadError": "无法读取设置。",
    "runtime.title": "运行状态",
    "runtime.loading": "正在读取运行状态...",
    "runtime.loadError": "无法读取运行状态。",
    "runtime.refresh": "刷新状态",
    "runtime.stop": "退出运行",
    "runtime.stopping": "正在停止...",
    "runtime.stopDone": "停止命令已发送。",
    "runtime.unmanaged": "当前不是通过启动脚本记录的受管运行。",
    "runtime.running": "运行中",
    "runtime.stopped": "未运行",
    "runtime.backend": "后端",
    "runtime.frontend": "前端",
    "runtime.pid": "PID",
    "runtime.updatedAt": "状态更新时间",
  },
  en: {
    "brand.subtitle": "Local learning workspace",
    "language.label": "Interface language",
    "api.online": "API online",
    "api.offline": "API offline",
    "nav.today": "Today",
    "nav.history": "History",
    "nav.journal": "Journal",
    "nav.tasks": "Tasks",
    "nav.schedule": "Schedule",
    "nav.aiPlan": "AI Plan",
    "nav.aiConfig": "AI Config",
    "nav.settings": "Settings",
    "today.overview": "Today overview",
    "today.trackedTime": "Tracked time",
    "today.learningTime": "Learning time",
    "today.activityBuckets": "Activity buckets",
    "today.topApps": "Top applications",
    "today.topTitles": "Top titles",
    "today.backendHint": "Backend status and stop controls are on the Settings page.",
    "activity.loading": "Loading ActivityWatch data...",
    "activity.empty": "No activity data for this list yet.",
    "field.date": "Date",
    "field.days": "Days",
    "journal.title": "Daily journal",
    "journal.loading": "Loading journal...",
    "journal.lastSaved": "Last saved",
    "journal.none": "No journal saved for this date.",
    "journal.loadError": "Could not load journal.",
    "journal.saving": "Saving...",
    "journal.saved": "Saved",
    "journal.saveError": "Could not save journal.",
    "journal.notes": "Notes",
    "journal.placeholder": "Write what you learned, what got stuck, and what you want to continue tomorrow.",
    "journal.save": "Save journal",
    "tasks.loading": "Loading tasks...",
    "tasks.count": "task(s)",
    "tasks.none": "No tasks yet.",
    "tasks.loadError": "Could not load tasks.",
    "tasks.titleRequired": "Task title is required.",
    "tasks.createError": "Could not create task.",
    "tasks.updateError": "Could not update task.",
    "tasks.deleteError": "Could not delete task.",
    "tasks.add": "Add task",
    "tasks.task": "Task",
    "tasks.placeholder": "Read attention code",
    "tasks.area": "Area",
    "tasks.areaPlaceholder": "AI learning",
    "tasks.plan": "Plan",
    "tasks.today": "Today",
    "tasks.tomorrow": "Tomorrow",
    "tasks.week": "This week",
    "tasks.priority": "Priority",
    "tasks.low": "Low",
    "tasks.normal": "Normal",
    "tasks.high": "High",
    "tasks.addButton": "Add task",
    "tasks.list": "Task list",
    "tasks.delete": "Delete task",
    "schedule.loading": "Loading schedule...",
    "schedule.count": "block(s)",
    "schedule.noneForDate": "No schedule blocks for this date.",
    "schedule.loadError": "Could not load schedule.",
    "schedule.titleRequired": "Schedule title is required.",
    "schedule.createError": "Could not create block.",
    "schedule.deleteError": "Could not delete block.",
    "schedule.add": "Add schedule block",
    "schedule.start": "Start",
    "schedule.end": "End",
    "schedule.blockTitle": "Block title",
    "schedule.placeholder": "Study attention",
    "schedule.addButton": "Add block",
    "schedule.blocks": "Schedule blocks",
    "schedule.delete": "Delete block",
    "history.title": "History progress",
    "history.loading": "Loading history...",
    "history.loadError": "Could not load history.",
    "history.empty": "No history data yet.",
    "history.reload": "Refresh history",
    "history.journal": "Journal",
    "history.schedule": "Schedule",
    "history.plan": "AI plan",
    "history.noPlan": "No AI plan",
    "history.activityUnavailable": "No ActivityWatch record",
    "aiPlan.title": "AI plan",
    "aiPlan.loading": "Loading saved plan...",
    "aiPlan.saved": "Saved",
    "aiPlan.none": "No generated plan yet.",
    "aiPlan.loadError": "Could not load plan.",
    "aiPlan.generating": "Generating...",
    "aiPlan.generatingShort": "Generating",
    "aiPlan.generate": "Generate plan",
    "aiPlan.generatedWith": "Generated with",
    "aiPlan.generateError": "Could not generate plan.",
    "aiPlan.empty": "No plan for this date.",
    "aiPlan.timeInsights": "Time insights",
    "aiPlan.openLoops": "Open loops",
    "aiPlan.suggestedTasks": "Suggested tasks",
    "aiPlan.tomorrowSchedule": "Suggested schedule",
    "aiPlan.anytime": "Anytime",
    "aiConfig.title": "AI config",
    "aiConfig.loading": "Loading AI config...",
    "aiConfig.loaded": "AI config loaded.",
    "aiConfig.loadError": "Could not load AI config.",
    "aiConfig.saving": "Saving...",
    "aiConfig.saved": "AI config saved.",
    "aiConfig.saveError": "Could not save AI config.",
    "aiConfig.testing": "Testing connection...",
    "aiConfig.provider": "Provider",
    "aiConfig.endpoint": "Endpoint",
    "aiConfig.model": "Model",
    "aiConfig.apiKey": "API key",
    "aiConfig.apiKeySaved": "Saved; leave blank to keep it",
    "aiConfig.apiKeyPlaceholder": "Can be blank for mock or Ollama",
    "aiConfig.sendTitles": "Send ActivityWatch window titles to AI",
    "aiConfig.save": "Save config",
    "aiConfig.test": "Test connection",
    "aiConfig.testOk": "Connection works",
    "aiConfig.testFail": "Connection failed",
    "settings.title": "Settings",
    "settings.loading": "Loading settings...",
    "settings.loaded": "Settings loaded.",
    "settings.loadError": "Could not load settings.",
    "runtime.title": "Runtime status",
    "runtime.loading": "Loading runtime status...",
    "runtime.loadError": "Could not load runtime status.",
    "runtime.refresh": "Refresh status",
    "runtime.stop": "Exit running app",
    "runtime.stopping": "Stopping...",
    "runtime.stopDone": "Stop command sent.",
    "runtime.unmanaged": "This run was not recorded by the launcher script.",
    "runtime.running": "Running",
    "runtime.stopped": "Stopped",
    "runtime.backend": "Backend",
    "runtime.frontend": "Frontend",
    "runtime.pid": "PID",
    "runtime.updatedAt": "Status updated",
  },
} as const;

export function App() {
  const [activeView, setActiveView] = useState<ViewId>("today");
  const [language, setLanguage] = useState<Language>(() => readStoredLanguage());
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

  const content = useMemo(() => renderView(activeView, language, activity, activityError), [
    activeView,
    language,
    activity,
    activityError,
  ]);

  function handleLanguageChange(nextLanguage: Language) {
    setLanguage(nextLanguage);
    localStorage.setItem(languageStorageKey, nextLanguage);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand-block">
          <div className="brand-mark">SP</div>
          <div>
            <h1>StudyPulse</h1>
            <p>{t("brand.subtitle", language)}</p>
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
                <span>{t(item.labelKey, language)}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">v0.5 local workspace</p>
            <h2>{viewTitle(activeView, language)}</h2>
          </div>
          <div className="topbar-actions">
            <LanguageToggle language={language} onChange={handleLanguageChange} />
            <HealthBadge health={health} error={healthError} language={language} />
          </div>
        </header>

        {content}
      </main>
    </div>
  );
}

function renderView(
  view: ViewId,
  language: Language,
  activity: TodayActivityResponse | null,
  activityError: string | null,
) {
  switch (view) {
    case "today":
      return <TodayView language={language} activity={activity} activityError={activityError} />;
    case "history":
      return <HistoryView language={language} />;
    case "journal":
      return <JournalView language={language} />;
    case "tasks":
      return <TasksView language={language} />;
    case "schedule":
      return <ScheduleView language={language} />;
    case "aiPlan":
      return <AIPlanView language={language} />;
    case "aiConfig":
      return <AIConfigView language={language} />;
    case "settings":
      return <SettingsView language={language} />;
  }
}

function TodayView({
  language,
  activity,
  activityError,
}: {
  language: Language;
  activity: TodayActivityResponse | null;
  activityError: string | null;
}) {
  return (
    <section className="content-grid">
      <Panel title={t("today.overview", language)}>
        <dl className="metric-grid">
          <div>
            <dt>{t("today.trackedTime", language)}</dt>
            <dd>{activity ? formatDuration(activity.totalSeconds) : "--"}</dd>
          </div>
          <div>
            <dt>{t("today.learningTime", language)}</dt>
            <dd>--</dd>
          </div>
          <div>
            <dt>{t("today.activityBuckets", language)}</dt>
            <dd>{activity?.bucketCount ?? "--"}</dd>
          </div>
        </dl>
        <StatusNote activity={activity} error={activityError} language={language} />
      </Panel>
      <Panel title={t("today.topApps", language)}>
        <ActivityList entries={activity?.topApps ?? []} totalSeconds={activity?.totalSeconds ?? 0} language={language} />
      </Panel>
      <Panel title={t("today.topTitles", language)}>
        <ActivityList entries={activity?.topTitles ?? []} totalSeconds={activity?.totalSeconds ?? 0} language={language} />
      </Panel>
      <Panel title={t("nav.aiPlan", language)}>
        <p className="summary-text">{t("today.backendHint", language)}</p>
      </Panel>
    </section>
  );
}

function HistoryView({ language }: { language: Language }) {
  const [days, setDays] = useState(14);
  const [items, setItems] = useState<HistoryDay[]>([]);
  const [status, setStatus] = useState(t("history.loading", language));

  function loadHistory(targetDays = days) {
    setStatus(t("history.loading", language));
    fetchHistoryDays(targetDays)
      .then((result) => {
        setItems(result);
        setStatus(result.length ? "" : t("history.empty", language));
      })
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : t("history.loadError", language));
      });
  }

  useEffect(() => {
    loadHistory(days);
  }, [days, language]);

  return (
    <section className="single-column history-layout">
      <Panel title={t("history.title", language)}>
        <div className="panel-toolbar">
          <label className="inline-field">
            <span>{t("field.days", language)}</span>
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={7}>7</option>
              <option value={14}>14</option>
              <option value={30}>30</option>
            </select>
          </label>
          <button className="secondary-button" onClick={() => loadHistory(days)} type="button">
            <RefreshCw aria-hidden="true" size={16} />
            {t("history.reload", language)}
          </button>
          <span>{status}</span>
        </div>
        {items.length === 0 ? (
          <p className="empty-state">{status || t("history.empty", language)}</p>
        ) : (
          <ul className="history-list">
            {items.map((item) => (
              <li key={item.date} className="history-item">
                <div className="history-header">
                  <strong>{item.date}</strong>
                  <span>
                    {item.activityAvailable ? formatDuration(item.trackedSeconds) : t("history.activityUnavailable", language)}
                  </span>
                </div>
                <div className="history-grid">
                  <div>
                    <small>{t("history.journal", language)}</small>
                    <p>{item.journalPreview || "--"}</p>
                  </div>
                  <div>
                    <small>{t("history.schedule", language)}</small>
                    <p>
                      {item.scheduleBlocks.length
                        ? item.scheduleBlocks.map((block) => `${block.startTime}-${block.endTime} ${block.title}`).join(" | ")
                        : "--"}
                    </p>
                  </div>
                  <div>
                    <small>{t("history.plan", language)}</small>
                    <p>{item.hasPlan ? `${item.planProvider}: ${item.planSummary || "--"}` : t("history.noPlan", language)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}

function AIPlanView({ language }: { language: Language }) {
  const [date, setDate] = useState(todayIso);
  const [plan, setPlan] = useState<DailyPlanResponse | null>(null);
  const [status, setStatus] = useState(t("aiPlan.loading", language));
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setStatus(t("aiPlan.loading", language));
    fetchDailyPlan(date)
      .then((response) => {
        setPlan(response.result ? response : null);
        setStatus(response.result ? `${t("aiPlan.saved", language)} ${response.updatedAt ?? ""}` : t("aiPlan.none", language));
      })
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : t("aiPlan.loadError", language));
      });
  }, [date, language]);

  function handleGenerate() {
    setIsGenerating(true);
    setStatus(t("aiPlan.generating", language));
    generateDailyPlan(date)
      .then((response) => {
        setPlan(response);
        setStatus(`${t("aiPlan.generatedWith", language)} ${response.provider}`);
      })
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : t("aiPlan.generateError", language));
      })
      .finally(() => setIsGenerating(false));
  }

  return (
    <section className="single-column">
      <Panel title={t("aiPlan.title", language)}>
        <div className="panel-toolbar">
          <label className="inline-field">
            <span>{t("field.date", language)}</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <button className="primary-button" onClick={handleGenerate} disabled={isGenerating} type="button">
            <Sparkles aria-hidden="true" size={16} />
            {isGenerating ? t("aiPlan.generatingShort", language) : t("aiPlan.generate", language)}
          </button>
          <span>{status}</span>
        </div>
        {plan?.result ? <DailyPlanContent result={plan.result} language={language} /> : <p className="empty-state">{t("aiPlan.empty", language)}</p>}
      </Panel>
    </section>
  );
}

function DailyPlanContent({ result, language }: { result: DailyPlanResult; language: Language }) {
  return (
    <div className="ai-plan">
      {result.summary ? <p className="summary-text">{result.summary}</p> : null}
      <TagList items={result.topics} />
      <InsightList title={t("aiPlan.timeInsights", language)} items={result.timeInsights} />
      <InsightList title={t("aiPlan.openLoops", language)} items={result.unfinishedReasons} />
      <SuggestedTasks tasks={result.suggestedTasks} language={language} />
      <SuggestedSchedule blocks={result.tomorrowSchedule} language={language} />
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="tag-list">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="ai-section">
      <h4>{title}</h4>
      <ul className="plain-list compact-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function SuggestedTasks({ tasks, language }: { tasks: SuggestedTask[]; language: Language }) {
  if (tasks.length === 0) {
    return null;
  }
  return (
    <section className="ai-section">
      <h4>{t("aiPlan.suggestedTasks", language)}</h4>
      <ul className="suggestion-list">
        {tasks.map((task) => (
          <li key={`${task.title}-${task.reason}`}>
            <strong>{task.title}</strong>
            <span>
              {task.plannedFor}
              {task.reason ? ` / ${task.reason}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SuggestedSchedule({ blocks, language }: { blocks: SuggestedScheduleBlock[]; language: Language }) {
  if (blocks.length === 0) {
    return null;
  }
  return (
    <section className="ai-section">
      <h4>{t("aiPlan.tomorrowSchedule", language)}</h4>
      <ul className="suggestion-list schedule-suggestions">
        {blocks.map((block) => (
          <li key={`${block.startTime}-${block.endTime}-${block.title}`}>
            <strong>{block.startTime && block.endTime ? `${block.startTime}-${block.endTime}` : t("aiPlan.anytime", language)}</strong>
            <span>{block.title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function JournalView({ language }: { language: Language }) {
  const [date, setDate] = useState(todayIso);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState(t("journal.loading", language));

  useEffect(() => {
    setStatus(t("journal.loading", language));
    fetchJournal(date)
      .then((journal) => {
        setContent(journal.content);
        setStatus(journal.updatedAt ? `${t("journal.lastSaved", language)} ${journal.updatedAt}` : t("journal.none", language));
      })
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : t("journal.loadError", language));
      });
  }, [date, language]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(t("journal.saving", language));
    saveJournal(date, content)
      .then((journal) => setStatus(`${t("journal.saved", language)} ${journal.updatedAt}`))
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : t("journal.saveError", language));
      });
  }

  return (
    <section className="single-column">
      <Panel title={t("journal.title", language)}>
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            {t("field.date", language)}
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            {t("journal.notes", language)}
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={t("journal.placeholder", language)}
              rows={12}
            />
          </label>
          <div className="form-actions">
            <button className="primary-button" type="submit">
              <Save aria-hidden="true" size={16} />
              {t("journal.save", language)}
            </button>
            <span>{status}</span>
          </div>
        </form>
      </Panel>
    </section>
  );
}

function TasksView({ language }: { language: Language }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [plannedFor, setPlannedFor] = useState<PlannedFor>("today");
  const [priority, setPriority] = useState<Priority>("normal");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState(t("tasks.loading", language));

  function reloadTasks() {
    fetchTasks()
      .then((items) => {
        setTasks(items);
        setStatus(items.length ? `${items.length} ${t("tasks.count", language)}` : t("tasks.none", language));
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : t("tasks.loadError", language)));
  }

  useEffect(() => {
    reloadTasks();
  }, []);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setStatus(t("tasks.titleRequired", language));
      return;
    }
    createTask({ title, plannedFor, priority, area })
      .then(() => {
        setTitle("");
        setArea("");
        reloadTasks();
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : t("tasks.createError", language)));
  }

  function handleToggle(task: Task) {
    updateTask(task.id, { completed: !task.completed })
      .then(reloadTasks)
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : t("tasks.updateError", language)));
  }

  function handleDelete(id: number) {
    deleteTask(id)
      .then(reloadTasks)
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : t("tasks.deleteError", language)));
  }

  return (
    <section className="content-grid task-layout">
      <Panel title={t("tasks.add", language)}>
        <form className="stack-form" onSubmit={handleCreate}>
          <label>
            {t("tasks.task", language)}
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("tasks.placeholder", language)} />
          </label>
          <label>
            {t("tasks.area", language)}
            <input value={area} onChange={(event) => setArea(event.target.value)} placeholder={t("tasks.areaPlaceholder", language)} />
          </label>
          <div className="form-grid">
            <label>
              {t("tasks.plan", language)}
              <select value={plannedFor} onChange={(event) => setPlannedFor(event.target.value as PlannedFor)}>
                <option value="today">{t("tasks.today", language)}</option>
                <option value="tomorrow">{t("tasks.tomorrow", language)}</option>
                <option value="week">{t("tasks.week", language)}</option>
              </select>
            </label>
            <label>
              {t("tasks.priority", language)}
              <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                <option value="low">{t("tasks.low", language)}</option>
                <option value="normal">{t("tasks.normal", language)}</option>
                <option value="high">{t("tasks.high", language)}</option>
              </select>
            </label>
          </div>
          <button className="primary-button" type="submit">
            <Plus aria-hidden="true" size={16} />
            {t("tasks.addButton", language)}
          </button>
          <p className="form-status">{status}</p>
        </form>
      </Panel>

      <Panel title={t("tasks.list", language)}>
        {tasks.length === 0 ? (
          <p className="empty-state">{t("tasks.none", language)}</p>
        ) : (
          <ul className="item-list">
            {tasks.map((task) => (
              <li key={task.id} className={task.completed ? "item-row done" : "item-row"}>
                <label className="check-label">
                  <input type="checkbox" checked={task.completed} onChange={() => handleToggle(task)} />
                  <span>{task.title}</span>
                </label>
                <small>
                  {task.plannedFor} / {task.priority}
                  {task.area ? ` / ${task.area}` : ""}
                </small>
                <button className="icon-button" onClick={() => handleDelete(task.id)} type="button" title={t("tasks.delete", language)}>
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

function ScheduleView({ language }: { language: Language }) {
  const [date, setDate] = useState(todayIso);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState(t("schedule.loading", language));

  function reloadSchedule(targetDate = date) {
    fetchSchedule(targetDate)
      .then((items) => {
        setBlocks(items);
        setStatus(items.length ? `${items.length} ${t("schedule.count", language)}` : t("schedule.noneForDate", language));
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : t("schedule.loadError", language)));
  }

  useEffect(() => {
    reloadSchedule(date);
  }, [date]);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setStatus(t("schedule.titleRequired", language));
      return;
    }
    createScheduleBlock({ date, startTime, endTime, title })
      .then(() => {
        setTitle("");
        reloadSchedule();
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : t("schedule.createError", language)));
  }

  function handleDelete(id: number) {
    deleteScheduleBlock(id)
      .then(() => reloadSchedule())
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : t("schedule.deleteError", language)));
  }

  return (
    <section className="content-grid task-layout">
      <Panel title={t("schedule.add", language)}>
        <form className="stack-form" onSubmit={handleCreate}>
          <label>
            {t("field.date", language)}
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <div className="form-grid">
            <label>
              {t("schedule.start", language)}
              <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </label>
            <label>
              {t("schedule.end", language)}
              <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </label>
          </div>
          <label>
            {t("schedule.blockTitle", language)}
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("schedule.placeholder", language)} />
          </label>
          <button className="primary-button" type="submit">
            <Plus aria-hidden="true" size={16} />
            {t("schedule.addButton", language)}
          </button>
          <p className="form-status">{status}</p>
        </form>
      </Panel>

      <Panel title={t("schedule.blocks", language)}>
        {blocks.length === 0 ? (
          <p className="empty-state">{t("schedule.noneForDate", language)}</p>
        ) : (
          <ul className="item-list">
            {blocks.map((block) => (
              <li key={block.id} className="item-row schedule-row">
                <strong>
                  {block.startTime}-{block.endTime}
                </strong>
                <span>{block.title}</span>
                <button className="icon-button" onClick={() => handleDelete(block.id)} type="button" title={t("schedule.delete", language)}>
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

function AIConfigView({ language }: { language: Language }) {
  const [provider, setProvider] = useState<AIProviderName>("mock");
  const [endpoint, setEndpoint] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [sendActivityTitles, setSendActivityTitles] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [status, setStatus] = useState(t("aiConfig.loading", language));

  useEffect(() => {
    setStatus(t("aiConfig.loading", language));
    fetchAIConfig()
      .then((config) => {
        setProvider(config.provider);
        setEndpoint(config.endpoint || defaultEndpointForProvider(config.provider));
        setModel(config.model || defaultModelForProvider(config.provider));
        setSendActivityTitles(config.sendActivityTitles);
        setHasApiKey(config.hasApiKey);
        setApiKey("");
        setStatus(t("aiConfig.loaded", language));
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : t("aiConfig.loadError", language)));
  }, [language]);

  function currentPayload() {
    return {
      provider,
      endpoint,
      model,
      apiKey: apiKey.trim() ? apiKey : undefined,
      sendActivityTitles,
    };
  }

  function handleProviderChange(nextProvider: AIProviderName) {
    setProvider(nextProvider);
    setEndpoint(defaultEndpointForProvider(nextProvider));
    setModel(defaultModelForProvider(nextProvider));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(t("aiConfig.saving", language));
    saveAIConfig(currentPayload())
      .then((config) => {
        setHasApiKey(config.hasApiKey);
        setApiKey("");
        setStatus(t("aiConfig.saved", language));
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : t("aiConfig.saveError", language)));
  }

  function handleTest() {
    setStatus(t("aiConfig.testing", language));
    testAIConfig(currentPayload())
      .then((result) => {
        setStatus(`${result.ok ? t("aiConfig.testOk", language) : t("aiConfig.testFail", language)}: ${result.message}`);
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : t("aiConfig.testFail", language)));
  }

  return (
    <section className="single-column">
      <Panel title={t("aiConfig.title", language)}>
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            {t("aiConfig.provider", language)}
            <select value={provider} onChange={(event) => handleProviderChange(event.target.value as AIProviderName)}>
              <option value="mock">mock</option>
              <option value="openai">openai</option>
              <option value="deepseek">deepseek</option>
              <option value="ollama">ollama</option>
            </select>
          </label>
          <div className="form-grid">
            <label>
              {t("aiConfig.endpoint", language)}
              <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder={defaultEndpointForProvider(provider)} />
            </label>
            <label>
              {t("aiConfig.model", language)}
              <input value={model} onChange={(event) => setModel(event.target.value)} placeholder={defaultModelForProvider(provider)} />
            </label>
          </div>
          <label>
            {t("aiConfig.apiKey", language)}
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={hasApiKey ? t("aiConfig.apiKeySaved", language) : t("aiConfig.apiKeyPlaceholder", language)}
            />
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={sendActivityTitles} onChange={(event) => setSendActivityTitles(event.target.checked)} />
            <span>{t("aiConfig.sendTitles", language)}</span>
          </label>
          <div className="form-actions">
            <button className="primary-button" type="submit">
              <Save aria-hidden="true" size={16} />
              {t("aiConfig.save", language)}
            </button>
            <button className="secondary-button" onClick={handleTest} type="button">
              <Sparkles aria-hidden="true" size={16} />
              {t("aiConfig.test", language)}
            </button>
            <span>{status}</span>
          </div>
        </form>
      </Panel>
    </section>
  );
}

function SettingsView({ language }: { language: Language }) {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [status, setStatus] = useState(t("settings.loading", language));

  useEffect(() => {
    setStatus(t("settings.loading", language));
    fetchSettings()
      .then((result) => {
        setSettings(result);
        setStatus(t("settings.loaded", language));
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : t("settings.loadError", language)));
  }, [language]);

  return (
    <section className="single-column settings-layout">
      <Panel title={t("settings.title", language)}>
        {settings ? (
          <dl className="settings-list">
            <div>
              <dt>ActivityWatch</dt>
              <dd>{settings.activitywatchUrl}</dd>
            </div>
            <div>
              <dt>API</dt>
              <dd>
                {settings.host}:{settings.port}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="empty-state">{status}</p>
        )}
        {settings ? <p className="form-status settings-status">{status}</p> : null}
      </Panel>
      <RuntimePanel language={language} />
    </section>
  );
}

function RuntimePanel({ language }: { language: Language }) {
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [status, setStatus] = useState(t("runtime.loading", language));
  const [stopping, setStopping] = useState(false);

  function loadRuntime() {
    setStatus(t("runtime.loading", language));
    fetchRuntimeStatus()
      .then((result) => {
        setRuntime(result);
        setStatus("");
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : t("runtime.loadError", language)));
  }

  useEffect(() => {
    loadRuntime();
  }, [language]);

  function handleStop() {
    setStopping(true);
    setStatus(t("runtime.stopping", language));
    stopRuntime()
      .then(() => setStatus(t("runtime.stopDone", language)))
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : t("runtime.loadError", language)))
      .finally(() => setStopping(false));
  }

  return (
    <Panel title={t("runtime.title", language)}>
      <div className="panel-toolbar">
        <button className="secondary-button" onClick={loadRuntime} type="button">
          <RefreshCw aria-hidden="true" size={16} />
          {t("runtime.refresh", language)}
        </button>
        <button className="danger-button" onClick={handleStop} disabled={stopping} type="button">
          <SquarePower aria-hidden="true" size={16} />
          {t("runtime.stop", language)}
        </button>
        <span>{status}</span>
      </div>
      {runtime ? (
        <div className="runtime-grid">
          <RuntimeCard title={t("runtime.backend", language)} process={runtime.backend} language={language} />
          <RuntimeCard title={t("runtime.frontend", language)} process={runtime.frontend} language={language} />
          <p className="form-status runtime-meta">
            {runtime.managed ? `${t("runtime.updatedAt", language)}: ${runtime.updatedAt || "--"}` : t("runtime.unmanaged", language)}
          </p>
        </div>
      ) : (
        <p className="empty-state">{status}</p>
      )}
    </Panel>
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
      <span>{process.running ? t("runtime.running", language) : t("runtime.stopped", language)}</span>
      <small>
        {t("runtime.pid", language)}: {process.pid ?? "--"}
      </small>
      <small>{process.startedAt || "--"}</small>
    </div>
  );
}

function LanguageToggle({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <div className="segmented-control" aria-label={t("language.label", language)}>
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

function HealthBadge({
  health,
  error,
  language,
}: {
  health: HealthResponse | null;
  error: string | null;
  language: Language;
}) {
  if (health) {
    return (
      <div className="status-badge online" title={`${health.appName} ${health.version}`}>
        {t("api.online", language)}
      </div>
    );
  }

  return (
    <div className="status-badge offline" title={error ?? "Backend unavailable"}>
      {t("api.offline", language)}
    </div>
  );
}

function viewTitle(view: ViewId, language: Language): string {
  const match = navItems.find((item) => item.id === view);
  return match ? t(match.labelKey, language) : t("nav.today", language);
}

function StatusNote({
  activity,
  error,
  language,
}: {
  activity: TodayActivityResponse | null;
  error: string | null;
  language: Language;
}) {
  if (error) {
    return <p className="status-note warning">{error}</p>;
  }

  if (!activity) {
    return <p className="status-note">{t("activity.loading", language)}</p>;
  }

  return <p className={activity.available ? "status-note" : "status-note warning"}>{activity.message}</p>;
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
    return <p className="empty-state">{t("activity.empty", language)}</p>;
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

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultEndpointForProvider(provider: AIProviderName): string {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "deepseek":
      return "https://api.deepseek.com/v1";
    case "ollama":
      return "http://localhost:11434";
    default:
      return "";
  }
}

function defaultModelForProvider(provider: AIProviderName): string {
  switch (provider) {
    case "openai":
      return "gpt-4.1-mini";
    case "deepseek":
      return "deepseek-chat";
    case "ollama":
      return "llama3.1";
    default:
      return "";
  }
}

function readStoredLanguage(): Language {
  return localStorage.getItem(languageStorageKey) === "en" ? "en" : "zh";
}

function t(key: I18nKey, language: Language): string {
  return translations[language][key];
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
