import { colorThemeVars } from './colors';
import { createTheme, createThemeToken } from './tokens';

export let theme = createTheme({
  colors: {
    foreground: createThemeToken('#111111'),
    background: createThemeToken('#ffffff'),

    ...colorThemeVars
  },

  shadows: {
    small: createThemeToken('0 1px 4px rgba(0, 0, 0, 0.08)'),
    medium: createThemeToken('0 4px 8px rgba(0, 0, 0, 0.1)'),
    large: createThemeToken('0 8px 16px rgba(0, 0, 0, 0.1)')
  }
});

export type { ColorKey, ColorType } from './colors';
