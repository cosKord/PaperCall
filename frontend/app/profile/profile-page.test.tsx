import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProfilePage from "@/app/profile/page";
import { ApiError, apiFetch } from "@/lib/api-client";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiFetch: vi.fn(),
}));

const apiMock = vi.mocked(apiFetch);
const me = { id: 2, email: "alice@somaiya.edu", role: "player", branch: "CSE", balance: 115, admin_verified: false };

describe("ProfilePage", () => {
  beforeEach(() => {
    replace.mockReset();
    apiMock.mockReset();
    apiMock.mockImplementation(async (path) => {
      if (path === "/api/me") return me;
      if (path === "/api/profile") return {
        user: { id: 2, email: "alice@somaiya.edu", username: "alice", full_name: "Alice Example", academic_year: "SY", branch: "CSE", balance: 115 },
        score: -8,
        rank: 3,
        prediction_count: 2,
        subject_count: 2,
        success_rate: 50,
        active_bets: [],
        settled_bets: [
          { market_id: 5, subject: "FCOA", exam_type: "Midsem", topic_id: 9, topic: "IAS machine", side: "hit", stake: 20, payout: 40, net: 20, outcome: "hit", settled_at: "2026-11-01T10:00:00+00:00" },
          { market_id: 4, subject: "OS", exam_type: "Midsem", topic_id: 8, topic: "Deadlock", side: "hit", stake: 30, payout: 2, net: -28, outcome: "miss", settled_at: "2026-10-30T10:00:00+00:00" },
        ],
      };
      if (path === "/api/auth/logout") return { ok: true };
      return {};
    });
  });

  it("renders API-provided identity, rank, score, and settled history", async () => {
    render(<ProfilePage />);
    expect(await screen.findByText("alice@somaiya.edu")).toBeInTheDocument();
    expect(screen.getByText("CSE")).toBeInTheDocument();
    expect(screen.getByText("115 pts")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("-8 pts")).toBeInTheDocument();
    expect(screen.getByText("+20 pts")).toBeInTheDocument();
    expect(screen.getByText("-28 pts")).toBeInTheDocument();
  });

  it("renders an empty settled-history state", async () => {
    apiMock.mockImplementation(async (path) => path === "/api/me" ? me : {
      user: { ...me, username: "alice", full_name: "Alice Example", academic_year: "SY" }, score: 0, rank: 1,
      prediction_count: 0, subject_count: 0, success_rate: 0, active_bets: [], settled_bets: [],
    });
    render(<ProfilePage />);
    expect(await screen.findByText(/no settled predictions yet/i)).toBeInTheDocument();
  });

  it("logs out through the API and returns to login", async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);
    await user.click(await screen.findByRole("button", { name: /log out/i }));
    expect(apiMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    expect(replace).toHaveBeenCalledWith("/login", { transitionTypes: ["nav-back"] });
  });

  it("redirects an unauthenticated visitor", async () => {
    apiMock.mockRejectedValue(new ApiError("Invalid session", 401));
    render(<ProfilePage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText(/settled predictions/i)).not.toBeInTheDocument();
  });
});
