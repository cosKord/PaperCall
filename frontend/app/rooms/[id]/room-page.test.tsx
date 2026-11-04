import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RoomPage from "@/app/rooms/[id]/page";
import { apiFetch } from "@/lib/api-client";
import type { Me } from "@/types/api";

let guardedUser: Me;
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "5" }),
  useRouter: () => ({ replace, push: vi.fn() }),
}));
vi.mock("@/components/auth-guard", () => ({
  AuthGuard: ({ children }: { children: (user: Me) => React.ReactNode; }) => <>{children(guardedUser)}</>,
}));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

const apiMock = vi.mocked(apiFetch);
const player: Me = { id: 2, email: "alice@somaiya.edu", role: "player", branch: "CSE", balance: 80, admin_verified: false };
const openMarket = {
  id: 5,
  subject: "FCOA",
  exam_type: "midsem",
  starts_at: "2026-11-02T10:00:00+00:00",
  ends_at: "2026-11-02T11:00:00+00:00",
  lockout_at: "2026-11-02T10:00:00+00:00",
  status: "open",
  grant_pts: 100,
  legacy: false,
  topics: [{ id: 9, title: "IAS machine", tier: "high", my_bet: { side: "hit", stake: 20 } }],
};

describe("RoomPage", () => {
  beforeEach(() => {
    guardedUser = player;
    replace.mockReset();
    apiMock.mockReset();
    apiMock.mockImplementation(async (path) => {
      if (path === "/api/markets/5") return openMarket;
      if (path === "/api/time") return { now: "2026-11-01T10:00:00+00:00", pilot_admin_code_enabled: true };
      return { ok: true };
    });
  });

  it("keeps open pools private and shows only the caller's prediction", async () => {
    render(<RoomPage />);
    expect(await screen.findByRole("heading", { name: /fcoa/i })).toBeInTheDocument();
    expect(screen.getByText(/your prediction: hit · 20 pts/i)).toBeInTheDocument();
    expect(screen.queryByText(/pool:/i)).not.toBeInTheDocument();
  });

  it("shows outcomes, pools, and net points after settlement", async () => {
    apiMock.mockImplementation(async (path) => {
      if (path === "/api/markets/5") return {
        ...openMarket,
        status: "settled",
        paper_available: true,
        topics: [{ id: 9, title: "IAS machine", tier: "high", outcome: "miss", pool: { hit: 20, miss: 10 }, my_bet: { side: "hit", stake: 20, payout: 0, net: -20 } }],
      };
      return { now: "2026-11-03T10:00:00+00:00", pilot_admin_code_enabled: true };
    });
    render(<RoomPage />);
    expect(await screen.findByText(/outcome: miss/i)).toBeInTheDocument();
    expect(screen.getByText(/pool: hit 20 · miss 10/i)).toBeInTheDocument();
    expect(screen.getByText(/net: -20 pts/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /question paper/i })).toHaveAttribute("href", "/api/markets/5/paper");
  });

  it("posts a final integer bet through the API", async () => {
    const user = userEvent.setup();
    render(<RoomPage />);
    await screen.findByRole("heading", { name: /fcoa/i });
    await user.selectOptions(screen.getByLabelText(/prediction for ias machine/i), "miss");
    await user.clear(screen.getByLabelText(/stake for ias machine/i));
    await user.type(screen.getByLabelText(/stake for ias machine/i), "12");
    await user.click(screen.getByRole("button", { name: /place final bet on ias machine/i }));

    expect(apiMock).toHaveBeenCalledWith("/api/bets", {
      method: "POST",
      body: JSON.stringify({ topic_id: 9, side: "miss", stake: 12 }),
    });
  });

  it("shows complete room controls to verified admins", async () => {
    guardedUser = { ...player, role: "admin", admin_verified: true };
    render(<RoomPage />);
    expect(await screen.findByRole("heading", { name: /admin controls/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add topic/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /publish room/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock betting now/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload paper/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview settlement/i })).toBeInTheDocument();
  });
});
