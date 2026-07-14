"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeId = "classic" | "pepsi" | "dark";

export const THEMES: {
  id: ThemeId;
  label: string;
  description: string;
  swatches: string[];
}[] = [
  {
    id: "classic",
    label: "Classic",
    description: "Teal",
    swatches: ["#0F766E", "#F3F5F8", "#FFFFFF"],
  },
  {
    id: "pepsi",
    label: "Pepsi",
    description: "Blue & red",
    swatches: ["#004B93", "#FFFFFF", "#E32934"],
  },
  {
    id: "dark",
    label: "Dark",
    description: "Night",
    swatches: ["#0B1220", "#1A2332", "#14B8A6"],
  },
];

const STORAGE_KEY = "pepsi-theme";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("classic");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    const next =
      saved === "classic" || saved === "pepsi" || saved === "dark" ? saved : "classic";
    setThemeState(next);
    applyTheme(next);
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
