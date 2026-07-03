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
