type ApiErrorBody = { detail?: string };

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const token = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("csrf="));
  return token ? decodeURIComponent(token.slice("csrf=".length)) : "";
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/api/") || path.startsWith("//")) {
    throw new Error("apiFetch requires a relative /api path");
  }

  const method = (init.method ?? "GET").toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD";
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers = new Headers(init.headers);

  if (init.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (isMutation) {
    headers.set("X-CSRF-Token", getCsrfToken());
  }

  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers,
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail = typeof body === "object" && body !== null
      ? (body as ApiErrorBody).detail
      : String(body || "");
    throw new ApiError(detail || `Request failed (${response.status})`, response.status);
  }

  return body as T;
}
