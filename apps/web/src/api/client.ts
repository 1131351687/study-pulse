const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:7788";

export type HealthResponse = {
  status: string;
  appName: string;
  version: string;
  environment: string;
};

export type ActivityEntry = {
  name: string;
  seconds: number;
};

export type TodayActivityResponse = {
  date: string;
  available: boolean;
  message: string;
  totalSeconds: number;
  bucketCount: number;
  topApps: ActivityEntry[];
  topTitles: ActivityEntry[];
};

export type Journal = {
  date: string;
  content: string;
  updatedAt: string;
};

export type PlannedFor = "today" | "tomorrow" | "week";
export type Priority = "low" | "normal" | "high";

export type Task = {
  id: number;
  title: string;
  completed: boolean;
  plannedFor: PlannedFor;
  area: string;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleBlock = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicSettings = {
  activitywatchUrl: string;
  host: string;
  port: number;
};

export type AIProviderName = "mock" | "openai" | "deepseek" | "ollama";

export type AIConfig = {
  provider: AIProviderName;
  endpoint: string;
  model: string;
  sendActivityTitles: boolean;
  hasApiKey: boolean;
};

export type AITestResponse = {
  ok: boolean;
  provider: string;
  message: string;
};

export type SuggestedTask = {
  title: string;
  plannedFor: string;
  reason: string;
};

export type SuggestedScheduleBlock = {
  startTime: string;
  endTime: string;
  title: string;
};

export type DailyPlanResult = {
  summary: string;
  topics: string[];
  timeInsights: string[];
  unfinishedReasons: string[];
  suggestedTasks: SuggestedTask[];
  tomorrowSchedule: SuggestedScheduleBlock[];
};

export type DailyPlanResponse = {
  date: string;
  provider: string;
  result: DailyPlanResult | null;
  updatedAt?: string;
};

export type HistoryScheduleBlock = {
  startTime: string;
  endTime: string;
  title: string;
};

export type HistoryDay = {
  date: string;
  journalPreview: string;
  journalUpdatedAt: string;
  scheduleBlocks: HistoryScheduleBlock[];
  hasPlan: boolean;
  planProvider: string;
  planSummary: string;
  activityAvailable: boolean;
  trackedSeconds: number;
};

export type RuntimeProcessStatus = {
  running: boolean;
  pid: number | null;
  startedAt: string;
  label: string;
};

export type RuntimeStatus = {
  managed: boolean;
  backend: RuntimeProcessStatus;
  frontend: RuntimeProcessStatus;
  updatedAt: string;
};

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return response.json() as Promise<HealthResponse>;
}

export async function fetchTodayActivity(): Promise<TodayActivityResponse> {
  const response = await fetch(`${API_BASE_URL}/api/activity/today`);

  if (!response.ok) {
    throw new Error(`Activity request failed with status ${response.status}`);
  }

  return response.json() as Promise<TodayActivityResponse>;
}

export async function fetchJournal(date: string): Promise<Journal> {
  const response = await fetch(`${API_BASE_URL}/api/journal/${date}`);
  return readJson<Journal>(response);
}

export async function saveJournal(date: string, content: string): Promise<Journal> {
  const response = await fetch(`${API_BASE_URL}/api/journal/${date}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return readJson<Journal>(response);
}

export async function fetchTasks(): Promise<Task[]> {
  const response = await fetch(`${API_BASE_URL}/api/tasks`);
  return readJson<Task[]>(response);
}

export async function createTask(payload: {
  title: string;
  plannedFor: PlannedFor;
  area: string;
  priority: Priority;
}): Promise<Task> {
  const response = await fetch(`${API_BASE_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<Task>(response);
}

export async function updateTask(id: number, payload: Partial<Task>): Promise<Task> {
  const response = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<Task>(response);
}

export async function deleteTask(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/tasks/${id}`, { method: "DELETE" });
  await readJson<{ deleted: boolean }>(response);
}

export async function fetchSchedule(date: string): Promise<ScheduleBlock[]> {
  const response = await fetch(`${API_BASE_URL}/api/schedule/${date}`);
  return readJson<ScheduleBlock[]>(response);
}

export async function createScheduleBlock(payload: {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
}): Promise<ScheduleBlock> {
  const response = await fetch(`${API_BASE_URL}/api/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<ScheduleBlock>(response);
}

export async function deleteScheduleBlock(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/schedule/${id}`, { method: "DELETE" });
  await readJson<{ deleted: boolean }>(response);
}

export async function fetchSettings(): Promise<PublicSettings> {
  const response = await fetch(`${API_BASE_URL}/api/settings`);
  return readJson<PublicSettings>(response);
}

export async function fetchAIConfig(): Promise<AIConfig> {
  const response = await fetch(`${API_BASE_URL}/api/ai/config`);
  return readJson<AIConfig>(response);
}

export async function saveAIConfig(payload: {
  provider: AIProviderName;
  endpoint: string;
  model: string;
  apiKey?: string;
  sendActivityTitles: boolean;
}): Promise<AIConfig> {
  const response = await fetch(`${API_BASE_URL}/api/ai/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<AIConfig>(response);
}

export async function testAIConfig(payload: {
  provider: AIProviderName;
  endpoint: string;
  model: string;
  apiKey?: string;
  sendActivityTitles: boolean;
}): Promise<AITestResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ai/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<AITestResponse>(response);
}

export async function fetchDailyPlan(date: string): Promise<DailyPlanResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ai/daily-plan/${date}`);
  return readJson<DailyPlanResponse>(response);
}

export async function generateDailyPlan(date: string): Promise<DailyPlanResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ai/daily-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date }),
  });
  return readJson<DailyPlanResponse>(response);
}

export async function fetchHistoryDays(days = 14): Promise<HistoryDay[]> {
  const response = await fetch(`${API_BASE_URL}/api/history/days?days=${days}`);
  return readJson<HistoryDay[]>(response);
}

export async function fetchRuntimeStatus(): Promise<RuntimeStatus> {
  const response = await fetch(`${API_BASE_URL}/api/runtime/status`);
  return readJson<RuntimeStatus>(response);
}

export async function stopRuntime(): Promise<{ stopped: boolean; backendStopped: boolean; frontendStopped: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/runtime/stop`, { method: "POST" });
  return readJson<{ stopped: boolean; backendStopped: boolean; frontendStopped: boolean }>(response);
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { detail?: unknown };
      detail = typeof payload.detail === "string" ? payload.detail : JSON.stringify(payload.detail);
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}
