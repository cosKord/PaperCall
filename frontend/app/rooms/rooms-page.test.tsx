import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RoomsPage from "@/app/rooms/page";
import { apiFetch } from "@/lib/api-client";
import type { Me } from "@/types/api";

let guardedUser: Me;

vi.mock("@/components/auth-guard", () => ({
  AuthGuard: ({ children }: { children: (user: Me) => React.ReactNode }) => <>{children(guardedUser)}</>,
}));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

const apiMock = vi.mocked(apiFetch);
const player: Me = { id: 2, email: "alice@somaiya.edu", role: "player", branch: "CSE", balance: 80, admin_verified: false };

describe("RoomsPage", () => {
  beforeEach(() => {
    guardedUser = player;
    apiMock.mockReset();
    apiMock.mockImplementation(async (path) => {
      if (path === "/api/markets") return [{ id: 5, subject: "FCOA", exam_type: "midsem", lockout_at: "2026-11-02T10:00:00+00:00", status: "open" }];
      if (path === "/api/leaderboard") return [{ email: "alice@somaiya.edu", score: -10 }];
      return [];
    });
  });

  it("shows player balance, branch, market links, and leaderboard", async () => {
    render(<RoomsPage />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading rooms/i);
    expect(await screen.findByRole("link", { name: /fcoa/i })).toHaveAttribute("href", "/rooms/5");
    expect(screen.getByText(/80 pts/i)).toBeInTheDocument();
    expect(screen.getByText(/branch: cse/i)).toBeInTheDocument();
    expect(screen.getByText("-10")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    apiMock.mockImplementation(async (path) => path === "/api/markets" ? [] : []);
    render(<RoomsPage />);
    expect(await screen.findByText(/no exam rooms yet/i)).toBeInTheDocument();
  });

  it("shows API errors", async () => {
    apiMock.mockRejectedValue(new Error("Rooms unavailable"));
    render(<RoomsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Rooms unavailable");
  });

  it("warns players whose branch is not assigned", async () => {
    guardedUser = { ...player, branch: null };
    render(<RoomsPage />);
    expect(await screen.findByText(/admin must assign your branch/i)).toBeInTheDocument();
  });

  it("shows branch assignment and market creation only to admins", async () => {
    guardedUser = { ...player, id: 1, email: "admin@somaiya.edu", role: "admin", admin_verified: true };
    apiMock.mockImplementation(async (path) => {
      if (path === "/api/markets") return [];
      if (path === "/api/leaderboard") return [];
      if (path === "/api/admin/users") return [{ id: 2, email: "alice@somaiya.edu", branch: null, role: "player" }];
      return { ok: true };
    });
    render(<RoomsPage />);
    expect(await screen.findByRole("heading", { name: /create exam room/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /assign branch/i })).toBeInTheDocument();
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/api/admin/users"));
  });
});
