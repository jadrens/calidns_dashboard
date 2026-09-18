"use client";

import { createTheme, ThemeProvider, type Theme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Dashboard from "./pages/dashboard";
import Zones from "./pages/zones";
import Queries from "./pages/queries";
import Edns from "./pages/edns";
import Geocache from "./pages/geocache";
import DnsManagerLayout from "./pages/layout";
import { DnsLocationContext, canonicalDnsPath } from "./paths";
import { ToastProvider } from "./toast";
import { DnsPreferencesContext, type DnsLocale, type DnsThemeMode } from "./preferences";
import { DnsI18nContext, dnsDictionaries } from "./i18n";

const originalBase = "/mtools/dns-manager";

export interface DnsManagerAppProps {
  /** Browser path used by the Next.js host. Omit for standalone Vite. */
  path?: string;
  /** URL prefix for DNS Manager links. Defaults to the Vite site root. */
  basePath?: string;
  /** Display the DNS Manager's own theme button, normally true only for standalone use. */
  enable_theme_switch_button?: boolean;
  /** Display the DNS Manager's own language button, normally true only for standalone use. */
  enable_i18n_switch_button?: boolean;
  /** Theme supplied by an embedding application. Mode changes are reported through onChange. */
  theme_data?: { mode: DnsThemeMode; theme?: Theme; onChange?: (mode: DnsThemeMode) => void };
  /** Locale supplied by an embedding application. */
  i18n_data?: { locale: DnsLocale };
}

export default function DnsManagerApp({
  path,
  basePath = "/",
  enable_theme_switch_button = false,
  enable_i18n_switch_button = false,
  theme_data,
  i18n_data,
}: DnsManagerAppProps) {
  const [standaloneTheme, setStandaloneTheme] = useState<DnsThemeMode>("light");
  const [standaloneLocale, setStandaloneLocale] = useState<DnsLocale>("en");

  useEffect(() => {
    if (!theme_data) {
      const saved = localStorage.getItem("dns-manager-theme");
      setStandaloneTheme(saved === "light" || saved === "dark"
        ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
    if (!i18n_data) {
      const saved = localStorage.getItem("dns-manager-locale");
      setStandaloneLocale(saved === "en" || saved === "zh"
        ? saved : navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en");
    }
  }, [theme_data, i18n_data]);

  const themeMode = theme_data?.mode ?? standaloneTheme;
  const locale = i18n_data?.locale ?? standaloneLocale;
  const toggleTheme = () => {
    const next = themeMode === "dark" ? "light" : "dark";
    if (theme_data?.onChange) theme_data.onChange(next);
    else {
      setStandaloneTheme(next);
      localStorage.setItem("dns-manager-theme", next);
    }
  };
  const setLocale = (next: DnsLocale) => {
    setStandaloneLocale(next);
    localStorage.setItem("dns-manager-locale", next);
  };

  useEffect(() => {
    if (!i18n_data) document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [i18n_data, locale]);

  const pathname = path
    ? originalBase + (path === "/" ? "" : path.replace(/\/$/, ""))
    : canonicalDnsPath(window.location.pathname, basePath);
  const internalTheme = useMemo(() => createTheme({
    palette: {
      mode: themeMode,
      primary: { main: themeMode === "dark" ? "#9db4d4" : "#89a0d2" },
      secondary: { main: "#c9a87c" },
      background: themeMode === "dark"
        ? { default: "#1e1e1e", paper: "#2a2a2a" }
        : { default: "#f8f6f3", paper: "#fdfcfb" },
      text: themeMode === "dark"
        ? { primary: "#e8e4df", secondary: "#d3d3d3" }
        : { primary: "#3d3d3d", secondary: "#474747" },
    },
    typography: { fontFamily: "'Nunito', var(--font-inter), system-ui, sans-serif" },
  }), [themeMode]);
  const theme = theme_data?.theme ?? internalTheme;

  let content: ReactNode;
  switch (pathname.slice(originalBase.length)) {
    case "": content = <Dashboard />; break;
    case "/zones": content = <Zones />; break;
    case "/queries": content = <Queries />; break;
    case "/edns": content = <Edns />; break;
    case "/geocache": content = <Geocache />; break;
    default: content = <Dashboard />;
  }

  return <DnsLocationContext.Provider value={{ basePath, pathname }}>
    <DnsPreferencesContext.Provider value={{
      themeMode, toggleTheme, locale, setLocale,
      showThemeSwitch: enable_theme_switch_button,
      showI18nSwitch: enable_i18n_switch_button,
    }}>
      <DnsI18nContext.Provider value={dnsDictionaries[locale]}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <ToastProvider />
          <DnsManagerLayout>{content}</DnsManagerLayout>
        </ThemeProvider>
      </DnsI18nContext.Provider>
    </DnsPreferencesContext.Provider>
  </DnsLocationContext.Provider>;
}
