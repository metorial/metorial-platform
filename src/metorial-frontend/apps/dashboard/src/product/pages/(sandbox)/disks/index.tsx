import { EmptyState } from '@metorial/empty-state';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useSandboxDisks,
  useSandboxMachines,
  useSandboxRegions
} from '@metorial/state';
import {
  Table as DashboardTable,
  FilterPayload,
  TableFilter,
  TableStateProvider,
  TableStateProviderResult
} from '@metorial/table';
import { Button, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  SandboxDiskMenu,
  showSandboxCreateDiskDialog
} from '../../../scenes/sandbox/disks/actions';
import { SandboxDisk, useSandboxDiskPaths } from '../../../scenes/sandbox/disks/common';
import { formatBytes } from '../../../scenes/sandbox/lib/format';
import { SandboxDiskStatusBadge } from '../../../scenes/sandbox/shared/statusBadges';
import { SandboxManagedPage } from '../_gate';

type Props = {
  instanceId?: string;
  diskPath: (id: string) => string;
  machinePath: (id: string) => string;
  openDisk: (id: string) => void;
};

let selected = (payload: FilterPayload | undefined): string[] | undefined => {
  if (typeof payload === 'string') return [payload];
  if (payload && typeof payload === 'object' && !(payload instanceof Date) && 'in' in payload)
    return payload.in as string[];
  return undefined;
};

let state: TableStateProvider<Props, SandboxDisk, TableStateProviderResult<SandboxDisk>> = (
  props,
  { filter, search }
) => {
  let types = selected(filter.type);
  let attached = selected(filter.attached)?.[0];
  let disks = useSandboxDisks(props.instanceId, {
    search: search || undefined,
    type: types?.includes('all')
      ? undefined
      : ((types ?? ['standard']) as ('standard' | 'root_fs')[]),
    machineId: selected(filter.machineId),
    region: selected(filter.region),
    attached: attached === 'yes' ? true : attached === 'no' ? false : undefined,
    order: 'desc'
  });

  return {
    items: disks.data?.items ?? [],
    isLoading: disks.isLoading,
    error: disks.error,
    hasMoreAfter: disks.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: disks.data?.pagination.hasMoreBefore ?? false,
    loadNext: disks.next,
    loadPrevious: disks.previous
  };
};

let table = new DashboardTable<Props, SandboxDisk>('sandbox-disks')
  .state(state)
  .search('Search disks')
  .columns([
    {
      id: 'name',
      header: 'Name',
      isDefault: true,
      render: (disk, props) => (
        <div>
          <Link to={props.diskPath(disk.id)}>
            <Text size="2" weight="strong">
              {disk.name || 'Untitled disk'}
            </Text>
          </Link>
          <ID id={disk.id} />
        </div>
      )
    },
    {
      id: 'size',
      header: 'Size',
      isDefault: true,
      render: disk => (
        <Text size="2">
          {formatBytes(disk.sizeBytes)}
          {disk.activeResize && ` → ${formatBytes(disk.activeResize.targetSizeBytes)}`}
        </Text>
      )
    },
    {
      id: 'machine',
      header: 'Attached To',
      isDefault: true,
      render: (disk, props) =>
        disk.machine ? (
          <div>
            {disk.type === 'root_fs' && 'Root disk of '}
            <Link to={props.machinePath(disk.machine.id)}>
              {disk.machine.name || disk.machine.slug || disk.machine.id}
            </Link>
            {disk.type === 'standard' && (
              <Text size="1" style={{ fontFamily: 'monospace' }}>
                {disk.machine.mountPath}
              </Text>
            )}
          </div>
        ) : (
          'Not attached'
        )
    },
    {
      id: 'status',
      header: 'Status',
      isDefault: false,
      render: disk => (
        <SandboxDiskStatusBadge status={disk.status} activeResize={disk.activeResize} />
      )
    },
    {
      id: 'type',
      header: 'Type',
      isDefault: false,
      render: disk => (disk.type === 'root_fs' ? 'Root Filesystem' : 'Standard')
    },
    { id: 'region', header: 'Region', isDefault: false, render: disk => disk.region },
    {
      id: 'created',
      header: 'Created',
      isDefault: false,
      render: disk => <RenderDate date={disk.createdAt} />
    },
    { id: 'id', header: 'ID', isDefault: false, render: disk => <ID id={disk.id} /> },
    {
      id: 'actions',
      header: '',
      isDefault: true,
      render: disk => (disk.status !== 'deleted' ? <SandboxDiskMenu disk={disk} /> : null)
    }
  ])
  .clickable((disk, props) => props.openDisk(disk.id))
  .build();

let SandboxDisksContent = () => {
  let instance = useCurrentInstance();
  let paths = useSandboxDiskPaths();
  let navigate = useNavigate();
  let [params, setParams] = useSearchParams();
  let filterKeys = ['search', 'type', 'machine', 'machineId', 'region', 'attached'];
  let hasFilters = filterKeys.some(key => !!params.get(key)?.trim());

  let clearFilters = () =>
    setParams(
      previous => {
        let next = new URLSearchParams(previous);
        for (let key of [...filterKeys, 'before', 'after']) next.delete(key);
        return next;
      },
      { replace: true }
    );
  let filters: TableFilter<SandboxDisk>[] = [
    {
      id: 'type',
      fields: ['type'],
      label: 'Type',
      description: 'Filter by type',
      pinned: true,
      type: 'select',
      options: [
        { id: 'standard', label: 'Standard (Default)' },
        { id: 'root_fs', label: 'Root Filesystems' },
        { id: 'all', label: 'All' }
      ]
    },
    {
      id: 'machineId',
      fields: ['machine'],
      label: 'Machine',
      description: 'Filter by machine',
      type: 'entity',
      remoteSearch: true,
      useOptions: ({ search }) => {
        let machines = useSandboxMachines(instance.data?.id, {
          search: search || undefined,
          limit: 25
        });
        return {
          items: (machines.data?.items ?? []).map(machine => ({
            id: machine.id,
            label: machine.name || machine.slug || machine.id
          })),
          isLoading: machines.isLoading
        };
      }
    },
    {
      id: 'region',
      fields: ['region'],
      label: 'Region',
      description: 'Filter by region',
      type: 'entity',
      useOptions: () => {
        let regions = useSandboxRegions(instance.data?.id);
        return {
          items: (regions.data?.items ?? []).map(region => ({
            id: region.id,
            label: region.name || region.id
          })),
          isLoading: regions.isLoading
        };
      }
    },
    {
      id: 'attached',
      fields: ['machine'],
      label: 'Attached',
      description: 'Filter by attachment',
      type: 'select',
      options: [
        { id: 'yes', label: 'Attached' },
        { id: 'no', label: 'Not Attached' }
      ]
    }
  ];

  return (
    <ContentLayout>
      <PageHeader
        title="Disks"
        description="Persistent storage that can be attached to machines."
        actions={
          <Button size="2" onClick={showSandboxCreateDiskDialog}>
            Create Disk
          </Button>
        }
      />
      {table({
        instanceId: instance.data?.id,
        diskPath: paths.disk,
        machinePath: paths.machine,
        openDisk: id => navigate(paths.disk(id)),
        tableFilters: filters,
        emptyState: () => (
          <EmptyState
            title={hasFilters ? 'No Matching Disks' : 'Create Reusable Disks'}
            description={
              hasFilters
                ? 'Adjust or clear your filters.'
                : 'Persistent storage that can be attached to machines.'
            }
            action={{
              label: hasFilters ? 'Clear Filters' : 'Create Disk',
              onClick: hasFilters ? clearFilters : showSandboxCreateDiskDialog
            }}
          />
        )
      })}
    </ContentLayout>
  );
};

export let SandboxDisksPage = () => (
  <SandboxManagedPage>
    <SandboxDisksContent />
  </SandboxManagedPage>
);
