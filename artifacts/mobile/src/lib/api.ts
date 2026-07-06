/**
 * Base URL for the JISHLink API server.
 * The API server runs at the workspace root (port 8080) proxied at /api-server/
 * In dev, we hit it via the Replit proxy.
 */
const BASE = import.meta.env.BASE_URL ?? "/mobile/";

// The API server artifact is mounted at a sibling path to the mobile app.
// In development we resolve relative to origin.
export function apiUrl(path: string): string {
  // Normalise: ensure path starts with /
  const p = path.startsWith("/") ? path : `/${path}`;
  // API server artifact is mounted at /api by the Replit path-based proxy
  return `/api${p}`;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(message: string, code: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers: extraHeaders, ...rest } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = apiUrl(path);
  const res = await fetch(url, { headers, ...rest });

  const data = await res.json().catch(() => ({ error: "Invalid response", code: "UNKNOWN" }));

  if (!res.ok) {
    const errMsg = (data as { error?: string }).error ?? `HTTP ${res.status}`;
    const errCode = (data as { code?: string }).code ?? "UNKNOWN";
    throw new ApiError(errMsg, errCode, res.status, data as Record<string, unknown>);
  }

  return data as T;
}

// Keep BASE in scope to avoid unused-import lint
void BASE;
