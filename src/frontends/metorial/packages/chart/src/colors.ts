import { theme } from '@metorial/ui';

export type ChartColor =
  | 'blue'
  | 'purple'
  | 'orange'
  | 'cyan'
  | 'indigo'
  | 'violet'
  | 'iris'
  | 'green'
  | 'red'
  | 'pink'
  | 'yellow'
  | 'gray';

export type ChartSeriesStyle = 'line' | 'area' | 'dashed';

export let chartPalette: ChartColor[] = [
  'blue',
  'purple',
  'orange',
  'cyan',
  'indigo',
  'violet',
  'iris'
];

let chartColorValues: Record<ChartColor, string> = {
  blue: theme.colors.blue800,
  purple: theme.colors.purple800,
  orange: theme.colors.orange800,
  cyan: theme.colors.cyan800,
  indigo: theme.colors.indigo800,
  violet: theme.colors.violet800,
  iris: theme.colors.iris800,
  green: theme.colors.green800,
  red: theme.colors.red800,
  pink: theme.colors.pink800,
  yellow: theme.colors.yellow800,
  gray: theme.colors.gray600
};

// Theme tokens are String objects; apexcharts deep-merges option objects and turns them into "[object Object]".
export let getChartColor = (color: ChartColor) => String(chartColorValues[color]);

export let resolveSeriesColors = (
  series: { style?: ChartSeriesStyle; color?: ChartColor }[]
) => {
  let paletteIndex = 0;

  return series.map(item => {
    if (item.color) return getChartColor(item.color);
    if (item.style == 'dashed') return getChartColor('gray');

    let color = chartPalette[paletteIndex % chartPalette.length];
    paletteIndex += 1;

    return getChartColor(color);
  });
};
