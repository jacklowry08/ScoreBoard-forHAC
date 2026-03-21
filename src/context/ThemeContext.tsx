import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark';
type ColorScheme = 'classic' | 'magenta' | 'yellow' | 'green' | 'purple' | 'slate' | 'forest' | 'orange' | 'rose' | 'custom';
type PresetColorScheme = Exclude<ColorScheme, 'custom'>;

interface Theme {
  background: string;
  cardBackground: string;
  text: string;
  textSecondary: string;
  primary: string;
  border: string;
  headerBackground: string;
  headerText: string;
}

const colorPalettes: Record<PresetColorScheme, string> = {
  classic: '#4A90E2',
  magenta: '#E91E63',
  yellow: '#FFC107',
  green: '#4CAF50',
  purple: '#9C27B0',
  slate:  '#5B7FA6',
  forest: '#4A7C59',
  orange: '#D4722A',
  rose:   '#C4788A',
};

const createTheme = (isDark: boolean, oledMode: boolean, color: string): Theme => {
  if (isDark) {
    return {
      background:      oledMode ? '#000000' : '#121212',
      cardBackground:  oledMode ? '#111111' : '#1E1E1E',
      text:            '#E0E0E0',
      textSecondary:   '#B0B0B0',
      primary:         color,
      border:          oledMode ? '#222222' : '#333333',
      headerBackground: color,
      headerText:      '#fff',
    };
  } else {
    return {
      background:      '#f5f5f5',
      cardBackground:  '#fff',
      text:            '#333',
      textSecondary:   '#666',
      primary:         color,
      border:          '#e0e0e0',
      headerBackground: color,
      headerText:      '#fff',
    };
  }
};

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  syncToSystem: boolean;
  manualMode: ThemeMode;
  colorScheme: ColorScheme;
  customColor: string;
  oledMode: boolean;
  setManualMode: (mode: ThemeMode) => void;
  setSyncToSystem: (sync: boolean) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setCustomColor: (color: string) => Promise<void>;
  setOledMode: (oled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [syncToSystem, setSyncToSystemState] = useState(true);
  const [manualMode, setManualModeState] = useState<ThemeMode>('light');
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>('classic');
  const [customColor, setCustomColorState] = useState('#4A90E2');
  const [oledMode, setOledModeState] = useState(false);

  useEffect(() => {
    loadThemeSettings();
  }, []);

  const loadThemeSettings = async () => {
    try {
      const sync  = await AsyncStorage.getItem('theme_sync');
      const manual = await AsyncStorage.getItem('theme_manual');
      const color = await AsyncStorage.getItem('theme_color');
      const oled  = await AsyncStorage.getItem('theme_oled');

      const customColorStored = await AsyncStorage.getItem('theme_custom_color');
      if (sync  !== null) setSyncToSystemState(sync === 'true');
      if (manual !== null) setManualModeState(manual as ThemeMode);
      if (color !== null) setColorSchemeState(color as ColorScheme);
      if (customColorStored !== null) setCustomColorState(customColorStored);
      if (oled  !== null) setOledModeState(oled === 'true');
    } catch (error) {
      console.error('Error loading theme settings:', error);
    }
  };

  const setSyncToSystem = async (sync: boolean) => {
    setSyncToSystemState(sync);
    await AsyncStorage.setItem('theme_sync', sync.toString());
  };

  const setManualMode = async (mode: ThemeMode) => {
    setManualModeState(mode);
    await AsyncStorage.setItem('theme_manual', mode);
  };

  const setColorScheme = async (scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    await AsyncStorage.setItem('theme_color', scheme);
  };

  const setCustomColor = async (color: string) => {
    setCustomColorState(color);
    await AsyncStorage.setItem('theme_custom_color', color);
  };

  const setOledMode = async (oled: boolean) => {
    setOledModeState(oled);
    await AsyncStorage.setItem('theme_oled', oled.toString());
  };

  const isDark = syncToSystem
    ? systemColorScheme === 'dark'
    : manualMode === 'dark';

  const primaryColor = colorScheme === 'custom'
    ? customColor
    : colorPalettes[colorScheme as PresetColorScheme];
  const theme = createTheme(isDark, oledMode, primaryColor);

  return (
    <ThemeContext.Provider value={{
      theme,
      isDark,
      syncToSystem,
      manualMode,
      colorScheme,
      customColor,
      oledMode,
      setManualMode,
      setSyncToSystem,
      setColorScheme,
      setCustomColor,
      setOledMode,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
