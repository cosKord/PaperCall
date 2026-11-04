import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";
import { apiFetch } from "@/lib/api-client";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

const apiMock = vi.mocked(apiFetch);

describe("LoginPage", () => {
  beforeEach(() => {
    push.mockReset();
    apiMock.mockReset();
  });

  it("requests a college code and displays the local demo code", async () => {
    apiMock.mockResolvedValueOnce({ ok: true, demo_code: "246810" });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/college email/i), "alice@somaiya.edu");
    await user.selectOptions(screen.getByLabelText(/^branch$/i), "CSE");
    await user.click(screen.getByRole("button", { name: /send login code/i }));

    expect(apiMock).toHaveBeenCalledWith("/api/auth/request-code", expect.objectContaining({ method: "POST" }));
    expect(await screen.findByText(/246810/)).toBeInTheDocument();
    expect(screen.getByLabelText(/login code/i)).toBeInTheDocument();
  });

  it("routes a verified player to rooms", async () => {
    apiMock
      .mockResolvedValueOnce({ ok: true, demo_code: "123456" })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ id: 2, email: "alice@somaiya.edu", role: "player", branch: "CSE", balance: 100, admin_verified: false });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/college email/i), "alice@somaiya.edu");
    await user.selectOptions(screen.getByLabelText(/^branch$/i), "CSE");
    await user.click(screen.getByRole("button", { name: /send login code/i }));
    await user.type(screen.getByLabelText(/login code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify code/i }));

    expect(push).toHaveBeenCalledWith("/rooms");
  });

  it("requires the admin second factor before routing", async () => {
    apiMock
      .mockResolvedValueOnce({ ok: true, demo_code: "123456" })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ id: 1, email: "admin@somaiya.edu", role: "admin", branch: "CSE", balance: 0, admin_verified: false })
      .mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/college email/i), "admin@somaiya.edu");
    await user.selectOptions(screen.getByLabelText(/^branch$/i), "CSE");
    await user.click(screen.getByRole("button", { name: /send login code/i }));
    await user.type(screen.getByLabelText(/login code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify code/i }));

    expect(await screen.findByLabelText(/admin access code/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/admin access code/i), "2111");
    await user.click(screen.getByRole("button", { name: /verify admin/i }));

    expect(apiMock).toHaveBeenLastCalledWith("/api/auth/admin-totp", expect.objectContaining({ method: "POST" }));
    expect(push).toHaveBeenCalledWith("/rooms");
  });
});
