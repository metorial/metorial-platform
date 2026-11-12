import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProvider,
  useWebhookRegistrations
} from '@metorial/state';
import { Badge, Button, Callout, Flex, Spacer, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { truncateReceiverUrl } from './shared';
import {
  getConnectionWebhookRegistrationPurpose,
  getDeliverySetupState,
  getWebhookRegistrationPurpose,
  WEBHOOK_REGISTRATION_COPY,
  type WebhookRegistrationPurpose
} from './webhookRegistrationPurpose';
import {
  CreateWebhookRegistrationButton,
  showWebhookRegistrationSetup
} from './webhookRegistrationsTable';

export let ProviderWebhookRegistrationsBox = ({
  instanceId,
  provider,
  purpose = 'webhook_receiver'
}: {
  instanceId: string;
  provider: { id: string; name: string };
  purpose?: WebhookRegistrationPurpose;
}) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let registrations = useWebhookRegistrations(instanceId, {
    order: 'desc',
    providerId: provider.id
  });
  let copy = WEBHOOK_REGISTRATION_COPY[purpose];

  let onCreate = () => void registrations.refetch();

  return (
    <>
      <Box
        title={copy.boxTitle}
        description={copy.boxDescription(provider.name)}
        rightActions={
          registrations.data && !registrations.data.items.length ? (
            <CreateWebhookRegistrationButton
              instanceId={instanceId}
              provider={provider}
              purpose={purpose}
              onCreate={onCreate}
            />
          ) : undefined
        }
      >
        {renderWithPagination(registrations, {
          hidePaginationWhenUnavailable: true,
          emptyState: (
            <>
              <Callout color="orange">
                <div>
                  <Text size="2" weight="strong">
                    {copy.emptyTitle}
                  </Text>
                  <Spacer size={4} />
                  <Text size="2">{copy.emptyText(provider.name)}</Text>
                </div>
              </Callout>
            </>
          )
        })(registrations => (
          <Table
            headers={copy.tableHeaders}
            data={registrations.data.items.map(registration => ({
              href: Paths.instance.webhookRegistration(
                organization.data,
                project.data,
                instance.data,
                registration.id
              ),
              data: [
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{registration.name}</span>

                  {registration.status === 'awaiting_setup' && (
                    <Badge color="orange" size="2">
                      Awaiting Setup
                    </Badge>
                  )}

                  {registration.status === 'active' && copy.activeBadge && (
                    <Badge color="blue" size="2">
                      {copy.activeBadge}
                    </Badge>
                  )}
                </div>,

                registration.receiveUrl ? (
                  <Text size="2" style={{ fontFamily: 'jetbrains mono, monospace' }}>
                    {truncateReceiverUrl(registration.receiveUrl)}
                  </Text>
                ) : (
                  <Text size="2" color="gray600">
                    Not provisioned
                  </Text>
                )
              ]
            }))}
          />
        ))}
      </Box>

      <Spacer height={20} />
    </>
  );
};

// A registration only carries a preview of its provider, so its wording needs the provider.
export let useWebhookRegistrationCopy = (
  instanceId: string | null | undefined,
  providerId: string | null | undefined
) => {
  let provider = useProvider(instanceId, providerId);
  let purpose = getWebhookRegistrationPurpose(provider.data?.type.triggers);

  return { provider, copy: WEBHOOK_REGISTRATION_COPY[purpose ?? 'webhook_receiver'] };
};

export let CallbackWebhookRegistrationsBox = ({
  instanceId,
  providerId,
  authCredentialsIsManaged
}: {
  instanceId: string;
  providerId: string;
  authCredentialsIsManaged: boolean;
}) => {
  let provider = useProvider(instanceId, authCredentialsIsManaged ? null : providerId);

  if (authCredentialsIsManaged) return null;

  return renderWithLoader({ provider })(({ provider }) => {
    let purpose = getConnectionWebhookRegistrationPurpose({
      triggers: provider.data.type.triggers,
      authCredentialsIsManaged
    });

    if (!purpose) return null;

    return (
      <ProviderWebhookRegistrationsBox
        instanceId={instanceId}
        provider={{ id: providerId, name: provider.data.name }}
        purpose={purpose}
      />
    );
  });
};

export let CallbackDeliverySetupCallout = ({
  instanceId,
  providerId,
  authCredentialsIsManaged
}: {
  instanceId: string;
  providerId: string;
  authCredentialsIsManaged: boolean;
}) => {
  let provider = useProvider(instanceId, authCredentialsIsManaged ? null : providerId);
  let needsDeliverySetup =
    getConnectionWebhookRegistrationPurpose({
      triggers: provider.data?.type.triggers,
      authCredentialsIsManaged
    }) === 'delivery_setup';
  let registrations = useWebhookRegistrations(needsDeliverySetup ? instanceId : null, {
    order: 'desc',
    providerId
  });

  if (!needsDeliverySetup || !provider.data || !registrations.data) return null;

  if (getDeliverySetupState(registrations.data.items) === 'complete') return null;

  let pending = registrations.data.items.find(
    registration => registration.status === 'awaiting_setup'
  );
  let onChange = () => void registrations.refetch();

  return (
    <>
      <Callout color="orange">
        <Flex align="center" justify="space-between" gap={12}>
          <span>
            <strong>Delivery is not set up.</strong> This connection uses your own Google OAuth
            app. Finish the delivery setup to receive events.
          </span>

          {pending ? (
            <Button
              size="2"
              onClick={() =>
                showWebhookRegistrationSetup({
                  instanceId,
                  registration: pending,
                  onComplete: onChange
                })
              }
            >
              Finish Setup
            </Button>
          ) : (
            <CreateWebhookRegistrationButton
              instanceId={instanceId}
              provider={{ id: providerId, name: provider.data.name }}
              purpose="delivery_setup"
              onCreate={onChange}
            />
          )}
        </Flex>
      </Callout>

      <Spacer height={20} />
    </>
  );
};
