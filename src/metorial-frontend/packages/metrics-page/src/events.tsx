import {
  Chart,
  ChartColor,
  ChartSelection,
  ChartDomain,
  ChartSeries,
  getChartColor,
  resolveSeriesColors,
  TimelineBarClick
} from '@metorial/chart';
import { InfoTooltip, OptionToggle, Text, theme, Title } from '@metorial/ui';
import { RiArrowDownSLine } from '@remixicon/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import type { MetricChartCardSpan } from './grid';

export type EventsChartVariant = 'card' | 'strip';

let Card = styled.section<{ $span: MetricChartCardSpan; $variant: EventsChartVariant }>`
  grid-column: ${({ $span }) => ($span == 'full' ? '1 / -1' : 'auto')};
  display: flex;
  flex-direction: column;
  min-width: 0;

  ${({ $variant }) =>
    $variant == 'card'
      ? `
    border: 1px solid ${theme.colors.gray400};
    border-radius: 8px;
    background: ${theme.colors.gray100};
    box-shadow: ${theme.shadows.small};
  `
      : ''}
`;

let headerPadding = (variant: EventsChartVariant, collapsed: boolean) => {
  if (variant == 'strip') return collapsed ? '8px 12px' : '8px 12px 0 12px';
  return collapsed ? '10px 18px' : '10px 18px 0 18px';
};

let Header = styled.header<{ $collapsed: boolean; $variant: EventsChartVariant }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 16px;
  padding: ${({ $collapsed, $variant }) => headerPadding($variant, $collapsed)};
  margin-bottom: ${({ $collapsed, $variant }) =>
    $collapsed ? 0 : $variant == 'strip' ? 4 : 10}px;
`;

let HeaderStart = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
`;

let HeaderEnd = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px 16px;
  margin-left: auto;

  & > * {
    flex: none;
    width: auto;
  }
`;

let Totals = styled.ul`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
`;

let Total = styled.li`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

let Swatch = styled.span<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: ${({ $color }) => $color};
`;

let CollapseButton = styled.button<{ $collapsed: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: none;
  color: ${theme.colors.gray600};
  cursor: pointer;

  svg {
    width: 18px;
    height: 18px;
    transition: transform 0.15s ease;
    transform: rotate(${({ $collapsed }) => ($collapsed ? -90 : 0)}deg);
  }

  &:hover,
  &:focus-visible {
    background: ${theme.colors.gray300};
    color: ${theme.colors.foreground};
    outline: none;
  }
`;

let Content = styled.div<{ $variant: EventsChartVariant }>`
  flex: 1;

  ${({ $variant }) =>
    $variant == 'card'
      ? `
    margin: 0 -1px -1px -1px;
    padding: 12px 12px 4px 8px;
    border: 1px solid ${theme.colors.gray400};
    border-radius: 8px;
    background: ${theme.colors.background};
    overflow: hidden;
  `
      : `
    padding: 0 12px 0 4px;
  `}
`;

let numberFormat = new Intl.NumberFormat();

let collapseStorageKey = (key: string) => `metorial.events-chart.${key}.collapsed`;

let readCollapsed = (key: string | undefined, fallback: boolean) => {
  if (!key || typeof window == 'undefined') return fallback;

  try {
    let stored = window.localStorage.getItem(collapseStorageKey(key));
    return stored === null ? fallback : stored == '1';
  } catch {
    return fallback;
  }
};

let useCollapsed = (key: string | undefined, fallback: boolean) => {
  let [collapsed, setCollapsed] = useState(() => readCollapsed(key, fallback));

  useEffect(() => setCollapsed(readCollapsed(key, fallback)), [key]);

  let toggle = useCallback(() => {
    setCollapsed(current => {
      let next = !current;
      if (key) {
        try {
          window.localStorage.setItem(collapseStorageKey(key), next ? '1' : '0');
        } catch {}
      }
      return next;
    });
  }, [key]);

  return [collapsed, toggle] as const;
};

export let eventsSuccessColor: ChartColor = 'blue';
export let eventsErrorColor: ChartColor = 'red';

export type EventsChartBucket = {
  from: Date;
  to: Date;
};

export type EventsChartFilter = {
  value: string;
  items: { id: string; label: string }[];
  onChange: (value: string) => void;
};

export type EventsChartCardProps = {
  title: React.ReactNode;
  info?: React.ReactNode;
  series: ChartSeries[];
  domain?: ChartDomain;
  intervalMs?: number;
  height?: number;
  span?: MetricChartCardSpan;
  stacked?: boolean;
  loading?: boolean;
  error?: React.ReactNode;
  emptyText?: React.ReactNode;
  filter?: EventsChartFilter;
  actions?: React.ReactNode;
  collapseKey?: string;
  defaultCollapsed?: boolean;
  totalLabel?: string;
  clickHint?: string;
  variant?: EventsChartVariant;
  hint?: React.ReactNode;
  selection?: ChartSelection;
  onBucketClick?: (bucket: EventsChartBucket, seriesId?: string) => void;
};

export let EventsChartCard = ({
  title,
  info,
  series,
  domain,
  intervalMs,
  height = 220,
  span = 'full',
  stacked = true,
  loading,
  error,
  emptyText,
  filter,
  actions,
  collapseKey,
  defaultCollapsed = false,
  totalLabel,
  clickHint = 'Click to view',
  variant = 'card',
  hint,
  selection,
  onBucketClick
}: EventsChartCardProps) => {
  let [collapsed, toggleCollapsed] = useCollapsed(collapseKey, defaultCollapsed);

  let colors = useMemo(() => resolveSeriesColors(series), [series]);
  let totals = useMemo(
    () => series.map(item => item.entries.reduce((sum, entry) => sum + (entry.value ?? 0), 0)),
    [series]
  );

  let onBarClick = useMemo(() => {
    if (!onBucketClick) return undefined;

    return ({ seriesIndex, from, to }: TimelineBarClick) =>
      onBucketClick({ from, to }, seriesIndex === null ? undefined : series[seriesIndex]?.id);
  }, [onBucketClick, series]);

  return (
    <Card $span={span} $variant={variant}>
      <Header $collapsed={collapsed} $variant={variant}>
        <HeaderStart>
          {collapseKey ? (
            <CollapseButton
              type="button"
              $collapsed={collapsed}
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand chart' : 'Collapse chart'}
            >
              <RiArrowDownSLine />
            </CollapseButton>
          ) : null}

          <Title as="h2" size={variant == 'strip' ? '1' : '2'} weight="strong">
            {title}
          </Title>

          {info ? <InfoTooltip size={18}>{info}</InfoTooltip> : null}
        </HeaderStart>

        <HeaderEnd>
          {!error ? (
            <Totals>
              {series.map((item, i) => (
                <Total key={item.id}>
                  <Swatch $color={colors[i] ?? getChartColor('gray')} />
                  <Text as="span" size="1" weight="medium" color="gray700">
                    {loading ? '—' : numberFormat.format(totals[i] ?? 0)} {item.name}
                  </Text>
                </Total>
              ))}
            </Totals>
          ) : null}

          {hint ? (
            <Text as="span" size="1" color="gray600">
              {hint}
            </Text>
          ) : null}

          {filter && !collapsed ? (
            <OptionToggle
              ariaLabel="Filter"
              size="1"
              itemMinWidth={0}
              value={filter.value}
              onChange={filter.onChange}
              items={filter.items}
            />
          ) : null}

          {actions}
        </HeaderEnd>
      </Header>

      {collapsed ? null : (
        <Content $variant={variant}>
          <Chart
            type="bar"
            stacked={stacked}
            series={series}
            domain={domain}
            height={height}
            legend={false}
            loading={loading}
            error={error}
            emptyText={emptyText}
            intervalMs={intervalMs}
            tooltipTotalLabel={totalLabel}
            selection={selection}
            clickHint={clickHint}
            valueFormatter={value => numberFormat.format(value)}
            onBarClick={onBarClick}
          />
        </Content>
      )}
    </Card>
  );
};
