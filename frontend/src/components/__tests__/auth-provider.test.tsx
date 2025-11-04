import { act, render, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { forwardRef, useImperativeHandle } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/components/auth-provider";
import * as api from "@/lib/api";

type MockUser = {
  id: string;
  username: string;
  email: string;
  is_staff: boolean;
  display_name: string;
  role: null;
  avatar_url: string | null;
};

vi.mock("@/lib/api", () => ({
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

const loginMock = vi.mocked(api.login);
const loginWithGoogleMock = vi.mocked(api.loginWithGoogle);
const registerMock = vi.mocked(api.register);
const logoutMock = vi.mocked(api.logout);
const getCurrentUserMock = vi.mocked(api.getCurrentUser);

type AuthHandle = ReturnType<typeof useAuth>;

const ExposeAuth = forwardRef<AuthHandle | null>((_, ref) => {
  const auth = useAuth();
  useImperativeHandle(ref, () => auth, [auth]);
  return null;
});

ExposeAuth.displayName = "ExposeAuth";

function renderAuthProvider(handle: MutableRefObject<AuthHandle | null>) {
  return render(
    <AuthProvider>
      <ExposeAuth ref={handle} />
    </AuthProvider>
  );
}

const localStorageStore = new Map<string, string>();
const STORAGE_KEY = "jiraibrary.auth.token";

function createStorageMock(): Storage {
  return {
    get length() {
      return localStorageStore.size;
    },
    clear: () => localStorageStore.clear(),
    getItem: (key: string) => localStorageStore.get(key) ?? null,
    key: (index: number) => Array.from(localStorageStore.keys())[index] ?? null,
    removeItem: (key: string) => {
      localStorageStore.delete(key);
    },
    setItem: (key: string, value: string) => {
      localStorageStore.set(key, value);
    },
  };
}

const originalLocalStorage = window.localStorage;

beforeEach(() => {
  loginMock.mockReset();
  loginWithGoogleMock.mockReset();
  registerMock.mockReset();
  logoutMock.mockReset();
  getCurrentUserMock.mockReset();

  localStorageStore.clear();

  Object.defineProperty(window, "localStorage", {
    value: createStorageMock(),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: originalLocalStorage,
    configurable: true,
    writable: true,
  });
  vi.restoreAllMocks();
});

describe("AuthProvider", () => {
  it("logs in a user and persists the token", async () => {
    const handle = { current: null } as MutableRefObject<AuthHandle | null>;
    const user: MockUser = {
      id: "1",
      username: "alice",
      email: "alice@example.com",
      is_staff: false,
      display_name: "Alice",
      role: null,
      avatar_url: null,
    };

    loginMock.mockResolvedValue({ token: "abc", user });

    renderAuthProvider(handle);

    await waitFor(() => {
      expect(handle.current).not.toBeNull();
    });

    await act(async () => {
      await handle.current?.login("alice", "password123");
    });

    await waitFor(() => {
      expect(handle.current?.user).toEqual(user);
      expect(handle.current?.token).toBe("abc");
    });
    expect(localStorageStore.get(STORAGE_KEY)).toBe("abc");
  });

  it("hydrates a stored token and clears it when fetching user fails", async () => {
    const handle = { current: null } as MutableRefObject<AuthHandle | null>;
    localStorageStore.set(STORAGE_KEY, "stored-token");
    getCurrentUserMock.mockRejectedValue(new Error("Session expired"));

    renderAuthProvider(handle);

    await waitFor(() => {
      expect(handle.current?.user).toBeNull();
      expect(handle.current?.token).toBeNull();
    });
    expect(localStorageStore.has(STORAGE_KEY)).toBe(false);
  });

  it("logs out via the API and clears local state", async () => {
    const handle = { current: null } as MutableRefObject<AuthHandle | null>;
    localStorageStore.set(STORAGE_KEY, "stored-token");
    const user: MockUser = {
      id: "1",
      username: "alice",
      email: "alice@example.com",
      is_staff: false,
      display_name: "Alice",
      role: null,
      avatar_url: null,
    };
    getCurrentUserMock.mockResolvedValue(user);

    renderAuthProvider(handle);

    await waitFor(() => {
      expect(handle.current?.user).toEqual(user);
      expect(handle.current?.token).toBe("stored-token");
    });

    await act(async () => {
      await handle.current?.logout();
    });

    expect(logoutMock).toHaveBeenCalledWith("stored-token");
    expect(handle.current?.user).toBeNull();
    expect(handle.current?.token).toBeNull();
    expect(localStorageStore.has(STORAGE_KEY)).toBe(false);
  });
});
