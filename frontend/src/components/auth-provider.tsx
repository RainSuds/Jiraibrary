"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  ApiError,
  AuthResponse,
  UserProfile,
  getCurrentUser,
  login as apiLogin,
  loginWithGoogle as apiLoginWithGoogle,
  logout as apiLogout,
  register as apiRegister,
  RegisterPayload,
  UpdateUserPreferencesPayload,
  updateUserPreferences,
} from "@/lib/api";

type AuthContextValue = {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<AuthResponse>;
  loginWithGoogle: (idToken: string) => Promise<AuthResponse>;
  register: (payload: RegisterPayload) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updatePreferences: (payload: UpdateUserPreferencesPayload) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "jiraibrary.auth.token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async (authToken: string) => {
    try {
      setLoading(true);
      const profile = await getCurrentUser(authToken);
      setToken(authToken);
      setUser(profile);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, authToken);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        console.info("Stored session token expired; clearing it.");
      } else {
        console.error("Failed to hydrate user", error);
      }
      setToken(null);
      setUser(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
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
      setToken(auth.token);
      setUser(auth.user);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, auth.token);
      }
      return auth;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    setLoading(true);
    try {
      const auth = await apiLoginWithGoogle(idToken);
      setToken(auth.token);
      setUser(auth.user);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, auth.token);
      }
      return auth;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setLoading(true);
    try {
      const auth = await apiRegister(payload);
      setToken(auth.token);
      setUser(auth.user);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, auth.token);
      }
      return auth;
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
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      setToken(null);
      setUser(null);
    }
  };

  const refresh = async () => {
    if (!token) {
      return;
    }
    await hydrate(token);
  };

  const updatePreferences = useCallback(
    async (payload: UpdateUserPreferencesPayload) => {
      if (!token) {
        return;
      }
      try {
        const updated = await updateUserPreferences(token, payload);
        setUser(updated);
      } catch (error) {
        console.error("Failed to update user preferences", error);
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
    register,
    logout,
    refresh,
    updatePreferences,
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
