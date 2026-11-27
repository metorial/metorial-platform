import { SandboxManagedPage } from '../_gate';
import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { useSandboxDisk } from '@metorial/state';
import { RiHardDrive3Line } from '@remixicon/react';
import { Outlet, useParams } from 'react-router-dom';
import { RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';
import { DiskMachineLink, useSandboxDiskPaths } from '../../../scenes/sandbox/disks/common';
import { SandboxDiskMenu } from '../../../scenes/sandbox/disks/actions';
import { showSandboxResizeDiskDialog } from '../../../scenes/sandbox/resizeDiskDialog';
import { formatBytes } from '../../../scenes/sandbox/lib/format';
import { SandboxDiskStatusBadge } from '../../../scenes/sandbox/shared/statusBadges';

let SandboxDiskDetailsLayout = () => {
  let { diskId } = useParams();
  let paths = useSandboxDiskPaths();
  let disk = useSandboxDisk(paths.instanceId, diskId);

  return (
    <DetailsLayout
      entity={
        disk.data
          ? {
              ...disk.data,
              name: disk.data.name || 'Untitled disk',
              description: `${disk.data.type === 'root_fs' ? 'Root filesystem' : 'Standard disk'} · ${disk.data.region}`
            }
          : undefined
      }
      icon={<RiHardDrive3Line />}
      breadcrumbs={[
        { label: 'Disks', to: paths.disks },
        {
          label: disk.data ? disk.data.name || 'Untitled disk' : undefined,
          to: paths.disk(diskId!)
        }
      ]}
      tabs={[
        { label: 'Overview', to: paths.disk(diskId!) },
        { label: 'Settings', to: paths.disk(diskId!, 'settings') }
      ]}
      actions={
        !disk.data || disk.data.status === 'deleted'
          ? []
          : [
              {
                label: 'Resize',
                variant: 'outline',
                disabled:
                  !!disk.data.activeResize ||
                  disk.data.status !== 'active' ||
                  disk.data.sizeBytes == null,
                onClick: () => {
                  if (disk.data) showSandboxResizeDiskDialog({ disk: disk.data });
                }
              },
              {
                type: 'custom',
                render: () => (disk.data ? <SandboxDiskMenu disk={disk.data} /> : null)
              }
            ]
      }
      attributes={
        disk.data
          ? [
              {
                label: 'Status',
                value: (
                  <SandboxDiskStatusBadge
                    status={disk.data.status}
                    activeResize={disk.data.activeResize}
                  />
                )
              },
              {
                label: 'Size',
                value: `${formatBytes(disk.data.sizeBytes)}${disk.data.activeResize ? ` → ${formatBytes(disk.data.activeResize.targetSizeBytes)}` : ''}`
              },
              {
                label: 'Type',
                value: disk.data.type === 'root_fs' ? 'Root Filesystem' : 'Standard'
              },
              { label: 'Region', value: disk.data.region },
              {
                label: 'Attached To',
                value: disk.data.machine ? (
                  <DiskMachineLink id={disk.data.machine.id} />
                ) : (
                  'Not attached'
                )
              },
              { label: 'Mount Path', value: disk.data.machine?.mountPath || '—' },
              { label: 'Created', value: <RenderDate date={disk.data.createdAt} /> },
              { label: 'ID', value: <ID id={disk.data.id} /> }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ disk })(({ disk }) => (
          <>
            <DeletedRecordCallout status={disk.data.status} />
            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};

export let SandboxDiskLayout = () => (
  <SandboxManagedPage withLayout>
    <SandboxDiskDetailsLayout />
  </SandboxManagedPage>
);
