// ===== THEME HOOK =====

import { useState, useCallback, useEffect } from 'react';
import { Theme, darkTheme, lightTheme } from '../types';

const THEME_STORAGE_KEY = 'cac_theme';

export const useTheme = () => {
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    // Check localStorage first
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored !== null) {
      return stored === 'dark';
    }
    // Default to dark theme
    return true;
  });
  
  const theme: Theme = isDarkTheme ? darkTheme : lightTheme;
  
  // Persist theme preference
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme]);
  
  const toggleTheme = useCallback(() => {
    setIsDarkTheme(prev => !prev);
  }, []);
  
  const setDarkTheme = useCallback(() => {
    setIsDarkTheme(true);
  }, []);
  
  const setLightTheme = useCallback(() => {
    setIsDarkTheme(false);
  }, []);
  
  return {
    theme,
    isDarkTheme,
    toggleTheme,
    setDarkTheme,
    setLightTheme
  };
};

export default useTheme;
