import type { DashboardInstanceIncomingWebhooksListQuery } from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  defineStatus,
  EmptyValue,
  f,
  withDefaults,
  type StatusDefinition
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useIncomingWebhooks } from '@metorial/state';
import { ID } from '@metorial/ui-product';
import type { ComponentProps } from 'react';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';
import {
  getIncomingWebhookStatusColor,
  getIncomingWebhookStatusLabel,
  INCOMING_WEBHOOK_STATUS_LABELS
} from './shared';

export type IncomingWebhooksFilters = Omit<
  DashboardInstanceIncomingWebhooksListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

export type IncomingWebhookStatus =
  'pending' | 'failed_retrying' | 'failed_final' | 'succeeded';

export let incomingWebhookStatus = defineStatus(
  Object.fromEntries(
    Object.keys(INCOMING_WEBHOOK_STATUS_LABELS).map(status => [
      status,
      {
        label: getIncomingWebhookStatusLabel(status),
        color: getIncomingWebhookStatusColor(status)
      }
    ])
  ) as Record<IncomingWebhookStatus, StatusDefinition>
);

let IncomingWebhooksList = createDataList<{
  instanceId?: string;
  filters?: IncomingWebhooksFilters;
}>('incoming-webhooks')
  .context(useInstanceContext)
  .filters((props, ctx) => {
    let instanceId = props.instanceId ?? ctx.instanceId;

    return {
      status: f.status(incomingWebhookStatus),
      providerId: f.entity(entityFilters.provider(instanceId)),
      webhookRegistrationId: f.entity(entityFilters.webhookRegistration(instanceId))
    };
  })
  .paginated(({ props, ctx, filters }) =>
    useIncomingWebhooks(
      props.instanceId ?? ctx.instanceId,
      withDefaults(props.filters, { order: 'desc' as const, ...filters })
    )
  )
  .columns([
    col.status(incomingWebhookStatus),
    col.refId('providerId', row => row.providerId, {
      header: 'Provider',
      isDefault: true,
      copy: false
    }),
    col.text({ id: 'attemptCount', header: 'Attempts', get: row => row.attemptCount }),
    col.custom({
      id: 'webhookRegistrationId',
      header: 'Registration',
      isDefault: false,
      render: row =>
        row.webhookRegistrationId ? (
          <ID id={row.webhookRegistrationId} copy={false} />
        ) : (
          <EmptyValue>Unmatched</EmptyValue>
        )
    }),
    col.date('receivedAt', { id: 'receivedAt', header: 'Received', isDefault: true }),
    col.id({ header: 'Webhook ID', isDefault: true })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.incomingWebhook(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

export let IncomingWebhooksTable = (props: ComponentProps<typeof IncomingWebhooksList>) => (
  <IncomingWebhooksList
    emptyState={{
      initial: 'No inbound webhooks received yet.',
      filtered: 'No inbound webhooks match your filters.'
    }}
    {...props}
  />
);
