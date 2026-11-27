import { EmptyValue, col, createDataList } from '@metorial/data-list';
import { renderWithLoader } from '@metorial/data-hooks';
import type {
  DashboardInstanceSandboxDisksMountsListOutput,
  DashboardInstanceSandboxDisksResizesListOutput
} from '@metorial/dashboard-sdk';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useSandboxDisk,
  useSandboxDiskMounts,
  useSandboxDiskResize,
  useSandboxDiskResizes
} from '@metorial/state';
import { Button, Callout, RenderDate, Text, theme } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { useInstanceContext, type InstanceContext } from '../../../lib/dataList';
import {
  DiskMachineLink,
  DiskStack,
  SandboxDisk,
  useSandboxDiskPaths
} from '../../../scenes/sandbox/disks/common';
import { SandboxDiskResizeProgress } from '../../../scenes/sandbox/disks/resizeProgress';
import { formatBytes, formatDurationBetween } from '../../../scenes/sandbox/lib/format';
import {
  SandboxMountStatusBadge,
  SandboxResizeStatusBadge
} from '../../../scenes/sandbox/shared/statusBadges';

let FailedResize = styled.div`
  background: ${theme.colors.red100};
  border-radius: 6px;
  padding: 8px;
`;

let RetryResize = ({ diskId, resizeId }: { diskId: string; resizeId: string }) => {
  let paths = useSandboxDiskPaths();
  let resize = useSandboxDiskResize(paths.instanceId, diskId, resizeId);
  let retry = resize.useRetryMutator();

  return (
    <>
      <Button
        size="2"
        variant="outline"
        loading={retry.isLoading}
        success={retry.isSuccess}
        onClick={() => retry.mutate()}
      >
        Retry Resize
      </Button>
      <retry.RenderError />
    </>
  );
};

type Mount = DashboardInstanceSandboxDisksMountsListOutput['items'][number];
type Resize = DashboardInstanceSandboxDisksResizesListOutput['items'][number];

type DiskProps = { disk: SandboxDisk };

let MountsList = createDataList<DiskProps>('sandbox-disk-mounts', { customizable: false })
  .context(useInstanceContext)
  .paginated(({ props, ctx }) =>
    useSandboxDiskMounts(ctx.instanceId, props.disk.id, { order: 'desc' })
  )
  .enrich((mounts, { props }) => ({
    items: useMemo(
      () =>
        [...mounts].sort(
          (a, b) =>
            Number(!b.releasedAt && b.machineId === props.disk.machine?.id) -
            Number(!a.releasedAt && a.machineId === props.disk.machine?.id)
        ),
      [mounts, props.disk.machine?.id]
    )
  }))
  .columns([
    col.custom<Mount, DiskProps, InstanceContext>({
      id: 'machine',
      header: 'Machine',
      render: mount => (
        <div>
          {mount.machineId ? <DiskMachineLink id={mount.machineId} /> : <EmptyValue />}
        </div>
      )
    }),
    col.custom<Mount, DiskProps, InstanceContext>({
      id: 'mountPath',
      header: 'Mount Path',
      render: (mount, _props, ctx) =>
        mount.machineId ? (
          <Link
            to={Paths.instance.sandboxMachine(
              ctx.organization,
              ctx.project,
              ctx.instance,
              mount.machineId
            )}
          >
            <Text style={{ fontFamily: 'monospace' }}>{mount.mountPath}</Text>
          </Link>
        ) : (
          <Text style={{ fontFamily: 'monospace' }}>{mount.mountPath}</Text>
        )
    }),
    col.custom<Mount, DiskProps, InstanceContext>({
      id: 'status',
      header: 'Status',
      render: (mount, _props, ctx) => (
        <Link
          to={
            mount.machineId
              ? Paths.instance.sandboxMachine(
                  ctx.organization,
                  ctx.project,
                  ctx.instance,
                  mount.machineId
                )
              : '#'
          }
        >
          <SandboxMountStatusBadge status={mount.status} />
        </Link>
      )
    }),
    col.custom<Mount>({
      id: 'mounted',
      header: 'Mounted',
      render: mount => (
        <>
          <RenderDate date={mount.mountedAt || mount.createdAt} />
          {mount.releasedAt && (
            <>
              {' '}
              – <RenderDate date={mount.releasedAt} />
            </>
          )}
        </>
      )
    }),
    col.custom<Mount, DiskProps, InstanceContext>({
      id: 'files',
      header: '',
      render: (mount, _props, ctx) =>
        mount.machineId && !mount.releasedAt ? (
          <Link
            to={`${Paths.instance.sandboxMachine(ctx.organization, ctx.project, ctx.instance, mount.machineId, 'files')}?path=${encodeURIComponent(mount.mountPath)}`}
          >
            Browse Files
          </Link>
        ) : (
          <EmptyValue />
        )
    })
  ])
  .build();

let Mounts = ({ disk }: { disk: SandboxDisk }) => (
  <Box title="Mounts">
    <MountsList disk={disk} listVariant="embedded" emptyState="No mounts yet." />
  </Box>
);

let ResizesList = createDataList<DiskProps>('sandbox-disk-resizes', { customizable: false })
  .context(useInstanceContext)
  .paginated(({ props, ctx }) =>
    useSandboxDiskResizes(ctx.instanceId, props.disk.id, { order: 'desc' })
  )
  .columns([
    col.custom<Resize, DiskProps>({
      id: 'change',
      header: 'Change',
      render: (resize, { disk }) => (
        <div>
          {formatBytes(resize.originalSizeBytes)} → {formatBytes(resize.targetSizeBytes)}
          {resize.status === 'failed' && (
            <FailedResize>
              <Text>{resize.failure?.message || 'The disk could not be resized.'}</Text>
              {disk.status !== 'deleted' && !disk.activeResize && (
                <RetryResize diskId={disk.id} resizeId={resize.id} />
              )}
            </FailedResize>
          )}
        </div>
      )
    }),
    col.custom<Resize>({
      id: 'status',
      header: 'Status',
      render: resize => <SandboxResizeStatusBadge status={resize.status} />
    }),
    col.date<Resize>('createdAt', { id: 'started', header: 'Started', isDefault: true }),
    col.text<Resize>({
      id: 'duration',
      header: 'Duration',
      get: resize =>
        resize.completedAt
          ? formatDurationBetween(resize.createdAt, resize.completedAt)
          : resize.status === 'failed'
            ? formatDurationBetween(resize.createdAt, resize.updatedAt)
            : 'Running'
    })
  ])
  .build();

let ResizeHistory = ({ disk }: { disk: SandboxDisk }) => {
  let paths = useSandboxDiskPaths();
  let resizes = useSandboxDiskResizes(paths.instanceId, disk.id, { order: 'desc' });
  let newest = resizes.data?.items[0];

  return (
    <DiskStack>
      {newest?.status === 'failed' && !disk.activeResize && disk.status !== 'deleted' && (
        <Callout color="red">
          <DiskStack>
            <Text>
              Resize to {formatBytes(newest.targetSizeBytes)} failed. {newest.failure?.message}{' '}
              Its size is still {formatBytes(disk.sizeBytes)}.
            </Text>
            <RetryResize diskId={disk.id} resizeId={newest.id} />
          </DiskStack>
        </Callout>
      )}
      <SandboxDiskResizeProgress disk={disk} />
      {disk.type === 'root_fs' ? (
        <Box title="Mounts">
          <Text>
            Root disk of{' '}
            {disk.machine ? <DiskMachineLink id={disk.machine.id} /> : 'a machine'}
          </Text>
        </Box>
      ) : (
        <Mounts disk={disk} />
      )}

      {!!resizes.data?.items.length && (
        <Box title="Recent Resizes">
          <ResizesList disk={disk} listVariant="embedded" />
        </Box>
      )}
    </DiskStack>
  );
};

export let SandboxDiskOverviewPage = () => {
  let paths = useSandboxDiskPaths();
  let { diskId } = useParams();
  let disk = useSandboxDisk(paths.instanceId, diskId);

  return renderWithLoader({ disk })(({ disk }) => (
    <DetailsOverviewLayout>
      <ResizeHistory disk={disk.data} />
    </DetailsOverviewLayout>
  ));
};
