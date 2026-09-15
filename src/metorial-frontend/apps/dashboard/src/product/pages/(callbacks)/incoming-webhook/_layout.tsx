import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIncomingWebhook,
  useWebhookRegistration
} from '@metorial/state';
import { Badge, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Link, Outlet, useParams } from 'react-router-dom';
import {
  getIncomingWebhookStatusColor,
  getIncomingWebhookStatusLabel
} from '../../../scenes/callbacks/shared';

export let IncomingWebhookLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { incomingWebhookId } = useParams();
  let webhook = useIncomingWebhook(instance.data?.id, incomingWebhookId);
  let registration = useWebhookRegistration(
    instance.data?.id,
    webhook.data?.webhookRegistrationId
  );

  return (
    <DetailsLayout
      entity={webhook.data ? { ...webhook.data, name: 'Incoming Webhook' } : webhook.data}
      breadcrumbs={[
        {
          label: 'Webhook Receivers',
          to: Paths.instance.webhookRegistrations(
            organization.data,
            project.data,
            instance.data
          )
        },

        ...(!webhook.data || webhook.data?.webhookRegistrationId
          ? [
              {
                label: registration.data?.name ?? 'Receiver',
                to: Paths.instance.webhookRegistration(
                  organization.data,
                  project.data,
                  instance.data,
                  webhook.data?.webhookRegistrationId ?? registration.data?.id
                )
              }
            ]
          : []),

        {
          label: webhook.data
            ? getIncomingWebhookStatusLabel(webhook.data.status)
            : 'Incoming Webhook',
          to: Paths.instance.incomingWebhook(
            organization.data,
            project.data,
            instance.data,
            webhook.data?.id ?? incomingWebhookId
          )
        }
      ]}
      attributes={
        webhook.data
          ? [
              { label: 'Event ID', value: <ID id={webhook.data.id} /> },
              {
                label: 'Status',
                value: (
                  <Badge color={getIncomingWebhookStatusColor(webhook.data.status)}>
                    {getIncomingWebhookStatusLabel(webhook.data.status)}
                  </Badge>
                )
              },
              { label: 'Attempts', value: webhook.data.attemptCount },
              { label: 'Provider', value: <ID id={webhook.data.providerId} /> },
              ...(webhook.data.webhookRegistrationId
                ? [
                    {
                      label: 'Receiver',
                      value: (
                        <Link
                          to={Paths.instance.webhookRegistration(
                            organization.data,
                            project.data,
                            instance.data,
                            webhook.data.webhookRegistrationId
                          )}
                        >
                          <ID id={webhook.data.webhookRegistrationId} copy={false} />
                        </Link>
                      )
                    }
                  ]
                : []),
              {
                label: 'Received',
                value: <RenderDate date={webhook.data.receivedAt} />
              }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ webhook })(() => (
          <Outlet />
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
