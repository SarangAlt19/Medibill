import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@app_theme';

export type Theme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  primary: string;
  primaryLight: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderLight: string;
  success: string;
  error: string;
  warning: string;
  inputBackground: string;
  headerBackground: string;
  headerText: string;
  cardBackground: string;
}

const lightTheme: ThemeColors = {
  background: '#f9fafb',
  surface: '#ffffff',
  surfaceSecondary: '#f3f4f6',
  primary: '#2563eb',
  primaryLight: '#eff6ff',
  text: '#111827',
  textSecondary: '#374151',
  textTertiary: '#6b7280',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  success: '#16a34a',
  error: '#ef4444',
  warning: '#fbbf24',
  inputBackground: '#f9fafb',
  headerBackground: '#2563eb',
  headerText: '#ffffff',
  cardBackground: '#ffffff',
};

const darkTheme: ThemeColors = {
  background: '#111827',
  surface: '#1f2937',
  surfaceSecondary: '#374151',
  primary: '#3b82f6',
  primaryLight: '#1e3a8a',
  text: '#f9fafb',
  textSecondary: '#e5e7eb',
  textTertiary: '#9ca3af',
  border: '#374151',
  borderLight: '#4b5563',
  success: '#22c55e',
  error: '#f87171',
  warning: '#fbbf24',
  inputBackground: '#1f2937',
  headerBackground: '#1f2937',
  headerText: '#f9fafb',
  cardBackground: '#1f2937',
};

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');
  const [colors, setColors] = useState<ThemeColors>(lightTheme);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_KEY);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setTheme(savedTheme);
        setColors(savedTheme === 'dark' ? darkTheme : lightTheme);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    try {
      await AsyncStorage.setItem(THEME_KEY, newTheme);
      setTheme(newTheme);
      setColors(newTheme === 'dark' ? darkTheme : lightTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const setThemeMode = async (newTheme: Theme) => {
    try {
      await AsyncStorage.setItem(THEME_KEY, newTheme);
      setTheme(newTheme);
      setColors(newTheme === 'dark' ? darkTheme : lightTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  return { theme, colors, toggleTheme, setThemeMode };
}
