import { DashboardInstanceConsumersListOutput } from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useConsumers,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '../../../../components/table';
import {
  TableStateProvider,
  TableStateProviderResult
} from '../../../../components/table/type';

type Consumer = DashboardInstanceConsumersListOutput['items'][number];
type ConsumersTableProps = {
  instanceId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let useConsumersTableState: TableStateProvider<
  ConsumersTableProps,
  Consumer,
  TableStateProviderResult<Consumer>
> = (props, opts) => {
  let consumers = useConsumers(props.instanceId, {
    order: 'desc',
    search: opts.search
  });

  return {
    isLoading: consumers.isLoading,
    error: consumers.error,
    hasMoreAfter: consumers.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: consumers.data?.pagination.hasMoreBefore ?? false,
    items: consumers.data?.items ?? [],
    loadNext: consumers.next,
    loadPrevious: consumers.previous
  };
};

let consumersTable = new DashboardTable<ConsumersTableProps, Consumer>('consumers')
  .state(useConsumersTableState)
  .search('Search consumers...')
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: (consumer, _input) => (
        <Text size="2" weight="strong">
          {consumer.name}
        </Text>
      )
    },
    {
      id: 'email',
      isDefault: true,
      header: 'Email',
      render: (consumer, _input) => <Text size="2">{consumer.email}</Text>
    },
    {
      id: 'type',
      isDefault: true,
      header: 'Type',
      render: (consumer, _input) => {
        let type = consumer.isOrganizationMember
          ? 'Metorial Member'
          : consumer.isPortalConsumer
            ? 'Portal Member'
            : 'Custom';
        let color =
          type === 'Metorial Member'
            ? ('blue' as const)
            : type === 'Portal Member'
              ? ('green' as const)
              : ('gray' as const);

        return <Badge color={color}>{type}</Badge>;
      }
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: (consumer, _input) => <RenderDate date={consumer.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: (consumer, _input) => <RenderDate date={consumer.updatedAt} />
    },
    {
      id: 'isOrganizationMember',
      isDefault: false,
      header: 'Metorial Member',
      render: (consumer, _input) => (
        <Text size="2">{consumer.isOrganizationMember ? 'Yes' : 'No'}</Text>
      )
    },
    {
      id: 'isPortalConsumer',
      isDefault: false,
      header: 'Portal Member',
      render: (consumer, _input) => (
        <Text size="2">{consumer.isPortalConsumer ? 'Yes' : 'No'}</Text>
      )
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Consumer ID',
      render: (consumer, _input) => <ID id={consumer.id} />
    }
  ])
  .link((consumer, props) =>
    Paths.instance.identity.consumer(
      props.organization.data,
      props.project.data,
      props.instance.data,
      consumer.id
    )
  )
  .build();

export let ConsumersTable = ({ instanceId }: { instanceId: string }) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return consumersTable({
    instanceId,
    instance,
    organization,
    project,
    emptyState: 'No consumers found.'
  });
};
