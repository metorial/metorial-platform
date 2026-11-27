import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsTableLayout } from '@metorial/details-layout';
import { useCurrentInstance, useWebhookRegistration } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { IncomingWebhooksTable } from '../../../scenes/callbacks/incomingWebhooksTable';

export let WebhookRegistrationEventsPage = () => {
  let instance = useCurrentInstance();
  let { webhookRegistrationId } = useParams();
  let registration = useWebhookRegistration(instance.data?.id, webhookRegistrationId);

  return renderWithLoader({ registration })(({ registration }) => (
    <DetailsTableLayout
      title="Events"
      description="Inbound webhooks received by this receiver, newest first."
    >
      <IncomingWebhooksTable
        instanceId={instance.data!.id}
        filters={{ webhookRegistrationId: registration.data.id }}
        emptyState="No inbound webhooks have been received on this receiver yet."
      />
    </DetailsTableLayout>
  ));
};
