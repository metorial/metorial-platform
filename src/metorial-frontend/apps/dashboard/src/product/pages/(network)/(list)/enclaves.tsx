import {
  DashboardInstanceEnclavesListOutput,
  DashboardInstanceEnclavesListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useEnclaves
} from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '@metorial/table';
import { TableStateProvider, TableStateProviderResult } from '@metorial/table';

type Enclave = DashboardInstanceEnclavesListOutput['items'][number];

type EnclavesTableProps = DashboardInstanceEnclavesListQuery & {
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let enclavesTableState: TableStateProvider<
  EnclavesTableProps,
  Enclave,
  TableStateProviderResult<Enclave>
> = props => {
  let enclaves = useEnclaves(props.instance.data?.id, {
    order: props.order ?? 'desc'
  });

  return {
    isLoading: enclaves.isLoading,
    error: enclaves.error,
    hasMoreAfter: enclaves.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: enclaves.data?.pagination.hasMoreBefore ?? false,
    items: enclaves.data?.items ?? [],
    loadNext: enclaves.next,
    loadPrevious: enclaves.previous
  };
};

let enclavesTable = new DashboardTable<EnclavesTableProps, Enclave>('network-enclaves')
  .state(enclavesTableState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: enclave => (
        <div>
          <Text size="2" weight="strong">
            {enclave.name}
          </Text>
          {enclave.description && (
            <Text size="1" color="gray600">
              {enclave.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'environment',
      isDefault: true,
      header: 'Environment',
      render: enclave => <Text size="2">{enclave.enclaveEnvironment.name}</Text>
    },
    {
      id: 'network',
      isDefault: true,
      header: 'Network',
      render: enclave => <ID id={enclave.networkId} />
    },
    {
      id: 'lastUsedAt',
      isDefault: true,
      header: 'Last Used',
      render: enclave => (enclave.lastUsedAt ? <RenderDate date={enclave.lastUsedAt} /> : '-')
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: enclave => <RenderDate date={enclave.createdAt} />
    }
  ])
  .link((enclave, props) =>
    Paths.instance.providerDeployment(
      props.organization.data,
      props.project.data,
      props.instance.data,
      enclave.providerDeploymentId,
      'network'
    )
  )
  .build();

export let NetworkEnclavesPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  return enclavesTable({
    organization,
    project,
    instance,
    emptyState: 'No enclaves found.'
  });
};
