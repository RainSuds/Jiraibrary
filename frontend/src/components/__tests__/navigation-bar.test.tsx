import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NavigationBar from "../navigation-bar";

const pushMock = vi.fn();
const logoutMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => mockedPathname,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

/* eslint-disable @next/next/no-img-element */
vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string } & Record<string, unknown>) => (
    <img alt={alt} {...props} />
  ),
}));

let mockedPathname = "/";

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => mockedAuthState,
}));

type MockedAuthState = {
  user: null | {
    id: string;
    username: string;
    email: string;
    is_staff: boolean;
    display_name: string;
    role: null;
    avatar_url: string | null;
  };
  token: string | null;
  loading: boolean;
  login: () => Promise<unknown>;
  loginWithGoogle: () => Promise<unknown>;
  register: () => Promise<unknown>;
  logout: typeof logoutMock;
  refresh: () => Promise<void>;
};

let mockedAuthState: MockedAuthState;

beforeEach(() => {
  mockedPathname = "/search";
  mockedAuthState = {
    user: null,
    token: null,
    loading: false,
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn().mockResolvedValue(),
    logout: logoutMock.mockResolvedValue(),
  };
  pushMock.mockReset();
  logoutMock.mockReset();
});

describe("NavigationBar", () => {
  it("links to login with the current path encoded when user is signed out", () => {
    render(<NavigationBar />);

    const loginLink = screen.getByRole("link", { name: "Login" });
    expect(loginLink).toHaveAttribute("href", "/login?next=%2Fsearch");
  });

  it("shows the profile menu with avatar and actions when user is signed in", async () => {
    mockedAuthState.user = {
      id: "1",
      username: "jane",
      email: "jane@example.com",
      is_staff: false,
      display_name: "Jane",
      role: null,
      avatar_url: "https://lh3.googleusercontent.com/avatar.jpg",
    };

    render(<NavigationBar />);

  const avatarButton = screen.getByRole("button", { name: /Open account menu/i });
    await userEvent.click(avatarButton);

    expect(screen.getByText("Signed in as")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("invokes logout and redirects home from the menu", async () => {
    mockedAuthState.user = {
      id: "1",
      username: "jane",
      email: "jane@example.com",
      is_staff: false,
      display_name: "Jane",
      role: null,
      avatar_url: null,
    };

    render(<NavigationBar />);

  const avatarButton = screen.getByRole("button", { name: /Open account menu/i });
    await userEvent.click(avatarButton);

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith("/");
    });
  });
});
