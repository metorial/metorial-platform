import { formatBytes, formatNumber } from '@metorial/chart';
import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { MetricTile, MetricsUnavailable, useMetricsTimeRange } from '@metorial/metrics-page';
import {
  useSandboxMachineErrors,
  useSandboxMachineEvents,
  useSandboxMachineUsageTimeline
} from '@metorial/state';
import { Button, Callout, Flex, RenderDate, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useSandboxMachinePage } from '../../../scenes/sandbox/machines/context';
import { getSandboxMachineEventCopy } from '../../../scenes/sandbox/shared/eventCopy';

let operationMessages = {
  start: 'Your machine is starting. It will be ready shortly.',
  pause: 'Your machine is pausing and saving its state.',
  hibernate: 'Your machine is hibernating. You can resume it when you need it again.',
  restart: 'Your machine is restarting. It will be available again when startup finishes.',
  terminate: 'Your machine is being deleted.',
  update: 'Your machine’s configuration is being updated.',
  upgrade:
    'Your machine is changing to its new size. It will be ready when the update finishes.'
};

let ResourceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
`;

let ResourceTile = styled.div<{ $paused: boolean }>`
  display: flex;
  min-width: 0;

  > * {
    flex: 1;
    height: 100%;
  }

  ${({ $paused }) => $paused && 'filter: grayscale(1); opacity: 0.55;'}
`;

let OverviewMetrics = () => {
  let { instance, machineId, machine, path } = useSandboxMachinePage();
  let liveRange = useMetricsTimeRange(
    { type: 'preset', preset: '1h' },
    { refreshIntervalMs: 60000 }
  );
  let range = useMemo(() => {
    let to = new Date(liveRange.to);
    to.setSeconds(0, 0);
    return { from: new Date(to.getTime() - 3600000), to, interval: '1m' as const };
  }, [liveRange.to]);
  let timeline = useSandboxMachineUsageTimeline(instance.data?.id, machineId, range, {
    pollInterval: 30000
  });
  if (timeline.error?.data.code === 'usage_unavailable') return <MetricsUnavailable />;
  return renderWithLoader({ timeline })(({ timeline }) => {
    let points = timeline.data.series
      .flatMap(s => s.points)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    let latest = points.at(-1);
    let paused = machine.data?.status === 'paused' || machine.data?.status === 'hibernated';
    let metrics = [
      {
        title: 'CPU',
        series: [{ field: 'averageCoresUsed' as const, name: 'Used' }],
        valueFormatter: (value: number) => `${formatNumber(value)} vCPU`,
        binaryScale: false,
        value: latest
          ? `${formatNumber(latest.averageCoresUsed, { precision: 2 })} vCPU`
          : '—',
        context: `of ${machine.data?.spec?.cpus ?? '—'} vCPU · peak ${latest ? formatNumber(latest.peakCoresUsed, { precision: 2 }) : '—'}`
      },
      {
        title: 'Memory',
        series: [{ field: 'averageMemoryUsedBytes' as const, name: 'Used' }],
        valueFormatter: formatBytes,
        binaryScale: true,
        value: latest ? formatBytes(latest.averageMemoryUsedBytes) : '—',
        context: `of ${latest ? formatBytes(latest.averageMemoryAllocatedBytes) : '—'} · peak ${latest ? formatBytes(latest.peakMemoryUsedBytes) : '—'}`
      },
      {
        title: 'Network',
        series: [
          { field: 'networkRxBytes' as const, name: 'In' },
          { field: 'networkTxBytes' as const, name: 'Out' }
        ],
        valueFormatter: formatBytes,
        binaryScale: true,
        value: latest
          ? `↓ ${formatBytes(latest.networkRxBytes)} ↑ ${formatBytes(latest.networkTxBytes)}`
          : '—',
        context: 'Received / Sent'
      },
      {
        title: 'Disk I/O',
        series: [
          { field: 'diskReadBytes' as const, name: 'Read' },
          { field: 'diskWriteBytes' as const, name: 'Write' }
        ],
        valueFormatter: formatBytes,
        binaryScale: true,
        value: latest
          ? `R ${formatBytes(latest.diskReadBytes)} W ${formatBytes(latest.diskWriteBytes)}`
          : '—',
        context: 'Read / Write'
      }
    ];
    return (
      <>
        <ResourceGrid>
          {metrics.map(metric => (
            <ResourceTile key={metric.title} $paused={paused}>
              <MetricTile
                title={metric.title}
                value={paused ? '—' : metric.value}
                context={
                  paused
                    ? metric.title === 'CPU'
                      ? `${machine.data?.spec?.cpus ?? '—'} vCPU`
                      : metric.title === 'Memory'
                        ? `${machine.data?.spec?.memoryGib ?? '—'} GiB`
                        : metric.context
                    : metric.context
                }
                href={path('usage')}
                sparkline={{
                  series: metric.series.map(item => ({
                    id: item.field,
                    name: item.name,
                    color: paused ? ('gray' as const) : undefined,
                    entries: paused
                      ? Array.from({ length: 24 }, (_, index) => ({
                          key: new Date(
                            range.from.getTime() +
                              (index * (range.to.getTime() - range.from.getTime())) / 23
                          ),
                          value: 20 + Math.sin(index * 0.8) * 7 + Math.cos(index * 1.7) * 3
                        }))
                      : points.map(point => ({
                          key: point.timestamp,
                          value: point[item.field]
                        }))
                  })),
                  tooltip: !paused,
                  valueFormatter: metric.valueFormatter,
                  binaryScale: metric.binaryScale,
                  yMin: 0,
                  xAxis: 'time',
                  domain: range
                }}
              />
            </ResourceTile>
          ))}
        </ResourceGrid>
      </>
    );
  });
};

export let SandboxMachineOverviewPage = () => {
  let { machine, machineId, instance, path } = useSandboxMachinePage();
  let events = useSandboxMachineEvents(
    instance.data?.id,
    machineId,
    { order: 'desc', limit: 6 },
    { pollInterval: 10000 }
  );
  let errors = useSandboxMachineErrors(
    instance.data?.id,
    machineId,
    { order: 'desc', limit: 5 },
    { pollInterval: 10000 }
  );
  let touch = machine.useTouchMutator();
  let restart = machine.useRestartMutator();
  let start = machine.useStartMutator();
  return renderWithLoader({ machine })(({ machine }) => (
    <DetailsOverviewLayout>
      <Flex direction="column" gap={20}>
        {machine.data.status !== 'terminated' &&
          (machine.data.failure ? (
            <Callout color="red">
              <Flex direction="column" gap={10}>
                <Text>{machine.data.failure.message}</Text>
                <Flex gap={8} justify="end">
                  <Link to={path('logs', 'runtime')}>View Logs</Link>
                  <Button
                    size="1"
                    loading={restart.isLoading}
                    success={restart.isSuccess}
                    onClick={() => restart.mutate()}
                  >
                    Restart
                  </Button>
                </Flex>
                <restart.RenderError />
              </Flex>
            </Callout>
          ) : machine.data.operation ? (
            <Callout color="orange">{operationMessages[machine.data.operation.kind]}</Callout>
          ) : machine.data.status === 'paused' || machine.data.status === 'hibernated' ? (
            <Callout color="orange">
              <Flex gap={10} align="center" justify="space-between" style={{ width: '100%' }}>
                <Text>
                  {machine.data.status === 'paused' ? 'Paused Since' : 'Hibernated Since'}{' '}
                  {(
                    machine.data.status === 'paused'
                      ? machine.data.pausedAt
                      : machine.data.hibernatedAt
                  ) ? (
                    <RenderDate
                      date={
                        (machine.data.status === 'paused'
                          ? machine.data.pausedAt
                          : machine.data.hibernatedAt)!
                      }
                    />
                  ) : (
                    'the last stop'
                  )}
                </Text>
                <Button
                  size="2"
                  loading={start.isLoading}
                  success={start.isSuccess}
                  onClick={() => start.mutate()}
                >
                  Resume
                </Button>
              </Flex>
              <start.RenderError />
            </Callout>
          ) : machine.data.upcomingEvents[0] ? (
            <Callout color="orange">
              <Flex gap={10} align="center" justify="space-between" style={{ width: '100%' }}>
                <Text>
                  {machine.data.upcomingEvents[0].type === 'hibernate'
                    ? 'Hibernating'
                    : machine.data.upcomingEvents[0].type === 'pause'
                      ? 'Pausing'
                      : 'Restarting'}{' '}
                  at <RenderDate date={machine.data.upcomingEvents[0].occursAt} />
                </Text>
                <Button
                  size="1"
                  variant="outline"
                  loading={touch.isLoading}
                  success={touch.isSuccess}
                  onClick={() => touch.mutate()}
                >
                  Keep Awake
                </Button>
              </Flex>
              <touch.RenderError />
            </Callout>
          ) : null)}
        {machine.data.status !== 'terminated' && machine.data.restartRequired && (
          <Callout color="orange">
            <Flex gap={12} align="center" justify="space-between" style={{ width: '100%' }}>
              <Text>Changes are waiting for a restart.</Text>
              <Button
                size="1"
                loading={restart.isLoading}
                success={restart.isSuccess}
                onClick={() => restart.mutate()}
              >
                Restart Now
              </Button>
            </Flex>
            <restart.RenderError />
          </Callout>
        )}
        {renderWithLoader({ errors })(({ errors }) =>
          errors.data.items.length ? (
            <Box title="Errors">
              <Flex direction="column" gap={16}>
                {errors.data.items.map(error => (
                  <Callout color="red" key={error.id}>
                    <Text weight="strong">
                      {error.stage} · {error.reason}: {error.message}
                    </Text>
                    {error.exitCode !== null && (
                      <Text size="2">Exit Code: {error.exitCode}</Text>
                    )}
                    {machine.data.status !== 'terminated' && (
                      <Link
                        to={`${path('logs', 'runtime')}?boot=${encodeURIComponent(error.machineInstanceId)}`}
                      >
                        View Logs
                      </Link>
                    )}
                    {error.stdout && (
                      <>
                        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                          {error.stdout.split('\n').slice(0, 6).join('\n')}
                        </pre>
                        {error.stdout.split('\n').length > 6 && (
                          <details>
                            <summary>Show More</summary>
                            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                              {error.stdout.split('\n').slice(6).join('\n')}
                            </pre>
                          </details>
                        )}
                      </>
                    )}
                  </Callout>
                ))}
              </Flex>
            </Box>
          ) : null
        )}
        {machine.data.status !== 'terminated' && <OverviewMetrics />}
        <Box
          title="Recent Events"
          rightActions={
            <Link to={path('logs')}>
              <Button as="span" size="2" variant="outline">
                View All
              </Button>
            </Link>
          }
        >
          {renderWithLoader({ events })(({ events }) => (
            <>
              {events.data.items.length === 0 && (
                <Text size="2" color="gray600">
                  No events yet.
                </Text>
              )}
              <Table
                headers={['Event', 'Source', 'Time']}
                data={events.data.items.map(event => {
                  let copy = getSandboxMachineEventCopy(event.type);
                  let Icon = copy.icon;
                  return {
                    href: `${path('logs')}?event_id=${event.id}`,
                    data: [
                      <Flex gap={8} align="center">
                        <Icon size={16} color={copy.isError ? 'red' : undefined} />
                        <Text size="2">{copy.sentence}</Text>
                      </Flex>,
                      event.source,
                      <RenderDate date={event.occurredAt} />
                    ]
                  };
                })}
              />
            </>
          ))}
        </Box>
      </Flex>
    </DetailsOverviewLayout>
  ));
};
