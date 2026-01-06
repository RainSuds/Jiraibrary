"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type FlashKind = "success" | "warning" | "error";

type FlashItem = {
  id: string;
  kind: FlashKind;
  title?: string;
  message: string;
  timeoutMs: number;
};

type AddFlashPayload = {
  kind: FlashKind;
  title?: string;
  message: string;
  timeoutMs?: number;
};

type FlashContextValue = {
  addFlash: (payload: AddFlashPayload) => void;
};

const FlashContext = createContext<FlashContextValue | undefined>(undefined);

function createFlashId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function FlashToast({ toast, onDismiss }: { toast: FlashItem; onDismiss: (id: string) => void }) {
  const borderClass =
    toast.kind === "error" ? "border-rose-200" : toast.kind === "warning" ? "border-rose-200" : "border-rose-100";
  const titleClass = toast.kind === "error" ? "text-rose-700" : toast.kind === "warning" ? "text-rose-700" : "text-rose-900";
  const label = toast.kind === "error" ? "Error" : toast.kind === "warning" ? "Warning" : "Saved";

  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className={`pointer-events-auto w-full max-w-sm rounded-3xl border ${borderClass} bg-white/95 p-4 shadow-lg backdrop-blur`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className={`text-sm font-semibold ${titleClass}`}>{toast.title ?? label}</p>
          <p className="mt-1 text-sm text-slate-700">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
          aria-label="Dismiss notification"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function FlashProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<FlashItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismissFlash = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addFlash = useCallback(
    (payload: AddFlashPayload) => {
      const id = createFlashId();
      const toast: FlashItem = {
        id,
        kind: payload.kind,
        title: payload.title,
        message: payload.message,
        timeoutMs: payload.timeoutMs ?? (payload.kind === "success" ? 2000 : 5000),
      };

      setToasts((prev) => [toast, ...prev].slice(0, 4));

      if (typeof window !== "undefined") {
        const handle = window.setTimeout(() => dismissFlash(id), toast.timeoutMs);
        timers.current.set(id, handle);
      }
    },
    [dismissFlash],
  );

  const value = useMemo<FlashContextValue>(() => ({ addFlash }), [addFlash]);

  return (
    <FlashContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-6 top-6 z-50 flex w-[calc(100%-3rem)] max-w-sm flex-col gap-3"
        aria-live="polite"
        aria-relevant="additions removals"
      >
        {toasts.map((toast) => (
          <FlashToast key={toast.id} toast={toast} onDismiss={dismissFlash} />
        ))}
      </div>
    </FlashContext.Provider>
  );
}

export function useFlash() {
  const ctx = useContext(FlashContext);
  return (
    ctx ?? {
      addFlash: () => {
        // no-op when provider is not mounted (e.g., isolated tests)
      },
    }
  );
}
