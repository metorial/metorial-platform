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

type Consumer = DashboardInstanceConsumersListOutput['items'][number];

type ConsumersTableProps = {
  instanceId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getConsumerType = (consumer: Consumer) => {
  if (consumer.isOrganizationMember) return 'Metorial Member';
  if (consumer.isPortalConsumer) return 'Portal Member';
  return 'Custom';
};

let useConsumersTableState = (props: ConsumersTableProps) => {
  let consumers = useConsumers(props.instanceId, { order: 'desc' });

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
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: (consumer: Consumer) => (
        <Text size="2" weight="strong">
          {consumer.name}
        </Text>
      )
    },
    {
      id: 'email',
      isDefault: true,
      header: 'Email',
      render: (consumer: Consumer) => <Text size="2">{consumer.email}</Text>
    },
    {
      id: 'type',
      isDefault: true,
      header: 'Type',
      render: (consumer: Consumer) => {
        let type = getConsumerType(consumer);
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
      render: (consumer: Consumer) => <RenderDate date={consumer.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: (consumer: Consumer) => <RenderDate date={consumer.updatedAt} />
    },
    {
      id: 'isOrganizationMember',
      isDefault: false,
      header: 'Metorial Member',
      render: (consumer: Consumer) => (
        <Text size="2">{consumer.isOrganizationMember ? 'Yes' : 'No'}</Text>
      )
    },
    {
      id: 'isPortalConsumer',
      isDefault: false,
      header: 'Portal Member',
      render: (consumer: Consumer) => (
        <Text size="2">{consumer.isPortalConsumer ? 'Yes' : 'No'}</Text>
      )
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Consumer ID',
      render: (consumer: Consumer) => <ID id={consumer.id} />
    }
  ] as any)
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
