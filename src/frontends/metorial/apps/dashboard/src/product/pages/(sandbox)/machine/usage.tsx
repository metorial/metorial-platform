import { formatBytes, formatDuration, formatNumber } from '@metorial/chart';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  applyMetricsQuery,
  defaultMetricsIntervals,
  MetricChartCard,
  MetricsGrid,
  MetricsSummary,
  MetricsToolbar,
  MetricsUnavailable,
  parseMetricsQuery,
  resolveMetricsRange,
  useMetricsTimeRange
} from '@metorial/metrics-page';
import {
  useCurrentInstance,
  useSandboxMachine,
  useSandboxMachineUsageSummary,
  useSandboxMachineUsageTimeline,
  type DashboardInstanceSandboxMachinesUsageTimelineQuery
} from '@metorial/state';
import { Button, Flex } from '@metorial/ui';
import { RiRefreshLine } from '@remixicon/react';
import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { sandboxUsageChartSeries } from '../../../scenes/sandbox/usage/series';

let DAY = 24 * 60 * 60 * 1000;

let MachineUsage = ({ instanceId, machineId }: { instanceId: string; machineId: string }) => {
  let [params, setParams] = useSearchParams();
  let query = parseMetricsQuery(params);
  let [refreshKey, setRefreshKey] = useState(0);
  let baseRange = useMetricsTimeRange(query.range, {
    retentionMs: 30 * DAY,
    maxSpanMs: 31 * DAY
  });
  let range = useMemo(() => {
    let resolved = refreshKey
      ? resolveMetricsRange(query.range, { retentionMs: 30 * DAY, maxSpanMs: 31 * DAY })
      : baseRange;
    let to = new Date(Math.min(resolved.to.getTime(), Date.now() - 5000));
    return { from: resolved.from, to };
  }, [baseRange, refreshKey]);
  let intervals = defaultMetricsIntervals.map(i => ({
    ...i,
    ...(i.durationMs < 3600000 && { retentionMs: 7 * DAY })
  }));
  let interval =
    query.interval == 'auto'
      ? undefined
      : (query.interval as DashboardInstanceSandboxMachinesUsageTimelineQuery['interval']);
  if (
    range.from.getTime() < Date.now() - 7 * DAY &&
    interval &&
    !['1h', '6h', '12h', '1d'].includes(interval)
  )
    interval = '1h';

  let machine = useSandboxMachine(instanceId, machineId);
  let timeline = useSandboxMachineUsageTimeline(instanceId, machineId, { ...range, interval });
  let summary = useSandboxMachineUsageSummary(instanceId, machineId, range);
  let unavailable =
    timeline.error?.data.code == 'usage_unavailable' ||
    summary.error?.data.code == 'usage_unavailable';
  let refresh = () => {
    setRefreshKey(k => k + 1);
    timeline.refetch();
    summary.refetch();
  };

  return (
    <Flex direction="column" gap={20}>
      <MetricsToolbar
        value={query}
        onChange={q => setParams(applyMetricsQuery(params, q))}
        intervals={intervals}
        retentionMs={30 * DAY}
        maxSpanMs={31 * DAY}
        end={
          <Button
            size="3"
            variant="soft"
            onClick={refresh}
            loading={timeline.isLoading || summary.isLoading}
            title="Refresh metrics data"
            iconRight={<RiRefreshLine />}
          />
        }
      />
      {unavailable ? (
        <MetricsUnavailable
          action={
            <Button variant="outline" size="2" onClick={refresh}>
              Retry
            </Button>
          }
        />
      ) : (
        renderWithLoader({ machine, timeline, summary })(({ machine, timeline, summary }) => {
          let totals = summary.data.groups[0]?.totals;
          let series = sandboxUsageChartSeries(timeline.data, machine.data.spec?.cpus ?? null);
          return (
            <>
              <MetricsSummary
                items={
                  totals
                    ? [
                        {
                          label: 'Runtime',
                          value: formatDuration(totals.runtimeSeconds * 1000)
                        },
                        {
                          label: 'CPU',
                          value: `${formatNumber(totals.averageCoresUsed)} vCPU`,
                          sub: `Peak ${formatNumber(totals.peakCoresUsed)}`
                        },
                        {
                          label: 'Memory',
                          value: formatBytes(totals.averageMemoryUsedBytes),
                          sub: `Peak ${formatBytes(totals.peakMemoryUsedBytes)}`
                        },
                        {
                          label: 'Network',
                          value: `↓ ${formatBytes(totals.networkRxBytes)} · ↑ ${formatBytes(totals.networkTxBytes)}`
                        },
                        {
                          label: 'Disk I/O',
                          value: `R ${formatBytes(totals.diskReadBytes)} · W ${formatBytes(totals.diskWriteBytes)}`
                        }
                      ]
                    : []
                }
              />
              <MetricsGrid>
                <MetricChartCard
                  title="CPU"
                  description="Average cores used"
                  span="full"
                  series={series.cpu}
                  xAxis="time"
                  domain={range}
                  yMin={0}
                  valueFormatter={n => `${formatNumber(n)} vCPU`}
                />
                <MetricChartCard
                  title="Memory"
                  series={series.memory}
                  xAxis="time"
                  domain={range}
                  binaryScale
                  yMin={0}
                  valueFormatter={formatBytes}
                />
                <MetricChartCard
                  title="Network"
                  series={series.network}
                  xAxis="time"
                  domain={range}
                  binaryScale
                  yMin={0}
                  valueFormatter={formatBytes}
                />
                <MetricChartCard
                  title="Disk I/O"
                  series={series.disk}
                  xAxis="time"
                  domain={range}
                  binaryScale
                  yMin={0}
                  valueFormatter={formatBytes}
                />
              </MetricsGrid>
            </>
          );
        })
      )}
    </Flex>
  );
};

export let SandboxMachineUsagePage = () => {
  let instance = useCurrentInstance();
  let { machineId } = useParams();
  return renderWithLoader({ instance })(
    ({ instance }) =>
      machineId && (
        <MachineUsage key={machineId} instanceId={instance.data.id} machineId={machineId} />
      )
  );
};
