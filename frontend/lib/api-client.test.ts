import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch, getCsrfToken } from "@/lib/api-client";

describe("apiFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.cookie = "csrf=token-123; path=/";
  });

  it("keeps GET requests same-origin and includes cookies", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(apiFetch<{ ok: boolean }>("/api/time")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/time", expect.objectContaining({ credentials: "same-origin" }));
  });

  it("adds JSON and CSRF headers to a JSON mutation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await apiFetch("/api/bets", { method: "POST", body: JSON.stringify({ stake: 10 }) });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-CSRF-Token")).toBe("token-123");
  });

  it("does not set a JSON content type for FormData", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const body = new FormData();
    body.append("paper", new Blob(["paper"]), "paper.pdf");

    await apiFetch("/api/admin/markets/1/paper", { method: "POST", body });

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.has("Content-Type")).toBe(false);
    expect(headers.get("X-CSRF-Token")).toBe("token-123");
  });

  it("throws the backend detail for non-success responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Balance too low" }), { status: 400 }),
    );

    await expect(apiFetch("/api/bets")).rejects.toThrow("Balance too low");
  });

  it("reads the CSRF cookie and rejects absolute destinations", async () => {
    expect(getCsrfToken()).toBe("token-123");
    await expect(apiFetch("https://database.example/rows")).rejects.toThrow("relative /api path");
  });
});
