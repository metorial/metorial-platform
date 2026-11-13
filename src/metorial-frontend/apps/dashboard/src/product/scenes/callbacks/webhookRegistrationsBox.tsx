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
  getConnectionWebhookRegistrationTarget,
  getDeliverySetupState,
  WEBHOOK_REGISTRATION_COPY,
  type WebhookRegistrationTarget
} from './webhookRegistrationPurpose';
import {
  CreateWebhookRegistrationButton,
  showWebhookRegistrationSetup
} from './webhookRegistrationsTable';

export let ProviderWebhookRegistrationsBox = ({
  instanceId,
  provider,
  target
}: {
  instanceId: string;
  provider: { id: string; name: string };
  target: WebhookRegistrationTarget;
}) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let registrations = useWebhookRegistrations(instanceId, {
    order: 'desc',
    providerId: provider.id,
    authCredentialsId:
      target.purpose === 'delivery_setup' ? target.authCredentialsId : undefined
  });
  let copy = WEBHOOK_REGISTRATION_COPY[target.purpose];

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
              target={target}
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
                    <Badge
                      color="orange"
                      size="2"
                      style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      Awaiting Setup
                    </Badge>
                  )}

                  {registration.status === 'active' && copy.activeBadge && (
                    <Badge
                      color="blue"
                      size="2"
                      style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
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

export let CallbackWebhookRegistrationsBox = ({
  instanceId,
  providerId,
  authCredentialsId,
  authCredentialsIsManaged
}: {
  instanceId: string;
  providerId: string;
  authCredentialsId: string | null;
  authCredentialsIsManaged: boolean;
}) => {
  let provider = useProvider(instanceId, authCredentialsIsManaged ? null : providerId);

  if (authCredentialsIsManaged) return null;

  return renderWithLoader({ provider })(({ provider }) => {
    let target = getConnectionWebhookRegistrationTarget({
      triggers: provider.data.type.triggers,
      authCredentialsId,
      authCredentialsIsManaged
    });

    if (!target) return null;

    return (
      <ProviderWebhookRegistrationsBox
        instanceId={instanceId}
        provider={{ id: providerId, name: provider.data.name }}
        target={target}
      />
    );
  });
};

export let CallbackDeliverySetupCallout = ({
  instanceId,
  providerId,
  authCredentialsId,
  authCredentialsIsManaged
}: {
  instanceId: string;
  providerId: string;
  authCredentialsId: string | null;
  authCredentialsIsManaged: boolean;
}) => {
  let provider = useProvider(instanceId, authCredentialsIsManaged ? null : providerId);
  let target = getConnectionWebhookRegistrationTarget({
    triggers: provider.data?.type.triggers,
    authCredentialsId,
    authCredentialsIsManaged
  });
  let deliverySetup = target?.purpose === 'delivery_setup' ? target : null;
  let registrations = useWebhookRegistrations(deliverySetup ? instanceId : null, {
    order: 'desc',
    providerId,
    authCredentialsId: deliverySetup?.authCredentialsId
  });

  if (!deliverySetup || !provider.data || !registrations.data) return null;

  let state = getDeliverySetupState(registrations.data.items);
  if (state.status === 'complete') return null;

  let pending = state.pending;
  let onChange = () => void registrations.refetch();

  return (
    <>
      <Callout color="orange">
        <Flex align="center" justify="space-between" gap={12}>
          <span>
            <strong>Delivery is not set up.</strong> This connection uses your own OAuth app.
            Finish the delivery setup to receive events.
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
              target={deliverySetup}
              onCreate={onChange}
            />
          )}
        </Flex>
      </Callout>

      <Spacer height={20} />
    </>
  );
};
