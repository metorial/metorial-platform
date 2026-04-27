import { Chart } from '@metorial/chart';
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentOrganization, useInstances } from '@metorial/state';
import { CenteredSpinner, DatePicker, Select } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useUsageState } from './state';

let LoadingChartWrapper = styled.div`
  position: relative;
  min-height: 300px;
`;

let LoadingChartBackdrop = styled.div`
  filter: grayscale(1) blur(3px);
  opacity: 0.45;
  pointer-events: none;
`;

let LoadingChartOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

let ChartFadeLayer = styled.div<{ $visible: boolean }>`
  position: absolute;
  inset: 0;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transition: opacity 240ms ease;
  pointer-events: none;
`;

let ChartContent = styled.div<{ $visible: boolean }>`
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transition: opacity 240ms ease;
`;

let getPlaceholderUsageSeries = (from: Date, to: Date) => {
  let fromTs = from.getTime();
  let toTs = to.getTime();
  let step = Math.max((toTs - fromTs) / 11, 1);

  return [
    {
      id: 'placeholder-usage',
      name: 'Usage',
      entries: Array.from({ length: 12 }, (_, i) => ({
        key: new Date(fromTs + step * i),
        value: [12, 18, 15, 28, 24, 35, 31, 42, 38, 47, 43, 54][i]
      }))
    }
  ];
};

let UsageChartLoading = ({ from, to }: { from: Date; to: Date }) => (
  <LoadingChartWrapper>
    <LoadingChartBackdrop>
      <Chart height={300} type="line" series={getPlaceholderUsageSeries(from, to)} />
    </LoadingChartBackdrop>

    <LoadingChartOverlay>
      <CenteredSpinner />
    </LoadingChartOverlay>
  </LoadingChartWrapper>
);

type UsageTimeline = {
  entityId: string;
  entityType: string;
  ownerId: string;
  entries: {
    ts: Date;
    count: number;
  }[];
};

let UsageChart = ({
  data,
  isLoading,
  from,
  to,
  getSeriesName
}: {
  data: UsageTimeline[] | null | undefined;
  isLoading?: boolean;
  from: Date;
  to: Date;
  getSeriesName: (timeline: UsageTimeline) => string;
}) => {
  let [showPreview, setShowPreview] = useState(() => !data);
  let [showChart, setShowChart] = useState(() => !!data);
  let [hasShownData, setHasShownData] = useState(() => !!data);

  useEffect(() => {
    if (!data) {
      setShowPreview(true);
      setShowChart(false);
      setHasShownData(false);
      return;
    }

    if (hasShownData) {
      setShowChart(true);
      setShowPreview(false);
      return;
    }

    setShowPreview(true);
    setShowChart(false);

    let animationFrame = window.requestAnimationFrame(() => {
      setShowChart(true);
      setShowPreview(false);
    });
    let timeout = window.setTimeout(() => {
      setHasShownData(true);
    }, 240);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
    };
  }, [data, hasShownData]);

  if (!data) return <UsageChartLoading from={from} to={to} />;

  return (
    <LoadingChartWrapper>
      <ChartContent $visible={showChart}>
        <Chart
          height={300}
          type="line"
          series={data.map(tl => ({
            id: `${tl.ownerId}:${tl.entityType}:${tl.entityId}`,
            name: getSeriesName(tl),
            entries: tl.entries.map(e => ({ key: e.ts, value: e.count }))
          }))}
        />
      </ChartContent>

      <ChartFadeLayer $visible={showPreview}>
        <LoadingChartBackdrop>
          <Chart height={300} type="line" series={getPlaceholderUsageSeries(from, to)} />
        </LoadingChartBackdrop>
      </ChartFadeLayer>

      {isLoading ? (
        <LoadingChartOverlay>
          <CenteredSpinner />
        </LoadingChartOverlay>
      ) : null}
    </LoadingChartWrapper>
  );
};

export let UsageScene = ({
  title,
  description,
  entities,
  from,
  interval,
  entityNames,
  labelBy = 'entity'
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  entities: {
    type: string;
    id?: string;
  }[];
  from?: number;
  interval?: {
    unit: 'day' | 'hour';
    count: number;
  };
  entityNames: Record<string, string>;
  labelBy?: 'entity' | 'owner';
}) => {
  let isUsageIntervalUnit = (value: string): value is 'day' | 'hour' => {
    return value === 'day' || value === 'hour';
  };

  let formatEntityTypeName = (entityType: string) =>
    entityType
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  let organization = useCurrentOrganization();
  let instances = useInstances(labelBy === 'owner' ? organization.data?.id : null);

  let ownerNames = new Map<string, string>();
  if (organization.data) {
    ownerNames.set(organization.data.id, organization.data.name);
  }

  let instanceItems = instances.data ?? [];
  let nameCounts = new Map<string, number>();
  for (let i of instanceItems) {
    nameCounts.set(i.name, (nameCounts.get(i.name) ?? 0) + 1);
  }
  for (let i of instanceItems) {
    let needsDisambiguation = (nameCounts.get(i.name) ?? 0) > 1;
    let label =
      needsDisambiguation && i.project?.name ? `${i.project.name} / ${i.name}` : i.name;
    ownerNames.set(i.id, label);
  }

  let getSeriesName = (timeline: {
    entityId: string;
    entityType: string;
    ownerId: string;
  }) => {
    if (labelBy === 'owner') {
      return ownerNames.get(timeline.ownerId) ?? timeline.ownerId;
    }

    return (
      entityNames[timeline.entityId] ??
      entityNames[`type:${timeline.entityType}`] ??
      entityNames[timeline.entityType] ??
      (timeline.entityId === 'all'
        ? `All ${formatEntityTypeName(timeline.entityType)}`
        : timeline.entityId)
    );
  };

  let [usage, range] = useUsageState({
    entities,
    from,
    interval
  });

  return (
    <Box
      title={title}
      description={description}
      rightActions={
        <>
          <DatePicker
            label="Date Range"
            hideLabel
            type="range"
            value={[range.from, range.to]}
            onChange={([from, to]) => {
              range.setFrom(from);
              range.setTo(to);
            }}
          />

          <Select
            label="Interval"
            hideLabel
            items={[
              { id: '1-day', label: '1 Day' },
              { id: '1-hour', label: '1 Hour' },
              { id: '6-hour', label: '6 Hours' },
              { id: '12-hour', label: '12 Hours' }
            ]}
            value={`${range.interval.count}-${range.interval.unit}`}
            onChange={value => {
              let [count, unit] = value.split('-');
              if (!isUsageIntervalUnit(unit)) return;
              range.setInterval({ count: Number(count), unit });
            }}
          />
        </>
      }
    >
      {Array.isArray(entities) && !entities.length ? (
        <>
          <p>
            There has been any usage yet. Once you start using Metorial, you'll see usage data
            here.
          </p>
        </>
      ) : usage.data || usage.isLoading ? (
        <UsageChart
          data={usage.data}
          isLoading={usage.isLoading}
          from={range.from}
          to={range.to}
          getSeriesName={getSeriesName}
        />
      ) : (
        renderWithLoader(
          { usage },
          {
            loading: () => <UsageChartLoading from={range.from} to={range.to} />
          }
        )(({ usage }) => (
          <UsageChart
            data={usage.data}
            from={range.from}
            to={range.to}
            getSeriesName={getSeriesName}
          />
        ))
      )}
    </Box>
  );
};
