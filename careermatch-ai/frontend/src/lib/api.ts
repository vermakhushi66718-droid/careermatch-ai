export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: Record<string, string>) { super(message); }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onAuthLost: (() => void) | null = null;

export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;
export const setAuthLostHandler = (fn: () => void) => { onAuthLost = fn; };

async function raw(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let res: Response;
  try { res = await fetch(`/api${path}`, { ...init, headers, credentials: "include" }); }
  catch { throw new ApiError(0, "Cannot reach the server. Check your connection and try again.", "NETWORK"); }
  if (res.status === 401 && retry && !path.startsWith("/auth/login") && !path.startsWith("/auth/register") && !path.startsWith("/auth/refresh")) {
    if (await refreshSession()) return raw(path, init, false);
    onAuthLost?.();
  }
  return res;
}

export async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const r = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
        if (!r.ok) { accessToken = null; return false; }
        accessToken = (await r.json()).accessToken; return true;
      } catch { return false; } finally { setTimeout(() => { refreshing = null; }, 0); }
    })();
  }
  return refreshing;
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.message ?? "Something went wrong. Please try again.", e.code, e.details);
  }
  return data as T;
}

export const api = {
  get: <T,>(p: string) => raw(p).then((r) => parse<T>(r)),
  post: <T,>(p: string, body?: unknown) => raw(p, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => parse<T>(r)),
  put: <T,>(p: string, body?: unknown) => raw(p, { method: "PUT", body: JSON.stringify(body ?? {}) }).then((r) => parse<T>(r)),
  patch: <T,>(p: string, body?: unknown) => raw(p, { method: "PATCH", body: JSON.stringify(body ?? {}) }).then((r) => parse<T>(r)),
  del: <T,>(p: string) => raw(p, { method: "DELETE" }).then((r) => parse<T>(r)),
  upload: <T,>(p: string, form: FormData) => raw(p, { method: "POST", body: form }).then((r) => parse<T>(r)),
  async blob(p: string): Promise<Blob> {
    const r = await raw(p);
    if (!r.ok) throw new ApiError(r.status, "Could not load file");
    return r.blob();
  },
};

export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
