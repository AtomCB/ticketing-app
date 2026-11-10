import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** A theme that can actually be on screen. */
export type Theme = 'light' | 'dark';
export type ThemePreference = 'system' | Theme;

interface ThemeState {
  preference: ThemePreference;
  toggleTheme: () => void;
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function systemTheme(): Theme {
  return darkQuery.matches ? 'dark' : 'light';
}

function resolve(preference: ThemePreference): Theme {
  return preference === 'system' ? systemTheme() : preference;
}

/**
 * The saved preference. `persist` writes { state: { preference }, version } to
 * localStorage under 'usher-theme', the same key and shape the inline script in
 * index.html reads to set the theme before first paint. Change one, change both.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preference: 'system',
      toggleTheme: () => set({ preference: resolve(get().preference) === 'dark' ? 'light' : 'dark' }),
    }),
    {
      name: 'usher-theme',
      // Save only the data. Functions can't be serialized.
      partialize: (state) => ({ preference: state.preference }),
    },
  ),
);

/*
 * Keep <html data-theme> in sync. This runs outside React on purpose: it works no matter
 * which components are mounted (error pages included), and it updates in the same tick
 * as the store, with no wait for a render. It re-runs when the preference changes, and
 * when the OS setting changes (that only has an effect while the preference is 'system').
 */
function applyTheme() {
  document.documentElement.dataset.theme = resolve(useThemeStore.getState().preference);
}
applyTheme();
useThemeStore.subscribe(applyTheme);
darkQuery.addEventListener('change', applyTheme);

function subscribeToSystemTheme(onChange: () => void) {
  darkQuery.addEventListener('change', onChange);
  return () => darkQuery.removeEventListener('change', onChange);
}

/**
 * The theme on screen right now. Re-renders when the preference changes, and when the
 * OS setting changes while the preference is 'system'.
 */
export function useResolvedTheme(): Theme {
  const preference = useThemeStore((state) => state.preference);
  const system = useSyncExternalStore(subscribeToSystemTheme, systemTheme);
  return preference === 'system' ? system : preference;
}
