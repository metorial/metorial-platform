import { Text } from '@metorial/ui';
import React from 'react';
import { ChartColor, ChartSeriesStyle, resolveSeriesColors } from './colors';

export type ChartLegendItem = {
  id: string;
  name: React.ReactNode;
  style?: ChartSeriesStyle;
  color?: ChartColor;
};

let listStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '4px 14px',
  margin: 0,
  padding: 0,
  listStyle: 'none'
};

let itemStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6
};

let LegendSwatch = ({ color, dashed }: { color: string; dashed: boolean }) => (
  <svg width={16} height={8} viewBox="0 0 16 8" aria-hidden style={{ flexShrink: 0 }}>
    <line
      x1={1}
      y1={4}
      x2={15}
      y2={4}
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeDasharray={dashed ? '3 3' : undefined}
    />
  </svg>
);

export let ChartLegend = ({ items }: { items: ChartLegendItem[] }) => {
  let colors = resolveSeriesColors(items);

  return (
    <ul style={listStyle}>
      {items.map((item, i) => (
        <li key={item.id} style={itemStyle}>
          <LegendSwatch color={colors[i]} dashed={item.style == 'dashed'} />
          <Text as="span" size="1" weight="medium" color="gray700">
            {item.name}
          </Text>
        </li>
      ))}
    </ul>
  );
};
