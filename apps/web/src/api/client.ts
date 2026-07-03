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
  aiProvider: string;
  aiEndpoint: string;
  aiModel: string;
  aiSendActivityTitles: boolean;
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

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}
