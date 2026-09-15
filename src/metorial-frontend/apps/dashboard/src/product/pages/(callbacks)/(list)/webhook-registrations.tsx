import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { PageHeaderSection } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useNavigate } from 'react-router-dom';
import {
  CreateWebhookRegistrationButton,
  WebhookRegistrationsTable
} from '../../../scenes/callbacks/webhookRegistrationsTable';

export let WebhookRegistrationsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <PageHeaderSection
        title="Webhook Receivers"
        description="Some providers cannot register a webhook for you automatically. For those, create a webhook receiver here, then paste its URL into the provider's own webhook settings. If you use Metorial managed credentials, this is not necessary."
        actions={
          <CreateWebhookRegistrationButton
            instanceId={instance.data.id}
            onCreate={created =>
              navigate(
                Paths.instance.webhookRegistration(
                  organization.data,
                  project.data,
                  instance.data,
                  created.id
                )
              )
            }
          />
        }
      >
        <WebhookRegistrationsTable instanceId={instance.data.id} />
      </PageHeaderSection>
    </>
  ));
};
