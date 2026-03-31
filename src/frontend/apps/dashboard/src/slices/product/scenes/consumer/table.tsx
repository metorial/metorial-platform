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
import { FilterPayload } from '../../../../components/table/filter';

type Consumer = DashboardInstanceConsumersListOutput['items'][number];

let getConsumerType = (consumer: Consumer) => {
  if (consumer.isOrganizationMember) return 'Metorial Member';
  if (consumer.isPortalConsumer) return 'Portal Member';
  return 'Custom';
};

let useConsumersTableState = (
  props: { instanceId: string },
  opts: { filter: Record<string, FilterPayload> }
) => {
  let consumers = useConsumers(props.instanceId, { order: 'desc' });
  let typeFilter = opts.filter.type?.value;
  let filteredItems = (consumers.data?.items ?? []).filter(consumer => {
    if (typeFilter && getConsumerType(consumer) !== typeFilter) return false;
    return true;
  });

  return {
    isLoading: consumers.isLoading,
    error: consumers.error,
    hasMoreAfter: consumers.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: consumers.data?.pagination.hasMoreBefore ?? false,
    items: filteredItems,
    loadNext: consumers.next,
    loadPrevious: consumers.previous
  };
};

let consumersTable = new DashboardTable('consumers')
  .state(useConsumersTableState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: consumer => (
        <Text size="2" weight="strong">
          {consumer.name}
        </Text>
      )
    },
    {
      id: 'email',
      isDefault: true,
      header: 'Email',
      render: consumer => <Text size="2">{consumer.email}</Text>
    },
    {
      id: 'type',
      isDefault: true,
      header: 'Type',
      render: consumer => {
        let type = getConsumerType(consumer);
        let color = type === 'Metorial Member' ? 'blue' : type === 'Portal Member' ? 'green' : 'gray';

        return <Badge color={color}>{type}</Badge>;
      }
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: consumer => <RenderDate date={consumer.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: consumer => <RenderDate date={consumer.updatedAt} />
    },
    {
      id: 'isOrganizationMember',
      isDefault: false,
      header: 'Metorial Member',
      render: consumer => <Text size="2">{consumer.isOrganizationMember ? 'Yes' : 'No'}</Text>
    },
    {
      id: 'isPortalConsumer',
      isDefault: false,
      header: 'Portal Member',
      render: consumer => <Text size="2">{consumer.isPortalConsumer ? 'Yes' : 'No'}</Text>
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Consumer ID',
      render: consumer => <ID id={consumer.id} />
    }
  ])
  .filters([
    {
      id: 'type',
      fields: ['type'],
      label: 'Type',
      description: 'Filter by consumer type',
      type: 'select',
      options: [
        { id: 'Metorial Member', label: 'Metorial Member' },
        { id: 'Portal Member', label: 'Portal Member' },
        { id: 'Custom', label: 'Custom' }
      ]
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
