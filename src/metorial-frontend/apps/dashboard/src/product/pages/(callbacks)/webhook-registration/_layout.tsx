import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useWebhookRegistration
} from '@metorial/state';
import { Badge, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiWebhookLine } from '@remixicon/react';
import { Outlet, useParams } from 'react-router-dom';
import {
  getWebhookRegistrationStatusColor,
  WEBHOOK_REGISTRATION_STATUS_LABELS
} from '../../../scenes/callbacks/shared';
import { showWebhookRegistrationSetup } from '../../../scenes/callbacks/webhookRegistrationsTable';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

export let WebhookRegistrationLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { webhookRegistrationId } = useParams();
  let registration = useWebhookRegistration(instance.data?.id, webhookRegistrationId);

  let registrationPath = (...subPages: string[]) =>
    Paths.instance.webhookRegistration(
      organization.data,
      project.data,
      instance.data,
      registration.data?.id ?? webhookRegistrationId,
      ...subPages
    );

  return (
    <DetailsLayout
      entity={registration.data}
      icon={<RiWebhookLine />}
      breadcrumbs={[
        {
          label: 'Webhook Registrations'
        },
        {
          label: registration.data?.name,
          to: registrationPath()
        }
      ]}
      tabs={[
        { label: 'Overview', to: registrationPath() },
        { label: 'Events', to: registrationPath('events') },
        { label: 'Settings', to: registrationPath('settings') }
      ]}
      actions={[
        {
          label: 'View Setup',
          variant: 'outline',
          disabled: !instance.data || !registration.data,
          onClick: () => {
            if (!instance.data || !registration.data) return;

            showWebhookRegistrationSetup({
              instanceId: instance.data.id,
              registration: registration.data,
              onComplete: () => void registration.refetch()
            });
          }
        }
      ]}
      attributes={
        registration.data
          ? [
              { label: 'ID', value: <ID id={registration.data.id} /> },
              {
                label: 'Status',
                value: (
                  <Badge color={getWebhookRegistrationStatusColor(registration.data.status)}>
                    {WEBHOOK_REGISTRATION_STATUS_LABELS[registration.data.status] ??
                      registration.data.status}
                  </Badge>
                )
              },
              {
                label: 'Provider',
                value: registration.data.provider.name
              },
              {
                label: 'Created',
                value: <RenderDate date={registration.data.createdAt} />
              }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ registration })(({ registration }) => (
          <>
            <DeletedRecordCallout status={registration.data.status} />
            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
