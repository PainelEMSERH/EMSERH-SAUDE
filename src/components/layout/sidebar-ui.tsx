"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "emserh-sidebar-collapsed";

type SidebarUiContextValue = {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggle: () => void;
};

const SidebarUiContext = createContext<SidebarUiContextValue | null>(null);

export function SidebarUiProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "1") setCollapsedState(true);
    } catch {
      /* ignore */
    }
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <SidebarUiContext.Provider value={{ collapsed, setCollapsed, toggle }}>
      {children}
    </SidebarUiContext.Provider>
  );
}

export function useSidebarUi() {
  const ctx = useContext(SidebarUiContext);
  if (!ctx) {
    throw new Error("useSidebarUi must be used within SidebarUiProvider");
  }
  return ctx;
}
