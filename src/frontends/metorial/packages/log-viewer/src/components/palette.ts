export let logPalette = {
  background: '#1a1a1a',
  surface: '#222',
  border: '#2a2a2a',
  control: '#333',
  controlActive: '#444',

  text: '#d4d4d4',
  muted: '#aaa',
  system: '#888',
  dim: '#666',

  red: '#f87171',
  yellow: '#fbbf24',
  green: '#4ade80',
  blue: '#60a5fa',
  lightBlue: '#93c5fd',
  magenta: '#e879f9',
  cyan: '#22d3ee',
  selection: '#ffcc00'
};

// ansi-to-react paints anser's VGA palette as inline styles tuned for light backgrounds,
// so its darker base colors are remapped to stay readable on the log background.
export let ansiColorOverrides: [rgb: string, color: string][] = [
  ['0, 0, 0', logPalette.dim],
  ['187, 0, 0', logPalette.red],
  ['0, 187, 0', logPalette.green],
  ['187, 187, 0', logPalette.yellow],
  ['0, 0, 187', logPalette.blue],
  ['187, 0, 187', logPalette.magenta],
  ['0, 187, 187', logPalette.cyan],
  ['85, 85, 85', logPalette.system],
  ['85, 85, 255', logPalette.lightBlue]
];

export let monoFontFamily =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

export let ROW_HEIGHT = 20;
export let PADDING_Y = 6;

export let GUTTER_PADDING_PX = 22;
export let TIMESTAMP_COLUMNS = 8;
export let TIMESTAMP_PADDING_PX = 12;
export let TEXT_PADDING_PX = 14;
