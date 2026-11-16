import { renderWithPagination } from '@metorial-io/data-hooks';
import { Badge, Callout, Dialog, Flex, Group, RenderDate, Text } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { EmptyState } from '../../components/styled';
import { useSlatePackBuild, useSlatePackBuilds } from '../../hooks';

let buildsRefreshMs = 5_000;

let logRefreshMs = 2_000;

let LogViewer = styled.pre`
  margin: 0;
  max-height: 460px;
  overflow: auto;
  padding: 14px 16px;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
`;

let statusColors = { running: 'blue', completed: 'green', failed: 'red' } as const;

let statusLabels = { running: 'Running', completed: 'Completed', failed: 'Failed' } as const;

let describeBuild = (build: {
  trigger: 'scheduled' | 'manual';
  forceFullSync: boolean;
  reset: boolean;
  rewindFeed: boolean;
}) => {
  if (build.trigger === 'scheduled') return 'Scheduled';

  let options = [
    build.reset && 'reset packs',
    build.rewindFeed && 'rebuild history',
    build.forceFullSync && 'full sync'
  ].filter(Boolean);

  return `Manual${options.length ? ` (${options.join(', ')})` : ''}`;
};

let formatDuration = (start: string | Date, end: string | Date | null) => {
  let seconds = Math.max(
    0,
    Math.round(((end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()) / 1000)
  );
  if (seconds < 60) return `${seconds}s`;

  let minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

let BuildLogDialog = (p: {
  tenantId: string;
  subRegistryIdentifier: string;
  buildId: string | null;
  onClose: () => void;
}) => {
  let build = useSlatePackBuild({
    tenantId: p.tenantId,
    subRegistryIdentifier: p.subRegistryIdentifier,
    buildId: p.buildId
  });
  let viewer = useRef<HTMLPreElement>(null);
  let data = build.data;
  let isRunning = data?.status === 'running';

  useEffect(() => {
    if (!isRunning) return;

    let interval = setInterval(() => build.refetch(), logRefreshMs);
    return () => clearInterval(interval);
  }, [isRunning, build.refetch]);

  useEffect(() => {
    if (viewer.current) viewer.current.scrollTop = viewer.current.scrollHeight;
  }, [data?.logs.length]);

  return (
    <Dialog.Wrapper
      isOpen={!!p.buildId}
      onOpenChange={open => !open && p.onClose()}
      width={780}
    >
      <Dialog.Title>Build Log</Dialog.Title>
      <Dialog.Description>
        {data ? (
          <>
            {describeBuild(data)} · started <RenderDate date={data.startedAt} /> ·{' '}
            {formatDuration(data.startedAt, data.completedAt)}
          </>
        ) : (
          'Loading…'
        )}
      </Dialog.Description>

      <Flex direction="column" gap={12}>
        {data?.error && (
          <Callout color="red">
            <Text size="2">{data.error}</Text>
          </Callout>
        )}

        <LogViewer ref={viewer}>
          {data
            ? data.logs.length
              ? data.logs.join('\n')
              : 'Nothing logged yet.'
            : ''}
        </LogViewer>

        {isRunning && (
          <Text size="1" color="gray600">
            This build is still running. The log updates automatically.
          </Text>
        )}
      </Flex>
    </Dialog.Wrapper>
  );
};

export let BuildTable = (p: { tenantId: string; subRegistryIdentifier: string }) => {
  let builds = useSlatePackBuilds({
    tenantId: p.tenantId,
    subRegistryIdentifier: p.subRegistryIdentifier
  });
  let [openBuildId, setOpenBuildId] = useState<string | null>(null);

  useEffect(() => {
    let interval = setInterval(() => builds.refetch(), buildsRefreshMs);
    return () => clearInterval(interval);
  }, [builds.refetch]);

  return (
    <Group.Wrapper>
      <Group.Header
        title="Builds"
        description="Every run of the pack builder that did something. Open one to read its log."
      />

      {renderWithPagination(builds, {
        emptyState: (
          <EmptyState direction="column" align="center">
            <Text size="2" color="gray600">
              No builds yet. A build appears here as soon as it starts working on a pack.
            </Text>
          </EmptyState>
        )
      })(({ data }) => (
        <Table
          padding={{ sides: '20px' }}
          headers={['Status', 'Type', 'Packs written', 'Started', 'Duration']}
          data={data.items.map(build => ({
            onClick: () => setOpenBuildId(build.id),
            data: [
              <Badge color={statusColors[build.status]} size="2">
                {statusLabels[build.status]}
              </Badge>,
              describeBuild(build),
              build.releasesWritten,
              <RenderDate date={build.startedAt} />,
              formatDuration(build.startedAt, build.completedAt)
            ]
          }))}
        />
      ))}

      <BuildLogDialog
        tenantId={p.tenantId}
        subRegistryIdentifier={p.subRegistryIdentifier}
        buildId={openBuildId}
        onClose={() => setOpenBuildId(null)}
      />
    </Group.Wrapper>
  );
};
