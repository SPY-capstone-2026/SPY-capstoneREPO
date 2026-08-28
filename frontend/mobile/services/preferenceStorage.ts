import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORAGE_KEY = 'moni.app.preferences.v1';

export type AppPreferences = {
  pushEnabled: boolean;
  challengeReminderEnabled: boolean;
  budgetAlertEnabled: boolean;
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  pushEnabled: true,
  challengeReminderEnabled: true,
  budgetAlertEnabled: true,
};

function mergePreferences(value: Partial<AppPreferences> | null | undefined) {
  return {
    ...DEFAULT_APP_PREFERENCES,
    ...(value ?? {}),
  };
}

export async function getAppPreferences(): Promise<AppPreferences> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return DEFAULT_APP_PREFERENCES;
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_APP_PREFERENCES;
      return mergePreferences(JSON.parse(raw) as Partial<AppPreferences>);
    }

    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_PREFERENCES;
    return mergePreferences(JSON.parse(raw) as Partial<AppPreferences>);
  } catch {
    return DEFAULT_APP_PREFERENCES;
  }
}

export async function saveAppPreferences(
  next: AppPreferences
): Promise<AppPreferences> {
  const normalized = mergePreferences(next);

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  }

  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
