import type { DashboardInstanceIncomingWebhooksListQuery } from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  IncomingWebhookPreview,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIncomingWebhooks
} from '@metorial/state';
import {
  getConstrainedEnumListFilterValue,
  getStringFilterValue,
  Table as DashboardTable,
  TableStateProvider,
  TableStateProviderResult
} from '@metorial/table';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { getIncomingWebhookStatusColor, getIncomingWebhookStatusLabel } from './shared';

type IncomingWebhooksTableProps = {
  instanceId: string;
  filters?: Omit<
    DashboardInstanceIncomingWebhooksListQuery,
    'limit' | 'after' | 'before' | 'cursor'
  >;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let useIncomingWebhooksTableState: TableStateProvider<
  IncomingWebhooksTableProps,
  IncomingWebhookPreview,
  TableStateProviderResult<IncomingWebhookPreview>
> = (props, opts) => {
  let webhooks = useIncomingWebhooks(props.instanceId, {
    order: 'desc',
    ...props.filters,
    status: getConstrainedEnumListFilterValue(
      opts.filter.status,
      ['pending', 'failed_retrying', 'failed_final', 'succeeded'],
      props.filters?.status
    ),
    providerId: getStringFilterValue(opts.filter.providerId) ?? props.filters?.providerId,
    webhookRegistrationId:
      getStringFilterValue(opts.filter.webhookRegistrationId) ??
      props.filters?.webhookRegistrationId
  });

  return {
    isLoading: webhooks.isLoading,
    error: webhooks.error,
    hasMoreAfter: webhooks.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: webhooks.data?.pagination.hasMoreBefore ?? false,
    items: webhooks.data?.items ?? [],
    loadNext: webhooks.next,
    loadPrevious: webhooks.previous
  };
};

let incomingWebhooksTable = new DashboardTable<
  IncomingWebhooksTableProps,
  IncomingWebhookPreview
>('incoming-webhooks')
  .state(useIncomingWebhooksTableState)
  .columns([
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: webhook => (
        <Badge color={getIncomingWebhookStatusColor(webhook.status)}>
          {getIncomingWebhookStatusLabel(webhook.status)}
        </Badge>
      )
    },
    {
      id: 'providerId',
      isDefault: true,
      header: 'Provider',
      render: webhook => <ID id={webhook.providerId} copy={false} />
    },
    {
      id: 'attemptCount',
      isDefault: true,
      header: 'Attempts',
      render: webhook => <Text size="2">{webhook.attemptCount}</Text>
    },
    {
      id: 'webhookRegistrationId',
      isDefault: false,
      header: 'Registration',
      render: webhook =>
        webhook.webhookRegistrationId ? (
          <ID id={webhook.webhookRegistrationId} copy={false} />
        ) : (
          <Text size="2" color="gray600">
            Unmatched
          </Text>
        )
    },
    {
      id: 'receivedAt',
      isDefault: true,
      header: 'Received',
      render: webhook => <RenderDate date={webhook.receivedAt} />
    },
    {
      id: 'id',
      isDefault: true,
      header: 'Webhook ID',
      render: webhook => <ID id={webhook.id} />
    }
  ])
  .filters([
    {
      id: 'status',
      fields: ['status'],
      label: 'Status',
      description: 'Filter by status',
      type: 'select',
      options: [
        { id: 'pending', label: 'Pending' },
        { id: 'failed_retrying', label: 'Retrying' },
        { id: 'failed_final', label: 'Failed' },
        { id: 'succeeded', label: 'Succeeded' }
      ]
    },
    {
      id: 'providerId',
      fields: ['providerId'],
      label: 'Provider ID',
      description: 'Filter by provider ID',
      type: 'string'
    },
    {
      id: 'webhookRegistrationId',
      fields: ['webhookRegistrationId'],
      label: 'Registration ID',
      description: 'Filter by webhook registration ID',
      type: 'string'
    }
  ])
  .link((webhook, props) =>
    Paths.instance.incomingWebhook(
      props.organization.data,
      props.project.data,
      props.instance.data,
      webhook.id
    )
  )
  .build();

export let IncomingWebhooksTable = ({
  instanceId,
  filters,
  emptyState
}: {
  instanceId: string;
  filters?: IncomingWebhooksTableProps['filters'];
  emptyState?: string;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return incomingWebhooksTable({
    instanceId,
    filters,
    instance,
    organization,
    project,
    emptyState: emptyState ?? 'No inbound webhooks received yet.'
  });
};
