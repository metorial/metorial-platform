import type { ITheme } from '@xterm/xterm';

export let TERMINAL_FONT_NAME = 'JetBrains Mono';

export let TERMINAL_FONT_FAMILY = `'${TERMINAL_FONT_NAME}', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;

export let TERMINAL_FONT_STYLESHEET = 'https://fonts.metorial.com/jetbrains-mono.css';

export let TERMINAL_FONT_SIZES = [11, 12, 13, 14, 16, 18];

export let DEFAULT_TERMINAL_FONT_SIZE = 13;

export let terminalSurface = {
  background: '#1a1a1a',
  surface: '#222',
  border: '#2a2a2a',
  control: '#333',
  controlActive: '#444',
  foreground: '#d4d4d4',
  muted: '#aaa',
  dim: '#666'
};

export let terminalTheme: ITheme = {
  background: terminalSurface.background,
  foreground: terminalSurface.foreground,
  cursor: terminalSurface.foreground,
  cursorAccent: terminalSurface.background,
  selectionBackground: '#ffcc00',
  selectionForeground: '#000000',
  selectionInactiveBackground: '#7a6a2a',

  scrollbarSliderBackground: 'rgba(255, 255, 255, 0.12)',
  scrollbarSliderHoverBackground: 'rgba(255, 255, 255, 0.2)',
  scrollbarSliderActiveBackground: 'rgba(255, 255, 255, 0.28)',

  black: '#333333',
  red: '#f87171',
  green: '#56ba9f',
  yellow: '#fbbf24',
  blue: '#5eb1ef',
  magenta: '#e093b2',
  cyan: '#3db9cf',
  white: '#d4d4d4',

  brightBlack: '#666666',
  brightRed: '#fca5a5',
  brightGreen: '#8bceb6',
  brightYellow: '#fcd34d',
  brightBlue: '#8ec8f6',
  brightMagenta: '#eaacc3',
  brightCyan: '#7dcedc',
  brightWhite: '#fafafa'
};
