// Client-side API helper. Same-origin fetch with consistent error shape.

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiClientError extends Error {
  code: string;
  status: number;
  details: unknown;
  constructor(err: ApiErrorShape, status: number) {
    super(err.message);
    this.code = err.code;
    this.status = status;
    this.details = err.details;
  }
}

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body && (body as { error?: ApiErrorShape }).error) || { code: "UNKNOWN", message: `Request failed (${res.status})` };
    throw new ApiClientError(err, res.status);
  }
  return body as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin", headers: { accept: "application/json" } });
  return handle<T>(res);
}

export async function apiSend<T>(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handle<T>(res);
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, { method: "POST", credentials: "same-origin", body: form });
  return handle<T>(res);
}

// Shared domain types (subset used by the UI)

export interface Me {
  user: null | {
    id: string;
    email: string;
    name: string | null;
    role: "USER" | "SUPPORT" | "ADMIN";
    status: string;
    emailVerifiedAt: string | null;
  };
  creditBalanceCents?: number;
  unreadNotifications?: number;
}

export interface CatalogModel {
  id: string;
  name: string;
  kind: string;
  engine: string;
  description: string | null;
  sampleRate: number;
  version: number;
  licenseName: string;
  licenseUrl: string | null;
  licenseVerified: boolean;
  engineParams: { pitchSemitones?: number; formant?: number } | null;
  createdAt: string;
}

export interface PlanInfo {
  code: string;
  name: string;
  priceCents: number | null;
  currency: string;
  maxConcurrentSessions: number;
  maxMinutesPerDay: number;
  maxMinutesPerMonth: number;
  maxModelUploads: number;
  monthlyFreeCreditCents: number;
  priority: number;
  allowedTiers: string[];
  description: string | null;
}
