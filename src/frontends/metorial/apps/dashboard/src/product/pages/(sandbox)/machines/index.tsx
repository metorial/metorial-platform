import { col, createDataList, defineAction, f } from '@metorial/data-list';
import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useDeleteSandboxMachineFromList,
  usePauseSandboxMachineFromList,
  useSandboxMachines,
  useSandboxRegions,
  useStartSandboxMachineFromList,
  type DashboardInstanceSandboxMachinesListOutput
} from '@metorial/state';
import { Button, Flex, Text, useCopy } from '@metorial/ui';
import {
  RiCodeBoxLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiPauseLine,
  RiPlayLine
} from '@remixicon/react';
import { useNavigate } from 'react-router-dom';
import { useInstanceContext } from '../../../lib/dataList';
import { entityFilters } from '../../../scenes/entityFilters';
import { showSandboxCreateMachinePanel } from '../../../scenes/sandbox/createMachinePanel';
import { SandboxImageLogo } from '../../../scenes/sandbox/shared/imageLogo';
import { SandboxMachineStatusBadge } from '../../../scenes/sandbox/shared/statusBadges';
import { SandboxManagedPage, useSandboxAccess } from '../_gate';

type Machine = DashboardInstanceSandboxMachinesListOutput['items'][number];

let machineLifecycleStatuses = [
  { id: 'active', label: 'Active' },
  { id: 'deleted', label: 'Deleted' }
] as const;

let runtimeStates = [
  'running',
  'paused',
  'hibernated',
  'failed',
  'starting',
  'pausing',
  'resuming',
  'hibernating',
  'restarting',
  'upgrading',
  'terminating'
] as const;

let machineName = (machine: Machine) => machine.name || machine.slug;

let isTerminated = (machine: Machine) => machine.status === 'terminated';

let throwIfFailed = (result: unknown) => {
  if (Array.isArray(result) && result[1]) throw result[1];
};

let MachinesTable = createDataList('sandbox-machines')
  .context(useInstanceContext)
  .filters((_props, ctx) => ({
    status: f.select('status', 'Status', machineLifecycleStatuses),
    state: f.select(
      'state',
      'Runtime Status',
      runtimeStates.map(id => ({ id, label: id[0]!.toUpperCase() + id.slice(1) })),
      { description: 'Filter by runtime status' }
    ),
    imageId: f.entity(entityFilters.sandboxImage(ctx.instanceId, { id: 'image_id' })),
    region: f.entity({
      id: 'region',
      fields: ['region'],
      label: 'Region',
      description: 'Filter by region',
      type: 'entity',
      remoteSearch: true,
      useOptions: () => {
        let regions = useSandboxRegions(ctx.instanceId);
        return {
          items: (regions.data?.items ?? []).map(r => ({ id: r.id, label: r.name })),
          isLoading: regions.isLoading
        };
      }
    })
  }))
  .search('Search machines…')
  .paginated(({ ctx, filters, search }) =>
    useSandboxMachines(
      ctx.instanceId,
      {
        order: 'desc',
        search,
        status: filters.status ?? 'active',
        state: filters.state,
        imageId: filters.imageId,
        region: filters.region
      },
      { pollInterval: 8000 }
    )
  )
  .columns([
    col.name<Machine>({
      get: machineName,
      fallback: 'Untitled machine',
      description: machine => machine.slug
    }),
    col.custom<Machine>({
      id: 'status',
      header: 'Status',
      render: machine => <SandboxMachineStatusBadge status={machine.status} />
    }),
    col.custom<Machine>({
      id: 'image',
      header: 'Image',
      render: machine => (
        <Flex gap={8} align="center">
          <SandboxImageLogo image={machine.image} />
          <Text size="2">
            {machine.image.name || machine.image.identifier || machine.image.id || '—'}
          </Text>
        </Flex>
      )
    }),
    col.text<Machine>({
      id: 'size',
      header: 'Size',
      get: machine =>
        machine.spec ? `${machine.spec.cpus} vCPU · ${machine.spec.memoryGib} GiB` : undefined
    }),
    col.text<Machine>({
      id: 'region',
      header: 'Region',
      isDefault: false,
      get: machine => machine.region
    }),
    col.date<Machine>('lastActivityAt', {
      id: 'activity',
      header: 'Last Activity',
      isDefault: false
    }),
    col.createdAt<Machine>(),
    col.id<Machine>()
  ])
  .link((machine, _props, ctx) =>
    Paths.instance.sandboxMachine(ctx.organization, ctx.project, ctx.instance, machine.id)
  )
  .itemActions([
    defineAction<Machine>({
      id: 'terminal',
      label: 'Open Terminal',
      icon: <RiCodeBoxLine />,
      disabled: isTerminated,
      useRun: ({ ctx }) => {
        let navigate = useNavigate();

        return machine =>
          navigate(
            Paths.instance.sandboxMachine(
              ctx.organization,
              ctx.project,
              ctx.instance,
              machine.id,
              'terminal'
            )
          );
      }
    }),
    defineAction<Machine>({
      id: 'pause',
      label: 'Pause',
      icon: <RiPauseLine />,
      hidden: machine => machine.status !== 'running',
      disabled: machine => !!machine.operation,
      useRun: ({ ctx }) => {
        let pause = usePauseSandboxMachineFromList();

        return async machine =>
          throwIfFailed(
            await pause.mutate({ instanceId: ctx.instanceId!, machineId: machine.id })
          );
      }
    }),
    defineAction<Machine>({
      id: 'start',
      label: 'Start',
      icon: <RiPlayLine />,
      hidden: machine => machine.status === 'running',
      disabled: machine => isTerminated(machine) || !!machine.operation,
      useRun: ({ ctx }) => {
        let start = useStartSandboxMachineFromList();

        return async machine =>
          throwIfFailed(
            await start.mutate({ instanceId: ctx.instanceId!, machineId: machine.id })
          );
      }
    }),
    defineAction<Machine>({
      id: 'copy',
      label: 'Copy ID',
      icon: <RiFileCopyLine />,
      useRun: () => {
        let copy = useCopy();

        return machine => copy.copy(machine.id);
      }
    }),
    defineAction<Machine>({
      id: 'delete',
      label: 'Delete Machine',
      icon: <RiDeleteBinLine />,
      destructive: true,
      disabled: isTerminated,
      confirm: {
        title: 'Delete Machine',
        confirmText: 'Delete Machine',
        description: rows =>
          `Delete ${rows[0] ? machineName(rows[0]) || 'this machine' : 'this machine'} and its root disk? Standard disks will be detached.`
      },
      useRun: ({ ctx }) => {
        let remove = useDeleteSandboxMachineFromList();

        return async machine =>
          throwIfFailed(
            await remove.mutate({ instanceId: ctx.instanceId!, machineId: machine.id })
          );
      }
    })
  ])
  .build();

let MachinesEmptyState = () => (
  <EmptyState
    title="Create Your First Sandbox"
    description="Give agents access to a virtual machine to run code and programs."
    action={{ label: 'Create Machine', onClick: () => showSandboxCreateMachinePanel() }}
  />
);

let MachinesContent = () => (
  <MachinesTable
    emptyState={{
      initial: () => <MachinesEmptyState />,
      filtered: 'No machines match these filters.'
    }}
  />
);

export let SandboxMachinesPage = () => {
  let access = useSandboxAccess();

  return (
    <ContentLayout>
      <PageHeader
        title="Machines"
        description="Isolated virtual machines that run code, programs, and agents."
        actions={
          <Button
            size="2"
            disabled={!access.canWrite}
            onClick={() => showSandboxCreateMachinePanel()}
          >
            Create Machine
          </Button>
        }
      />
      <SandboxManagedPage>
        <MachinesContent />
      </SandboxManagedPage>
    </ContentLayout>
  );
};
