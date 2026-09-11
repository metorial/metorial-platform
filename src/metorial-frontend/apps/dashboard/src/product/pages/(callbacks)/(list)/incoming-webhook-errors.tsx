import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { IncomingWebhooksTable } from '../../../scenes/callbacks/incomingWebhooksTable';
import { INCOMING_WEBHOOK_ERROR_STATUSES } from '../../../scenes/callbacks/shared';

export let IncomingWebhookErrorsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <IncomingWebhooksTable
      instanceId={instance.data.id}
      filters={{ status: [...INCOMING_WEBHOOK_ERROR_STATUSES] }}
      emptyState="No inbound webhooks have failed."
    />
  ));
};
