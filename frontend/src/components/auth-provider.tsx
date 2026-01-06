"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  ApiError,
  AuthResponse,
  UserProfile,
  deleteAccount as apiDeleteAccount,
  getCurrentUser,
  login as apiLogin,
  loginWithGoogle as apiLoginWithGoogle,
  logout as apiLogout,
  register as apiRegister,
  RegisterPayload,
  UpdateUserProfilePayload,
  UpdateUserPreferencesPayload,
  updateUserProfile,
  updateUserPreferences,
} from "@/lib/api";

type AuthContextValue = {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<AuthResponse>;
  loginWithGoogle: (idToken: string) => Promise<AuthResponse>;
  applyAuth: (auth: AuthResponse) => void;
  register: (payload: RegisterPayload) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<void>;
  updatePreferences: (payload: UpdateUserPreferencesPayload) => Promise<void>;
  updateProfile: (payload: UpdateUserProfilePayload) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "jiraibrary.auth.token";
const AUTH_COOKIE_NAME = "jiraibrary_auth_token";
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const SYNC_SESSION_ENDPOINT = "/api/auth/session";

const syncServerCookie = async (value: string | null) => {
  if (typeof window === "undefined") {
    return;
  }
  let endpoint = SYNC_SESSION_ENDPOINT;
  try {
    endpoint = new URL(SYNC_SESSION_ENDPOINT, window.location.origin).toString();
  } catch {
    // fall back to the relative endpoint
  }
  try {
    if (value) {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value }),
      });
    } else {
      await fetch(endpoint, { method: "DELETE" });
    }
  } catch (error) {
    console.warn("Failed to sync auth cookie", error);
  }
};

const persistAuthToken = (value: string | null) => {
  if (typeof window !== "undefined") {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
  if (typeof document !== "undefined") {
    if (value) {
      document.cookie = `${AUTH_COOKIE_NAME}=${value}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; sameSite=Lax`;
    } else {
      document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; sameSite=Lax`;
    }
  }
};

const readStoredToken = (): string | null => {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return stored;
    }
  }
  if (typeof document !== "undefined") {
    const match = document.cookie
      .split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`));
    if (match) {
      const [, token] = match.split("=");
      return token || null;
    }
  }
  return null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const applyAuth = useCallback((auth: AuthResponse) => {
    const normalized = auth.user;
    setToken(auth.token);
    setUser(normalized);
    persistAuthToken(auth.token);
  }, []);

  const hydrate = useCallback(async (authToken: string) => {
    try {
      setLoading(true);
      const profile = await getCurrentUser(authToken);
      setToken(authToken);
      setUser(profile);
      persistAuthToken(authToken);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        console.info("Stored session token expired; clearing it.");
      } else {
        console.error("Failed to hydrate user", error);
      }
      setToken(null);
      setUser(null);
      persistAuthToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = readStoredToken();
    if (!stored) {
      setLoading(false);
      return;
    }
    setToken(stored);
    void hydrate(stored);
  }, [hydrate]);

  const login = async (identifier: string, password: string) => {
    setLoading(true);
    try {
      const auth = await apiLogin(identifier, password);
      applyAuth(auth);
      return { ...auth, user: auth.user };
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    setLoading(true);
    try {
      const auth = await apiLoginWithGoogle(idToken);
      applyAuth(auth);
      return { ...auth, user: auth.user };
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setLoading(true);
    try {
      const auth = await apiRegister(payload);
      applyAuth(auth);
      return { ...auth, user: auth.user };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (!token) {
      setUser(null);
      return;
    }
    try {
      await apiLogout(token);
    } catch (error) {
      console.warn("Logout request failed", error);
    } finally {
      persistAuthToken(null);
      setToken(null);
      setUser(null);
    }
  };

  const deleteAccount = async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      await apiDeleteAccount(token);
    } catch (error) {
      console.warn("Delete account request failed", error);
      throw error;
    } finally {
      persistAuthToken(null);
      setToken(null);
      setUser(null);
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (!token) {
      return;
    }
    await hydrate(token);
  };

  useEffect(() => {
    persistAuthToken(token);
    void syncServerCookie(token);
  }, [token]);

  const updatePreferences = useCallback(
    async (payload: UpdateUserPreferencesPayload) => {
      if (!token) {
        return;
      }
      try {
        const updated = await updateUserPreferences(token, payload);
        setUser(updated);
      } catch (error) {
        if (!(error instanceof ApiError)) {
          console.error("Failed to update user preferences", error);
        }
        throw error;
      }
    },
    [token],
  );

  const updateProfile = useCallback(
    async (payload: UpdateUserProfilePayload) => {
      if (!token) {
        return;
      }
      try {
        const updated = await updateUserProfile(token, payload);
        setUser(updated);
      } catch (error) {
        if (!(error instanceof ApiError)) {
          console.error("Failed to update user profile", error);
        }
        throw error;
      }
    },
    [token],
  );

  const value: AuthContextValue = {
    user,
    token,
    loading,
    login,
    loginWithGoogle,
    applyAuth,
    register,
    logout,
    deleteAccount,
    refresh,
    updatePreferences,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
