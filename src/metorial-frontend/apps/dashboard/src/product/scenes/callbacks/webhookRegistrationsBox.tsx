import { renderWithLoader } from '@metorial/data-hooks';
import { col, createDataList, EmptyValue, StatusBadge } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useProvider, useWebhookRegistrations } from '@metorial/state';
import { Badge, Button, Callout, Flex, Spacer, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useInstanceContext } from '../../lib/dataList';
import { truncateReceiverUrl } from './shared';
import {
  getConnectionWebhookRegistrationTarget,
  getDeliverySetupState,
  WEBHOOK_REGISTRATION_COPY,
  type WebhookRegistrationTarget
} from './webhookRegistrationPurpose';
import {
  CreateWebhookRegistrationButton,
  showWebhookRegistrationSetup,
  webhookRegistrationStatus
} from './webhookRegistrationsTable';

let createProviderWebhookRegistrationsList = (purpose: WebhookRegistrationTarget['purpose']) =>
  createDataList<{
    instanceId: string;
    providerId: string;
    target: WebhookRegistrationTarget;
  }>(`provider-${purpose}-registrations`, { customizable: false })
    .context(useInstanceContext)
    .paginated(({ props }) =>
      useWebhookRegistrations(props.instanceId, {
        order: 'desc',
        providerId: props.providerId,
        authCredentialsId:
          props.target.purpose === 'delivery_setup'
            ? props.target.authCredentialsId
            : undefined
      })
    )
    .columns([
      col.custom({
        id: 'receiver',
        header: WEBHOOK_REGISTRATION_COPY[purpose].tableHeaders[0],
        render: row => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text size="2">{row.name}</Text>

            {row.status === 'awaiting_setup' && (
              <StatusBadge status={row.status} descriptor={webhookRegistrationStatus} />
            )}

            {row.status === 'active' && WEBHOOK_REGISTRATION_COPY[purpose].activeBadge && (
              <Badge color="blue" size="2" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                {WEBHOOK_REGISTRATION_COPY[purpose].activeBadge}
              </Badge>
            )}
          </div>
        )
      }),
      col.custom({
        id: 'receiveUrl',
        header: WEBHOOK_REGISTRATION_COPY[purpose].tableHeaders[1],
        render: row =>
          row.receiveUrl ? (
            <Text size="2" style={{ fontFamily: 'jetbrains mono, monospace' }}>
              {truncateReceiverUrl(row.receiveUrl)}
            </Text>
          ) : (
            <EmptyValue>Not provisioned</EmptyValue>
          )
      })
    ])
    .link((row, _props, ctx) =>
      Paths.instance.webhookRegistration(ctx.organization, ctx.project, ctx.instance, row.id)
    )
    .build();

let providerWebhookRegistrationsLists = {
  webhook_receiver: createProviderWebhookRegistrationsList('webhook_receiver'),
  delivery_setup: createProviderWebhookRegistrationsList('delivery_setup')
};

export let ProviderWebhookRegistrationsBox = ({
  instanceId,
  provider,
  target
}: {
  instanceId: string;
  provider: { id: string; name: string };
  target: WebhookRegistrationTarget;
}) => {
  let registrations = useWebhookRegistrations(instanceId, {
    order: 'desc',
    providerId: provider.id,
    authCredentialsId:
      target.purpose === 'delivery_setup' ? target.authCredentialsId : undefined
  });
  let copy = WEBHOOK_REGISTRATION_COPY[target.purpose];
  let RegistrationsList = providerWebhookRegistrationsLists[target.purpose];

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
        <RegistrationsList
          listVariant="embedded"
          instanceId={instanceId}
          providerId={provider.id}
          target={target}
          emptyState={{
            initial: () => (
              <Callout color="orange">
                <div>
                  <Text size="2" weight="strong">
                    {copy.emptyTitle}
                  </Text>
                  <Spacer size={4} />
                  <Text size="2">{copy.emptyText(provider.name)}</Text>
                </div>
              </Callout>
            )
          }}
        />
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
