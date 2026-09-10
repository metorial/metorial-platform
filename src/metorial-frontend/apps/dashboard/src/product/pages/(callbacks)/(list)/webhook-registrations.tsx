import { renderWithLoader } from '@metorial/data-hooks';
import { PageHeaderSection } from '@metorial/layout';
import { useCurrentInstance } from '@metorial/state';
import {
  CreateWebhookRegistrationButton,
  WebhookRegistrationsTable
} from '../../../scenes/callbacks/webhookRegistrationsTable';

export let WebhookRegistrationsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <PageHeaderSection
        title="Webhook Receivers"
        description="Some providers cannot register a webhook for you automatically. For those, create a webhook receiver here, then paste its URL into the provider's own webhook settings. If you use Metorial managed credentials, this is not necessary."
        actions={<CreateWebhookRegistrationButton instanceId={instance.data.id} />}
      >
        <WebhookRegistrationsTable instanceId={instance.data.id} />
      </PageHeaderSection>
    </>
  ));
};
