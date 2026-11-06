import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RoomsPage from "@/app/rooms/page";
import { apiFetch } from "@/lib/api-client";
import type { Me, ProfileResponse } from "@/types/api";

let guardedUser: Me;

vi.mock("@/components/auth-guard", () => ({
  AuthGuard: ({ children }: { children: (user: Me) => React.ReactNode; }) => <>{children(guardedUser)}</>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

const apiMock = vi.mocked(apiFetch);
const player: Me = { id: 2, email: "alice@somaiya.edu", username: "alice", role: "player", branch: "IT", balance: 80, admin_verified: false };
const admin: Me = { id: 1, email: "admin@somaiya.edu", username: "admin", role: "admin", branch: null, balance: 0, admin_verified: true };
const profile: ProfileResponse = {
  user: { id: 2, email: "alice@somaiya.edu", username: "alice", full_name: "Alice Example", academic_year: "SY", branch: "IT", balance: 80, xp: 0 },
  score: 15,
  rank: 2,
  prediction_count: 7,
  subject_count: 3,
  success_rate: 60,
  active_bets: [],
  settled_bets: [],
};

describe("RoomsPage", () => {
  beforeEach(() => {
    guardedUser = player;
    apiMock.mockReset();
    apiMock.mockImplementation(async (path) => {
      if (path === "/api/branches") return ["IT", "CSE", "AIDS", "CSBS", "MECH", "CCE"];
      if (String(path).startsWith("/api/leaderboard")) return [];
      return [];
    });
  });

  it("shows all branch rooms to a player", async () => {
    render(<RoomsPage />);
    expect(screen.getByRole("heading", { name: /hi, alice/i })).toBeInTheDocument();
    for (const branch of ["IT", "CSE", "AIDS", "CSBS", "MECH", "CCE"]) {
      expect(await screen.findByRole("link", { name: new RegExp(`open ${branch} room`, "i") })).toBeInTheDocument();
    }
  });

  it("opens a user action dropdown and loads the selected profile", async () => {
    guardedUser = admin;
    apiMock.mockImplementation(async (path) => {
      if (path === "/api/admin/users") return [{ id: 2, email: "alice@somaiya.edu", username: "alice", branch: "IT", active: true, created_at: "2026-11-01T10:00:00+00:00" }];
      if (path === "/api/branches") return ["IT"];
      if (String(path).startsWith("/api/leaderboard")) return [];
      if (path === "/api/admin/users/2/profile") return profile;
      return { ok: true };
    });
    render(<RoomsPage />);

    await userEvent.click(await screen.findByRole("button", { name: /more actions for alice/i }));
    expect(screen.getByRole("menuitem", { name: /view profile/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /edit balance/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /remove user/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: /view profile/i }));

    expect(await screen.findByRole("heading", { name: "Alice Example" })).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith("/api/admin/users/2/profile");
  });

  it("submits an auditable balance adjustment", async () => {
    guardedUser = admin;
    apiMock.mockImplementation(async (path) => {
      if (path === "/api/admin/users") return [{ id: 2, email: "alice@somaiya.edu", username: "alice", branch: "IT", active: true, created_at: "2026-11-01T10:00:00+00:00" }];
      if (path === "/api/branches") return ["IT"];
      if (String(path).startsWith("/api/leaderboard")) return [];
      if (path === "/api/admin/users/2/profile") return profile;
      return { balance: 105 };
    });
    render(<RoomsPage />);

    await userEvent.click(await screen.findByRole("button", { name: /more actions for alice/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /edit balance/i }));
    await userEvent.type(await screen.findByLabelText(/points to add or subtract/i), "25");
    await userEvent.type(screen.getByLabelText(/reason/i), "Contest correction");
    await userEvent.click(screen.getByRole("button", { name: /apply adjustment/i }));

    expect(apiMock).toHaveBeenCalledWith("/api/admin/users/2/balance-adjustments", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ amount: 25, reason: "Contest correction" }),
    }));
  });

  it("confirms before removing a user", async () => {
    guardedUser = admin;
    apiMock.mockImplementation(async (path) => path === "/api/admin/users"
      ? [{ id: 2, email: "alice@somaiya.edu", username: "alice", branch: "IT", active: true, created_at: "2026-11-01T10:00:00+00:00" }]
      : path === "/api/branches" ? ["IT"] : String(path).startsWith("/api/leaderboard") ? [] : { ok: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<RoomsPage />);

    await userEvent.click(await screen.findByRole("button", { name: /more actions for alice/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /remove user/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(apiMock).toHaveBeenCalledWith("/api/admin/users/2", { method: "DELETE" });
  });
});
