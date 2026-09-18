import { createContext, useContext } from "react";

export type DnsThemeMode = "light" | "dark";
export type DnsLocale = "en" | "zh";

export interface DnsPreferences {
  themeMode: DnsThemeMode;
  toggleTheme: () => void;
  locale: DnsLocale;
  setLocale: (locale: DnsLocale) => void;
  showThemeSwitch: boolean;
  showI18nSwitch: boolean;
}

export const DnsPreferencesContext = createContext<DnsPreferences>({
  themeMode: "light",
  toggleTheme: () => {},
  locale: "en",
  setLocale: () => {},
  showThemeSwitch: false,
  showI18nSwitch: false,
});

export function useDnsPreferences() {
  return useContext(DnsPreferencesContext);
}
