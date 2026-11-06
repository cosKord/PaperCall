import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";

const push = vi.fn();
const signInWithOAuth = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock("@/lib/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signInWithOAuth },
  }),
}));

vi.mock("@/lib/use-branches", () => ({
  useBranches: () => ({ branches: ["CSE"], loaded: true, refresh: vi.fn() }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    push.mockReset();
    signInWithOAuth.mockReset();
    signInWithOAuth.mockResolvedValue({ error: null });
  });

  it("offers Google as the only sign-in method", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    expect(screen.queryByLabelText(/personal email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login` },
    });
  });
});
