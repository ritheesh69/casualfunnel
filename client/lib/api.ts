export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

export const DEMO_URL = (process.env.NEXT_PUBLIC_DEMO_URL || 'http://localhost:5500').replace(/\/+$/, '');

export type EventType = 'page_view' | 'click';

export interface SessionSummary {
  session_id: string;
  total_events: number;
  page_views: number;
  clicks: number;
  last_activity: string;
}

export interface Totals {
  sessions: number;
  events: number;
  page_views: number;
  clicks: number;
}

export interface SessionsResponse {
  sessions: SessionSummary[];
  totals: Totals;
  pagination: { limit: number; offset: number; returned: number };
}

export interface SessionEvent {
  id: string;
  event_type: EventType;
  page_url: string;
  timestamp: string;
  coordinates: { x: number; y: number } | null;
}

export interface SessionEventsResponse {
  session_id: string;
  count: number;
  events: SessionEvent[];
}

export interface HeatmapPage {
  page_url: string;
  clicks: number;
}

export interface HeatmapPoint {
  x: number;
  y: number;
  page_width: number | null;
  page_height: number | null;
}

export interface HeatmapResponse {
  page_url: string;
  total_clicks: number;
  returned: number;
  points: HeatmapPoint[];
}

export class ApiRequestError extends Error {
  status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  } catch {
    throw new ApiRequestError(`Could not reach the API at ${API_BASE}.`, null);
  }

  if (!res.ok) {
    let message = `The API responded with status ${res.status}.`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* keep the generic message */
    }
    throw new ApiRequestError(message, res.status);
  }
  return (await res.json()) as T;
}

export const fetchSessions = () => get<SessionsResponse>('/api/sessions?limit=200');

export const fetchSessionEvents = (sessionId: string) =>
  get<SessionEventsResponse>(`/api/sessions/${encodeURIComponent(sessionId)}/events`);

export const fetchHeatmapPages = () => get<{ pages: HeatmapPage[] }>('/api/heatmap/pages');

export const fetchHeatmap = (pageUrl: string) =>
  get<HeatmapResponse>(`/api/heatmap?url=${encodeURIComponent(pageUrl)}`);
