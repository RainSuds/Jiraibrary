import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { CredentialResponse } from "@react-oauth/google";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "../page";
import { useAuth } from "@/components/auth-provider";

const pushMock = vi.fn();
const replaceMock = vi.fn();
let searchParams = new URLSearchParams();

const syncSearchParams = (query: string) => {
  window.history.replaceState({}, "", query ? `/login?${query}` : "/login");
  searchParams = new URLSearchParams(query);
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
  useSearchParams: () => searchParams,
  usePathname: () => "/login",
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

type GoogleHandlers = {
  onSuccess?: (response: CredentialResponse) => void;
  onError?: () => void;
};

let googleHandlers: GoogleHandlers = {};

vi.mock("@react-oauth/google", () => ({
  GoogleLogin: (props: {
    onSuccess: (response: CredentialResponse) => void;
    onError: () => void;
  }) => {
    googleHandlers = {
      onSuccess: props.onSuccess,
      onError: props.onError,
    };
    return (
      <button type="button" data-testid="google-login" onClick={() => props.onSuccess({ credential: "mock-token" } as CredentialResponse)}>
        google login
      </button>
    );
  },
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: vi.fn(),
}));

const useAuthMock = useAuth as unknown as ReturnType<typeof vi.fn>;

let loginMock: ReturnType<typeof vi.fn>;
let loginWithGoogleMock: ReturnType<typeof vi.fn>;
let registerMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
  syncSearchParams("");
  googleHandlers = {};
  loginMock = vi.fn().mockResolvedValue({});
  loginWithGoogleMock = vi.fn().mockResolvedValue({});
  registerMock = vi.fn().mockResolvedValue({});

  useAuthMock.mockReturnValue({
    user: null,
    token: null,
    loading: false,
    login: loginMock,
    loginWithGoogle: loginWithGoogleMock,
    register: registerMock,
    logout: vi.fn(),
    refresh: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  googleHandlers = {};
});

describe("LoginPage", () => {
  it("submits credentials and routes to the next destination", async () => {
    const user = userEvent.setup();
    syncSearchParams("next=/add-entry");

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/Username or email/i), "jane");
    await user.type(screen.getByLabelText(/Password/i), "secret123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("jane", "secret123");
      expect(pushMock).toHaveBeenCalledWith("/add-entry");
    });
  });

  it("surfaces API errors when login fails", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValueOnce(new Error("Invalid credentials"));

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/Username or email/i), "jane");
    await user.type(screen.getByLabelText(/Password/i), "wrong");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows redirect state when the user is already authenticated", async () => {
    const loggedInUser = {
      id: "1",
      username: "jane",
      email: "jane@example.com",
      is_staff: false,
      display_name: "Jane",
      role: null,
      avatar_url: null,
    };

    useAuthMock.mockReturnValue({
      user: loggedInUser,
      token: "token",
      loading: false,
      login: vi.fn(),
      loginWithGoogle: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    render(<LoginPage />);

    expect(screen.getByText("Redirecting to your profile…")).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/profile");
    });
  });

  it("registers a new account and redirects when the form is toggled", async () => {
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Need an account? Register" }));
    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText(/Display name/), " New Display ");
    await user.type(screen.getByLabelText(/^Password$/), "secretpass");
    await user.type(screen.getByLabelText("Confirm password"), "secretpass");
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        username: "newuser",
        email: "new@example.com",
        password: "secretpass",
        displayName: "New Display",
      });
      expect(pushMock).toHaveBeenCalledWith("/profile");
    });
  });

  it("blocks registration submission when passwords do not match", async () => {
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Need an account? Register" }));
    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText(/^Password$/), "secretpass");
    await user.type(screen.getByLabelText("Confirm password"), "different");
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    });
    expect(registerMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("sanitizes unsafe next destinations before redirecting", async () => {
    const user = userEvent.setup();
    syncSearchParams("next=//evil.example");

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/Username or email/i), "jane");
    await user.type(screen.getByLabelText(/Password/i), "secret123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("jane", "secret123");
      expect(pushMock).toHaveBeenCalledWith("/profile");
    });
  });

  it("logs in with Google and redirects", async () => {
    const user = userEvent.setup();
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client");

    render(<LoginPage />);

    expect(screen.getByTestId("google-login")).toBeInTheDocument();

    await user.click(screen.getByTestId("google-login"));

    await waitFor(() => {
      expect(loginWithGoogleMock).toHaveBeenCalledWith("mock-token");
      expect(pushMock).toHaveBeenCalledWith("/profile");
    });
  });

  it("surfaces errors when Google login fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client");
    loginWithGoogleMock.mockRejectedValueOnce(new Error("Google error"));

    render(<LoginPage />);

    googleHandlers.onSuccess?.({ credential: "mock-token" } as CredentialResponse);

    await waitFor(() => {
      expect(screen.getByText("Google error")).toBeInTheDocument();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a validation message when Google response lacks a credential", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client");

    render(<LoginPage />);

    googleHandlers.onSuccess?.({ credential: undefined } as CredentialResponse);

    await waitFor(() => {
      expect(screen.getByText("Google login failed. Please try again.")).toBeInTheDocument();
    });
    expect(loginWithGoogleMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("displays a generic error when Google reports a failure", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client");

    render(<LoginPage />);

    googleHandlers.onError?.();

    await waitFor(() => {
      expect(screen.getByText("Google sign-in was unsuccessful. Please try again.")).toBeInTheDocument();
    });
    expect(loginWithGoogleMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
