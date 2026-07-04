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

export type LearningGoal = {
  id: number;
  name: string;
  description: string;
  currentFocus: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AISummaryResult = {
  score: number;
  summary: string;
  strengths: string[];
  blockers: string[];
  improvements: string[];
};

export type AISummaryRecord = {
  id: number;
  date?: string;
  provider: string;
  score: number;
  result: AISummaryResult;
  createdAt: string;
};

export type AIPlannedTask = {
  id: number;
  title: string;
  reason: string;
  plannedFor: string;
  accepted: boolean;
  acceptedTaskId: number | null;
  createdAt: string;
};

export type AIPlanResult = {
  todayPlan: string[];
  weekPlan: string[];
  suggestedTasks: AIPlannedTask[];
};

export type AIPlanRecord = {
  id: number;
  date: string;
  goalId: number;
  provider: string;
  result: AIPlanResult;
  createdAt: string;
};

export type DayRecord = {
  date: string;
  journal: Journal;
  scheduleBlocks: Omit<ScheduleBlock, "date">[];
  activity: TodayActivityResponse;
  aiSummaries: AISummaryRecord[];
  aiPlans: Array<AIPlanRecord & { goalName?: string }>;
};

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  return readJson<HealthResponse>(response);
}

export async function fetchTodayActivity(): Promise<TodayActivityResponse> {
  const response = await fetch(`${API_BASE_URL}/api/activity/today`);
  return readJson<TodayActivityResponse>(response);
}

export async function fetchDayActivity(date: string): Promise<TodayActivityResponse> {
  const response = await fetch(`${API_BASE_URL}/api/activity/${date}`);
  return readJson<TodayActivityResponse>(response);
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

export async function updateTask(
  id: number,
  payload: Partial<Pick<Task, "title" | "completed" | "plannedFor" | "area" | "priority">>,
): Promise<Task> {
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

export async function fetchRuntimeStatus(): Promise<RuntimeStatus> {
  const response = await fetch(`${API_BASE_URL}/api/runtime/status`);
  return readJson<RuntimeStatus>(response);
}

export async function stopRuntime(): Promise<{ stopped: boolean; backendStopped: boolean; frontendStopped: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/runtime/stop`, { method: "POST" });
  return readJson<{ stopped: boolean; backendStopped: boolean; frontendStopped: boolean }>(response);
}

export async function fetchGoals(): Promise<LearningGoal[]> {
  const response = await fetch(`${API_BASE_URL}/api/goals`);
  return readJson<LearningGoal[]>(response);
}

export async function createGoal(payload: {
  name: string;
  description: string;
  currentFocus: string;
  active: boolean;
}): Promise<LearningGoal> {
  const response = await fetch(`${API_BASE_URL}/api/goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<LearningGoal>(response);
}

export async function updateGoal(
  id: number,
  payload: Partial<Pick<LearningGoal, "name" | "description" | "currentFocus" | "active">>,
): Promise<LearningGoal> {
  const response = await fetch(`${API_BASE_URL}/api/goals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<LearningGoal>(response);
}

export async function deleteGoal(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/goals/${id}`, { method: "DELETE" });
  await readJson<{ deleted: boolean }>(response);
}

export async function generateAISummary(date: string): Promise<AISummaryRecord> {
  const response = await fetch(`${API_BASE_URL}/api/ai/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date }),
  });
  return readJson<AISummaryRecord>(response);
}

export async function fetchAISummaries(date: string): Promise<AISummaryRecord[]> {
  const response = await fetch(`${API_BASE_URL}/api/ai/summary/${date}`);
  return readJson<AISummaryRecord[]>(response);
}

export async function generateAIPlan(payload: { date: string; goalId: number }): Promise<AIPlanRecord> {
  const response = await fetch(`${API_BASE_URL}/api/ai/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<AIPlanRecord>(response);
}

export async function fetchAIPlans(date: string, goalId: number): Promise<AIPlanRecord[]> {
  const response = await fetch(`${API_BASE_URL}/api/ai/plan/${date}/${goalId}`);
  return readJson<AIPlanRecord[]>(response);
}

export async function acceptPlannedTask(planId: number, suggestionId: number): Promise<{ task: Task }> {
  const response = await fetch(`${API_BASE_URL}/api/ai/plan/${planId}/accept-task/${suggestionId}`, {
    method: "POST",
  });
  return readJson<{ task: Task }>(response);
}

export async function fetchDayRecord(date: string): Promise<DayRecord> {
  const response = await fetch(`${API_BASE_URL}/api/day-record/${date}`);
  return readJson<DayRecord>(response);
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
