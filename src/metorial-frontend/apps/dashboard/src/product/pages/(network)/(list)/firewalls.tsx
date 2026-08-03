import {
  DashboardInstanceFirewallsListOutput,
  DashboardInstanceFirewallsListQuery
} from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateFirewall,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useFirewalls,
  useNetworks
} from '@metorial/state';
import { Button, Dialog, Input, RenderDate, Spacer, Text, showModal } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import { Table as DashboardTable } from '@metorial/table';
import { TableStateProvider, TableStateProviderResult } from '@metorial/table';
import { statusBadge } from '../_common';
import { useNetworkManagementAccess } from '../_gate';

type Firewall = DashboardInstanceFirewallsListOutput['items'][number];

type FirewallsTableProps = DashboardInstanceFirewallsListQuery & {
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let firewallsTableState: TableStateProvider<
  FirewallsTableProps,
  Firewall,
  TableStateProviderResult<Firewall>
> = props => {
  let firewalls = useFirewalls(props.instance.data?.id, {
    order: props.order ?? 'desc'
  });

  return {
    isLoading: firewalls.isLoading,
    error: firewalls.error,
    hasMoreAfter: firewalls.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: firewalls.data?.pagination.hasMoreBefore ?? false,
    items: firewalls.data?.items ?? [],
    loadNext: firewalls.next,
    loadPrevious: firewalls.previous
  };
};

let firewallsTable = new DashboardTable<FirewallsTableProps, Firewall>('network-firewalls')
  .state(firewallsTableState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: firewall => (
        <div>
          <Text size="2" weight="strong">
            {firewall.name}
          </Text>
          {firewall.description && (
            <Text size="1" color="gray600">
              {firewall.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: firewall => statusBadge(firewall.status)
    },
    {
      id: 'policies',
      isDefault: true,
      header: 'Policies',
      render: firewall => <Text size="2">{firewall.networkPolicies.length}</Text>
    },
    {
      id: 'network',
      isDefault: true,
      header: 'Network',
      render: firewall => <ID id={firewall.networkId} />
    },
    {
      id: 'updatedAt',
      isDefault: true,
      header: 'Updated',
      render: firewall => <RenderDate date={firewall.updatedAt} />
    }
  ])
  .link((firewall, props) =>
    Paths.instance.networkFirewall(
      props.organization.data,
      props.project.data,
      props.instance.data,
      firewall.id
    )
  )
  .build();

let FirewallsTable = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let networks = useNetworks(instance.data?.id, { limit: 1 });
  let { canWrite } = useNetworkManagementAccess();

  return firewallsTable({
    organization,
    project,
    instance,
    emptyState: 'No firewalls configured.',
    headerActions: () =>
      canWrite ? (
        <Button
          size="2"
          disabled={!instance.data || !networks.data?.items[0]}
          onClick={() => {
            let network = networks.data?.items[0];
            if (!instance.data || !network) return;

            showCreateFirewallModal({
              instanceId: instance.data.id,
              networkId: network.id,
              onCreate: firewallId =>
                navigate(
                  Paths.instance.networkFirewall(
                    organization.data,
                    project.data,
                    instance.data,
                    firewallId
                  )
                )
            });
          }}
        >
          Create Firewall
        </Button>
      ) : null
  });
};

let showCreateFirewallModal = (p: {
  instanceId: string;
  networkId: string;
  onCreate: (firewallId: string) => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createFirewall = useCreateFirewall();
    let form = useForm({
      initialValues: {
        name: '',
        description: ''
      },
      onSubmit: async values => {
        let [firewall] = await createFirewall.mutate({
          instanceId: p.instanceId,
          networkId: p.networkId,
          name: values.name.trim(),
          description: values.description || undefined
        });

        if (!firewall) return;
        close();
        p.onCreate(firewall.id);
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Name is required'),
          description: yup.string()
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={620}>
        <Dialog.Title>Create Firewall</Dialog.Title>
        <Dialog.Description>Create a firewall on the default network.</Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />
          <Spacer size={12} />
          <Input label="Description" {...form.getFieldProps('description')} />
          <Spacer size={16} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button type="button" variant="outline" size="2" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="2" loading={createFirewall.isLoading}>
              Create
            </Button>
          </div>
          <createFirewall.RenderError />
        </form>
      </Dialog.Wrapper>
    );
  });

export let NetworkFirewallsPage = () => {
  let instance = useCurrentInstance();

  return (
    <>
      <FirewallsTable />
    </>
  );
};
