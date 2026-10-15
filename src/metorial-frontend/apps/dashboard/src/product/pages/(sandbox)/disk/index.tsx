import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import {
  useSandboxDisk,
  useSandboxDiskMounts,
  useSandboxDiskResize,
  useSandboxDiskResizes
} from '@metorial/state';
import { Button, Callout, RenderDate, Text, theme } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import styled from 'styled-components';
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

let Mounts = ({ disk }: { disk: SandboxDisk }) => {
  let paths = useSandboxDiskPaths();
  let mounts = useSandboxDiskMounts(paths.instanceId, disk.id, { order: 'desc' });

  return (
    <Box title="Mounts">
      {renderWithPagination(mounts, { hidePaginationWhenUnavailable: true })(mounts => {
        let sorted = [...mounts.data.items].sort(
          (a, b) =>
            Number(!b.releasedAt && b.machineId === disk.machine?.id) -
            Number(!a.releasedAt && a.machineId === disk.machine?.id)
        );

        return sorted.length ? (
          <Table
            headers={['Machine', 'Mount Path', 'Status', 'Mounted', '']}
            data={sorted.map(mount => ({
              data: [
                <div>{mount.machineId ? <DiskMachineLink id={mount.machineId} /> : '—'}</div>,
                mount.machineId ? (
                  <Link to={paths.machine(mount.machineId)}>
                    <Text style={{ fontFamily: 'monospace' }}>{mount.mountPath}</Text>
                  </Link>
                ) : (
                  <Text style={{ fontFamily: 'monospace' }}>{mount.mountPath}</Text>
                ),
                <Link to={mount.machineId ? paths.machine(mount.machineId) : '#'}>
                  <SandboxMountStatusBadge status={mount.status} />
                </Link>,
                <>
                  <RenderDate date={mount.mountedAt || mount.createdAt} />
                  {mount.releasedAt && (
                    <>
                      {' '}
                      – <RenderDate date={mount.releasedAt} />
                    </>
                  )}
                </>,
                mount.machineId && !mount.releasedAt ? (
                  <Link
                    to={`${paths.machine(mount.machineId, 'files')}?path=${encodeURIComponent(mount.mountPath)}`}
                  >
                    Browse Files
                  </Link>
                ) : (
                  '—'
                )
              ]
            }))}
          />
        ) : (
          <Text>No mounts yet.</Text>
        );
      })}
    </Box>
  );
};

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

      {renderWithPagination(resizes, {
        hidePaginationWhenUnavailable: true
      })(resizes =>
        resizes.data.items.length ? (
          <Box title="Recent Resizes">
            <Table
              headers={['Change', 'Status', 'Started', 'Duration']}
              data={resizes.data.items.map(resize => [
                <div>
                  {formatBytes(resize.originalSizeBytes)} →{' '}
                  {formatBytes(resize.targetSizeBytes)}
                  {resize.status === 'failed' && (
                    <FailedResize>
                      <Text>
                        {resize.failure?.message || 'The disk could not be resized.'}
                      </Text>
                      {disk.status !== 'deleted' && !disk.activeResize && (
                        <RetryResize diskId={disk.id} resizeId={resize.id} />
                      )}
                    </FailedResize>
                  )}
                </div>,
                <SandboxResizeStatusBadge status={resize.status} />,
                <RenderDate date={resize.createdAt} />,
                resize.completedAt
                  ? formatDurationBetween(resize.createdAt, resize.completedAt)
                  : resize.status === 'failed'
                    ? formatDurationBetween(resize.createdAt, resize.updatedAt)
                    : 'Running'
              ])}
            />
          </Box>
        ) : null
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
