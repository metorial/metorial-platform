import { col, createDataList, f } from '@metorial/data-list';
import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { useSandboxDisks, useSandboxRegions } from '@metorial/state';
import { Button, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Link, useNavigate } from 'react-router-dom';
import { useInstanceContext } from '../../../lib/dataList';
import { entityFilters } from '../../../scenes/entityFilters';
import {
  SandboxDiskMenu,
  showSandboxCreateDiskDialog
} from '../../../scenes/sandbox/disks/actions';
import { SandboxDisk, useSandboxDiskPaths } from '../../../scenes/sandbox/disks/common';
import { formatBytes } from '../../../scenes/sandbox/lib/format';
import { SandboxDiskStatusBadge } from '../../../scenes/sandbox/shared/statusBadges';
import { SandboxManagedPage, useSandboxAccess } from '../_gate';

let diskTypes = [
  { id: 'standard', label: 'Standard (Default)' },
  { id: 'root_fs', label: 'Root Filesystems' },
  { id: 'all', label: 'All' }
] as const;

let attachedOptions = [
  { id: 'yes', label: 'Attached' },
  { id: 'no', label: 'Not Attached' }
] as const;

let DisksTable = createDataList<{ openDisk: (id: string) => void }>('sandbox-disks')
  .context(useInstanceContext)
  .filters((_props, ctx) => ({
    type: f.select('type', 'Type', diskTypes, { pinned: true }),
    machineId: f.entity(entityFilters.sandboxMachine(ctx.instanceId)),
    region: f.entity({
      id: 'region',
      fields: ['region'],
      label: 'Region',
      description: 'Filter by region',
      type: 'entity',
      useOptions: () => {
        let regions = useSandboxRegions(ctx.instanceId);
        return {
          items: (regions.data?.items ?? []).map(region => ({
            id: region.id,
            label: region.name || region.id
          })),
          isLoading: regions.isLoading
        };
      }
    }),
    attached: f.select('attached', 'Attached', attachedOptions, {
      description: 'Filter by attachment'
    })
  }))
  .search('Search disks…')
  .paginated(({ ctx, filters, search }) => {
    let attached = filters.attached?.[0];

    return useSandboxDisks(ctx.instanceId, {
      search,
      type: filters.type?.includes('all')
        ? undefined
        : ((filters.type ?? ['standard']) as ('standard' | 'root_fs')[]),
      machineId: filters.machineId,
      region: filters.region,
      attached: attached === 'yes' ? true : attached === 'no' ? false : undefined,
      order: 'desc'
    });
  })
  .columns([
    col.custom<
      SandboxDisk,
      { openDisk: (id: string) => void },
      ReturnType<typeof useInstanceContext>
    >({
      id: 'name',
      header: 'Name',
      render: (disk, _props, ctx) => (
        <div>
          <Link
            to={Paths.instance.sandboxDisk(
              ctx.organization,
              ctx.project,
              ctx.instance,
              disk.id
            )}
          >
            <Text size="2" weight="strong">
              {disk.name || 'Untitled disk'}
            </Text>
          </Link>
          <ID id={disk.id} />
        </div>
      )
    }),
    col.text<SandboxDisk>({
      id: 'size',
      header: 'Size',
      get: disk =>
        `${formatBytes(disk.sizeBytes)}${disk.activeResize ? ` → ${formatBytes(disk.activeResize.targetSizeBytes)}` : ''}`
    }),
    col.custom<
      SandboxDisk,
      { openDisk: (id: string) => void },
      ReturnType<typeof useInstanceContext>
    >({
      id: 'machine',
      header: 'Attached To',
      render: (disk, _props, ctx) =>
        disk.machine ? (
          <div>
            {disk.type === 'root_fs' && 'Root disk of '}
            <Link
              to={Paths.instance.sandboxMachine(
                ctx.organization,
                ctx.project,
                ctx.instance,
                disk.machine.id
              )}
            >
              {disk.machine.name || disk.machine.slug || disk.machine.id}
            </Link>
            {disk.type === 'standard' && (
              <Text size="1" style={{ fontFamily: 'monospace' }}>
                {disk.machine.mountPath}
              </Text>
            )}
          </div>
        ) : (
          <Text size="2" color="gray600">
            Not attached
          </Text>
        )
    }),
    col.custom<SandboxDisk>({
      id: 'status',
      header: 'Status',
      isDefault: false,
      render: disk => (
        <SandboxDiskStatusBadge status={disk.status} activeResize={disk.activeResize} />
      )
    }),
    col.text<SandboxDisk>({
      id: 'type',
      header: 'Type',
      isDefault: false,
      get: disk => (disk.type === 'root_fs' ? 'Root Filesystem' : 'Standard')
    }),
    col.text<SandboxDisk>({
      id: 'region',
      header: 'Region',
      isDefault: false,
      get: disk => disk.region
    }),
    col.createdAt<SandboxDisk>(),
    col.id<SandboxDisk>(),
    col.custom<SandboxDisk>({
      id: 'actions',
      header: '',
      render: disk => (disk.status !== 'deleted' ? <SandboxDiskMenu disk={disk} /> : null)
    })
  ])
  .clickable((disk, props) => props.openDisk(disk.id))
  .build();

let SandboxDisksContent = () => {
  let paths = useSandboxDiskPaths();
  let navigate = useNavigate();

  return (
    <DisksTable
      openDisk={id => navigate(paths.disk(id))}
      emptyState={{
        initial: () => (
          <EmptyState
            title="Create Reusable Disks"
            description="Persistent storage that can be attached to machines."
            action={{ label: 'Create Disk', onClick: showSandboxCreateDiskDialog }}
          />
        ),
        filtered: 'No disks match these filters.'
      }}
    />
  );
};

export let SandboxDisksPage = () => {
  let access = useSandboxAccess();

  return (
    <ContentLayout>
      <PageHeader
        title="Disks"
        description="Persistent storage that can be attached to machines."
        actions={
          <Button size="2" disabled={!access.canWrite} onClick={showSandboxCreateDiskDialog}>
            Create Disk
          </Button>
        }
      />
      <SandboxManagedPage>
        <SandboxDisksContent />
      </SandboxManagedPage>
    </ContentLayout>
  );
};
