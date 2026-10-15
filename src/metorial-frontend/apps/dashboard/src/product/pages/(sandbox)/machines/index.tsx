import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteSandboxMachineFromList,
  usePauseSandboxMachineFromList,
  useSandboxImages,
  useSandboxMachines,
  useSandboxRegions,
  useStartSandboxMachineFromList,
  type DashboardInstanceSandboxMachinesListOutput,
  type DashboardInstanceSandboxMachinesListQuery
} from '@metorial/state';
import {
  Table as DashboardTable,
  type FilterPayload,
  type TableStateProviderResult
} from '@metorial/table';
import { Button, Flex, RenderDate, Text, confirm, useCopy } from '@metorial/ui';
import {
  RiCodeBoxLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiPauseLine,
  RiPlayLine
} from '@remixicon/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { showSandboxCreateMachinePanel } from '../../../scenes/sandbox/createMachinePanel';
import { SandboxImageLogo } from '../../../scenes/sandbox/shared/imageLogo';
import { SandboxMachineStatusBadge } from '../../../scenes/sandbox/shared/statusBadges';
import { SandboxManagedPage, useSandboxAccess } from '../_gate';

type Machine = DashboardInstanceSandboxMachinesListOutput['items'][number];

type Props = {
  instanceId?: string;
  path: (id: string, ...parts: string[]) => string;
  start: ReturnType<typeof useStartSandboxMachineFromList>;
  pause: ReturnType<typeof usePauseSandboxMachineFromList>;
  remove: ReturnType<typeof useDeleteSandboxMachineFromList>;
};

let values = (value: FilterPayload | undefined): string[] | undefined =>
  Array.isArray(value) ? (value as string[]) : typeof value === 'string' ? [value] : undefined;

let MachinesTable = new DashboardTable<Props, Machine>('sandbox-machines')
  .state<Props, Machine, TableStateProviderResult<Machine>>(
    (props: Props, { filter, search }): TableStateProviderResult<Machine> => {
      let query: DashboardInstanceSandboxMachinesListQuery = {
        order: 'desc',
        search,
        status:
          (values(filter.status) as DashboardInstanceSandboxMachinesListQuery['status']) ||
          'active',
        state: values(filter.state) as DashboardInstanceSandboxMachinesListQuery['state'],
        imageId: values(filter.image_id),
        region: values(filter.region)
      };
      let machines = useSandboxMachines(props.instanceId, query, { pollInterval: 8000 });
      return {
        items: machines.data?.items ?? [],
        isLoading: machines.isLoading,
        error: machines.error,
        hasMoreBefore: machines.data?.pagination.hasMoreBefore ?? false,
        hasMoreAfter: machines.data?.pagination.hasMoreAfter ?? false,
        loadNext: machines.next,
        loadPrevious: machines.previous
      };
    }
  )
  .columns([
    {
      id: 'name',
      header: 'Name',
      isDefault: true,
      render: m => (
        <div>
          <Text size="2" weight="strong">
            {m.name || m.slug || 'Untitled machine'}
          </Text>
          <Text size="1" style={{ fontFamily: 'monospace' }}>
            {m.slug}
          </Text>
        </div>
      )
    },
    {
      id: 'status',
      header: 'Status',
      isDefault: true,
      render: m => (
        <div>
          <SandboxMachineStatusBadge status={m.status} />
        </div>
      )
    },
    {
      id: 'image',
      header: 'Image',
      isDefault: true,
      render: m => (
        <Flex gap={8} align="center">
          <SandboxImageLogo image={m.image} />
          <Text size="2">{m.image.name || m.image.identifier || m.image.id || '—'}</Text>
        </Flex>
      )
    },
    {
      id: 'size',
      header: 'Size',
      isDefault: true,
      render: m => (m.spec ? `${m.spec.cpus} vCPU · ${m.spec.memoryGib} GiB` : '—')
    },
    { id: 'region', header: 'Region', isDefault: false, render: m => m.region },
    {
      id: 'activity',
      header: 'Last Activity',
      isDefault: false,
      render: m => (m.lastActivityAt ? <RenderDate date={m.lastActivityAt} /> : '—')
    },
    {
      id: 'created',
      header: 'Created',
      isDefault: false,
      render: m => <RenderDate date={m.createdAt} />
    },
    {
      id: 'id',
      header: 'ID',
      isDefault: false,
      render: m => (
        <Text size="1" style={{ fontFamily: 'monospace' }}>
          {m.id}
        </Text>
      )
    }
  ])
  .search('Search machines...')
  .link((m, p) => p.path(m.id))
  .hookState((_state, props) => ({
    ...props,
    copy: useCopy(),
    navigate: useNavigate()
  }))
  .actions({
    terminal: async (rows, state) => {
      let machine = rows[0];
      if (machine && machine.status !== 'terminated')
        state.navigate(state.path(machine.id, 'terminal'));
    },
    copy: async (rows, state) => {
      let machine = rows[0];
      if (machine) state.copy.copy(machine.id);
    },
    lifecycle: async (rows, state) => {
      let machine = rows[0];
      if (
        !machine ||
        !state.instanceId ||
        machine.status === 'terminated' ||
        machine.operation ||
        state.start.isLoading ||
        state.pause.isLoading ||
        state.remove.isLoading
      )
        return;

      await (machine.status === 'running' ? state.pause : state.start).mutate({
        instanceId: state.instanceId,
        machineId: machine.id
      });
    },
    delete: async (rows, state) => {
      let machine = rows[0];
      if (
        !machine ||
        !state.instanceId ||
        machine.status === 'terminated' ||
        state.start.isLoading ||
        state.pause.isLoading ||
        state.remove.isLoading
      )
        return;

      confirm({
        title: 'Delete Machine',
        description: `Delete ${machine.name || machine.slug || 'this machine'} and its root disk? Standard disks will be detached.`,
        confirmText: 'Delete Machine',
        onConfirm: async () => {
          await state.remove.mutate({ instanceId: state.instanceId!, machineId: machine.id });
        }
      });
    }
  })
  .rowActions([
    {
      id: 'terminal',
      label: 'Open Terminal',
      icon: <RiCodeBoxLine />,
      disabled: machine => machine.status === 'terminated',
      action: 'terminal'
    },
    {
      id: 'pause',
      label: 'Pause',
      icon: <RiPauseLine />,
      hidden: machine => machine.status !== 'running',
      disabled: machine => !!machine.operation,
      action: 'lifecycle'
    },
    {
      id: 'start',
      label: 'Start',
      icon: <RiPlayLine />,
      hidden: machine => machine.status === 'running',
      disabled: machine => machine.status === 'terminated' || !!machine.operation,
      action: 'lifecycle'
    },
    { id: 'copy', label: 'Copy ID', icon: <RiFileCopyLine />, action: 'copy' },
    {
      id: 'delete',
      label: 'Delete Machine',
      icon: <RiDeleteBinLine />,
      disabled: machine => machine.status === 'terminated',
      action: 'delete'
    }
  ])
  .build();

let MachinesEmptyState = () => {
  let [params, setParams] = useSearchParams();
  let keys = ['search', 'state', 'image_id', 'region'];
  let filtered =
    keys.some(key => !!params.get(key)) ||
    (!!params.get('status') && params.get('status') !== 'active');
  return (
    <EmptyState
      title={filtered ? 'No Matching Machines' : 'Create Your First Sandbox'}
      description={
        filtered
          ? 'Adjust or clear your filters.'
          : 'Give agents access to a virtual machine to run code and programs.'
      }
      action={{
        label: filtered ? 'Clear Filters' : 'Create Machine',
        onClick: () => {
          if (!filtered) {
            showSandboxCreateMachinePanel();
            return;
          }

          let next = new URLSearchParams(params);
          for (let key of [...keys, 'status', 'after', 'before']) next.delete(key);
          setParams(next);
        }
      }}
    />
  );
};

let MachinesContent = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let start = useStartSandboxMachineFromList();
  let pause = usePauseSandboxMachineFromList();
  let remove = useDeleteSandboxMachineFromList();

  let path = (id: string, ...parts: string[]) =>
    Paths.instance.sandboxMachine(
      organization.data,
      project.data,
      instance.data,
      id,
      ...parts
    );
  return (
    <>
      <start.RenderError />
      <pause.RenderError />
      <remove.RenderError />
      <MachinesTable
        start={start}
        pause={pause}
        remove={remove}
        instanceId={instance.data?.id}
        path={path}
        tableFilters={[
          {
            id: 'status',
            fields: ['status'],
            label: 'Status',
            description: 'Filter by status',
            type: 'select',
            options: [
              { id: 'active', label: 'Active' },
              { id: 'deleted', label: 'Deleted' }
            ]
          },
          {
            id: 'state',
            fields: ['status'],
            label: 'Runtime Status',
            description: 'Filter by runtime status',
            type: 'select',
            options: [
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
            ].map(id => ({ id, label: id[0].toUpperCase() + id.slice(1) }))
          },
          {
            id: 'image_id',
            fields: ['image'],
            label: 'Image',
            description: 'Filter by image',
            type: 'entity',
            remoteSearch: true,
            useOptions: ({ search }) => {
              let images = useSandboxImages(instance.data?.id, {
                search,
                status: ['active', 'pending'],
                limit: 25
              });
              return {
                items: (images.data?.items ?? []).map(i => ({
                  id: i.id,
                  label: i.name || i.identifier || i.id
                })),
                isLoading: images.isLoading
              };
            }
          },
          {
            id: 'region',
            fields: ['region'],
            label: 'Region',
            description: 'Filter by region',
            type: 'entity',
            remoteSearch: true,
            useOptions: () => {
              let regions = useSandboxRegions(instance.data?.id);
              return {
                items: (regions.data?.items ?? []).map(r => ({ id: r.id, label: r.name })),
                isLoading: regions.isLoading
              };
            }
          }
        ]}
        emptyState={() => <MachinesEmptyState />}
      />
    </>
  );
};

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
