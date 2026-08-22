import { capitalize } from '@lowerdeck/case';
import type {
  DashboardInstanceCallbacksInstancesListOutput,
  DashboardInstanceCallbacksListOutput,
  DashboardInstanceProvidersTriggersListOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  type IntegrationProvider,
  useAllCallbacks,
  useAllIntegrationProviders,
  useCallbackInstances,
  useCreateReceiverPathSecret,
  useCurrentInstance,
  useIntegration,
  useIntegrationInstances,
  useIntegrationProviderCallback,
  useProvider,
  useProviderDeployment,
  useProviderTriggers,
  useRotateCallbackReceiverPathSecret,
  useSendCallbackTestEvent,
  useWebhookDestinations
} from '@metorial/state';
import {
  Badge,
  Button,
  Callout,
  Copy,
  Dialog,
  Entity,
  Flex,
  Input,
  RenderDate,
  Spacer,
  Text,
  confirm,
  showModal,
  theme,
  toast
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { CallbackMaskedValue } from './callbackFields';
import { showIntegrationProviderCallbackPanel } from './integrationCallbackPanel';
import {
  type WebhookDestination,
  showWebhookDestinationFormModal,
  showWebhookDestinationSigningSecretModal
} from './integrationDestinationModal';

type Callback = DashboardInstanceCallbacksListOutput['items'][number];
type CallbackInstance = DashboardInstanceCallbacksInstancesListOutput['items'][number];
type ProviderTrigger = DashboardInstanceProvidersTriggersListOutput['items'][number];

let ProviderCard = styled.div`
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  overflow: hidden;
`;

let ProviderCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  background: ${theme.colors.gray100};
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let ProviderCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
`;

let getTriggerMode = (trigger: ProviderTrigger) =>
  trigger.invocation.type === 'polling'
    ? ({ label: 'Polling', color: 'blue' } as const)
    : ({ label: 'Webhook', color: 'purple' } as const);

let getRegistrationColor = (
  status: CallbackInstance['registrationStatus']
): 'green' | 'red' | 'orange' | 'gray' => {
  if (status === 'registered') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'unregistered') return 'gray';
  return 'orange';
};

let showCallbackInstanceTestEventModal = (p: {
  instanceId: string;
  callbackId: string;
  callbackInstanceId: string;
  defaultEventType: string;
}) =>
  showModal(({ dialogProps, close }) => {
    let sendTestEvent = useSendCallbackTestEvent();
    let form = useForm({
      initialValues: {
        eventType: p.defaultEventType,
        payload: '{\n  "test": true\n}'
      },
      onSubmit: async values => {
        let payload: Record<string, unknown>;
        try {
          let parsed = JSON.parse(values.payload);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Payload must be an object');
          }
          payload = parsed;
        } catch {
          form.setFieldError('payload', 'Enter a valid JSON object');
          return;
        }

        let [result] = await sendTestEvent.mutate({
          instanceId: p.instanceId,
          callbackId: p.callbackId,
          callbackInstanceId: p.callbackInstanceId,
          eventType: values.eventType.trim(),
          payload
        });
        if (!result) return;
        toast.success('Test event sent');
        close();
      },
      schema: yup =>
        yup.object({
          eventType: yup.string().trim().required('Enter an event type'),
          payload: yup.string().required('Enter a JSON payload')
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={620}>
        <Dialog.Title>Send test event</Dialog.Title>
        <Dialog.Description>
          Deliver a test payload through this callback instance.
        </Dialog.Description>
        <form onSubmit={form.handleSubmit}>
          <Input label="Event type" {...form.getFieldProps('eventType')} />
          <form.RenderError field="eventType" />
          <Spacer height={12} />
          <Input label="JSON payload" {...form.getFieldProps('payload')} />
          <form.RenderError field="payload" />
          <sendTestEvent.RenderError />
          <Spacer height={20} />
          <Dialog.Actions>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={sendTestEvent.isLoading}>
              Send test event
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

let showCallbackReceiverPathSecretModal = (p: {
  mode: 'create' | 'rotate';
  instanceId: string;
  callbackId: string;
  callbackInstanceId: string;
  receiverUrl: string;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createSecret = useCreateReceiverPathSecret();
    let rotateSecret = useRotateCallbackReceiverPathSecret();
    let mutation = p.mode === 'create' ? createSecret : rotateSecret;
    let [revealedUrl, setRevealedUrl] = useState<string | null>(null);

    let submit = async () => {
      let [result] = await mutation.mutate({
        instanceId: p.instanceId,
        callbackId: p.callbackId,
        callbackInstanceId: p.callbackInstanceId
      });
      if (!result) return;
      setRevealedUrl(
        result.webhookUrl ?? `${p.receiverUrl.replace(/\/$/, '')}/${result.value}`
      );
      p.onComplete();
    };

    return (
      <Dialog.Wrapper {...dialogProps} width={720}>
        <Dialog.Title>
          {p.mode === 'create' ? 'Create secure callback URL' : 'Rotate callback URL secret'}
        </Dialog.Title>
        <Dialog.Description>
          The complete secured URL is shown once and cannot be read again.
        </Dialog.Description>
        {revealedUrl ? (
          <>
            <Callout color="orange">Copy this URL now before closing the dialog.</Callout>
            <Spacer height={12} />
            <Copy label="Secure callback URL" value={revealedUrl} />
          </>
        ) : (
          <Callout color={p.mode === 'rotate' ? 'orange' : 'gray'}>
            {p.mode === 'rotate'
              ? 'The current URL stops working immediately after rotation.'
              : 'Create a path secret to protect the receiver URL.'}
          </Callout>
        )}
        <mutation.RenderError />
        <Spacer height={20} />
        <Dialog.Actions>
          <Button type="button" variant="outline" onClick={close}>
            {revealedUrl ? 'Done' : 'Cancel'}
          </Button>
          {!revealedUrl ? (
            <Button type="button" loading={mutation.isLoading} onClick={submit}>
              {p.mode === 'create' ? 'Create and reveal once' : 'Rotate and reveal once'}
            </Button>
          ) : null}
        </Dialog.Actions>
      </Dialog.Wrapper>
    );
  });

let CallbackInstancesSection = (p: {
  instanceId: string;
  integrationId: string;
  callbackId: string;
}) => {
  let instances = useCallbackInstances(p.instanceId, p.callbackId, {
    order: 'desc',
    limit: 25
  });
  let integrationInstances = useIntegrationInstances(p.instanceId, {
    integrationId: p.integrationId,
    status: ['active', 'archived'],
    limit: 100
  });
  let integrationInstanceNames = useMemo(
    () =>
      new Map(
        (integrationInstances.data?.items ?? []).map(instance => [instance.id, instance.name])
      ),
    [integrationInstances.data?.items]
  );

  return renderWithLoader({ instances, integrationInstances })(() => (
    <Flex direction="column" gap={10}>
      <Text size="2" weight="strong">
        Instances
      </Text>
      {instances.data?.items.length ? (
        <>
          {instances.data.items.map(callbackInstance => {
            let receiverUrl = callbackInstance.webhookUrl;
            let hasSecret = Boolean(callbackInstance.receiverPathSecret);
            let activeTriggers = callbackInstance.triggers.filter(trigger => trigger.active);
            let defaultEventType =
              activeTriggers[0]?.providerTrigger?.eventTypes[0] ??
              activeTriggers[0]?.providerTrigger?.key ??
              'test';
            return (
              <Entity.Wrapper key={callbackInstance.id}>
                <Entity.Content>
                  <Entity.Field
                    title={
                      integrationInstanceNames.get(callbackInstance.integrationInstanceId) ??
                      callbackInstance.integrationInstanceId
                    }
                    description={callbackInstance.integrationInstanceId}
                  />
                  <Entity.Field
                    title="Registration"
                    value={
                      <Badge color={getRegistrationColor(callbackInstance.registrationStatus)}>
                        {capitalize(callbackInstance.registrationStatus)}
                      </Badge>
                    }
                  />
                  <Entity.Field title="Triggers" value={`${activeTriggers.length}`} />
                  {receiverUrl ? (
                    <Entity.Field
                      title="Webhook URL"
                      value={
                        <CallbackMaskedValue
                          value={`${receiverUrl.replace(/\/$/, '')}/••••••••`}
                        />
                      }
                    />
                  ) : null}
                  <Entity.Field title="Actions" right>
                    <Flex gap={8} style={{ flexWrap: 'wrap' }}>
                      <Button
                        size="1"
                        variant="outline"
                        onClick={() =>
                          showCallbackInstanceTestEventModal({
                            instanceId: p.instanceId,
                            callbackId: p.callbackId,
                            callbackInstanceId: callbackInstance.id,
                            defaultEventType
                          })
                        }
                      >
                        Send test event
                      </Button>
                      {receiverUrl ? (
                        <Button
                          size="1"
                          variant="outline"
                          onClick={() =>
                            showCallbackReceiverPathSecretModal({
                              mode: hasSecret ? 'rotate' : 'create',
                              instanceId: p.instanceId,
                              callbackId: p.callbackId,
                              callbackInstanceId: callbackInstance.id,
                              receiverUrl,
                              onComplete: instances.refetch
                            })
                          }
                        >
                          {hasSecret ? 'Rotate URL secret' : 'Create secure URL'}
                        </Button>
                      ) : null}
                    </Flex>
                  </Entity.Field>
                </Entity.Content>
              </Entity.Wrapper>
            );
          })}
          {instances.data.pagination.hasMoreBefore ? (
            <Button size="1" variant="outline" onClick={instances.previous}>
              Previous instances
            </Button>
          ) : null}
          {instances.data.pagination.hasMoreAfter ? (
            <Button size="1" variant="outline" onClick={instances.next}>
              Load more instances
            </Button>
          ) : null}
        </>
      ) : (
        <Text size="2" color="gray600">
          No configured integration instances have been attached yet.
        </Text>
      )}
    </Flex>
  ));
};

let IntegrationProviderCallbackRow = (p: {
  instanceId: string;
  integrationId: string;
  integrationProvider: IntegrationProvider;
}) => {
  let integrationProvider = p.integrationProvider;
  let deployment = useProviderDeployment(p.instanceId, integrationProvider.deployment.id);
  let provider = useProvider(p.instanceId, integrationProvider.provider.id);
  let providerVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let triggers = useProviderTriggers(
    p.instanceId,
    providerVersionId ? { providerVersionId, limit: 100 } : null
  );
  let callback = useIntegrationProviderCallback(p.instanceId, integrationProvider.id);
  let deleteCallback = callback.useDeleteMutator();

  return renderWithLoader({ deployment, provider, triggers, callback })(() => {
    let availableTriggers = triggers.data?.items ?? [];
    let configuredCallback = callback.data;
    let configuredTriggerRows = (configuredCallback?.providerTriggers ?? []).map(
      callbackTrigger => ({
        callbackTrigger,
        providerTrigger: availableTriggers.find(
          trigger => trigger.key === callbackTrigger.providerTrigger.key
        )
      })
    );
    let openPanel = () =>
      showIntegrationProviderCallbackPanel({
        instanceId: p.instanceId,
        integrationProviderId: integrationProvider.id,
        providerName: provider.data?.name ?? integrationProvider.provider.name,
        triggers: availableTriggers,
        callback: configuredCallback,
        onComplete: callback.refetch
      });

    return (
      <ProviderCard>
        <ProviderCardHeader>
          <Flex direction="column" gap={2}>
            <Text size="3" weight="strong">
              {provider.data?.name ?? integrationProvider.provider.name}
            </Text>
            <Text size="1" color="gray600">
              {integrationProvider.deployment.name ?? integrationProvider.deployment.id}
            </Text>
          </Flex>
          {configuredCallback ? (
            <Flex gap={8}>
              {availableTriggers.length ? (
                <Button size="1" variant="outline" onClick={openPanel}>
                  Edit
                </Button>
              ) : null}
              <Button
                size="1"
                color="red"
                variant="soft"
                loading={deleteCallback.isLoading}
                onClick={() =>
                  confirm({
                    title: 'Disable callback?',
                    description:
                      'The callback is archived and its callback instances detach automatically. You can set it up again later.',
                    confirmText: 'Disable',
                    onConfirm: async () => {
                      let [result] = await deleteCallback.mutate();
                      if (!result) return;
                      toast.success('Callback disabled');
                      callback.refetch();
                    }
                  })
                }
              >
                Disable
              </Button>
            </Flex>
          ) : null}
        </ProviderCardHeader>

        <ProviderCardBody>
          {!configuredCallback ? (
            !availableTriggers.length ? (
              <Text size="2" color="gray600">
                No triggers available
              </Text>
            ) : (
              <Flex align="center" justify="space-between" gap={10}>
                <Text size="2" color="gray600">
                  Choose provider triggers to enable this callback.
                </Text>
                <Button size="2" onClick={openPanel}>
                  Set up triggers
                </Button>
              </Flex>
            )
          ) : (
            <>
              <Flex direction="column" gap={8}>
                <Text size="2" weight="strong">
                  Enabled triggers
                </Text>
                {!availableTriggers.length ? (
                  <Text size="2" color="gray600">
                    No triggers are currently available from this provider version. You can
                    still disable the existing callback.
                  </Text>
                ) : null}
                <Table
                  headers={['Trigger', 'Mode', 'Event types']}
                  data={configuredTriggerRows.map(({ callbackTrigger, providerTrigger }) => {
                    let mode = providerTrigger
                      ? getTriggerMode(providerTrigger)
                      : ({ label: 'Unavailable', color: 'gray' } as const);
                    let selectedEventTypes = callbackTrigger.eventTypes;
                    return {
                      data: [
                        providerTrigger?.name ?? callbackTrigger.providerTrigger.name,
                        <Badge color={mode.color}>{mode.label}</Badge>,
                        selectedEventTypes.length ? (
                          <Flex gap={4} style={{ flexWrap: 'wrap' }}>
                            {selectedEventTypes.map(eventType => (
                              <Badge key={eventType} color="gray">
                                {eventType}
                              </Badge>
                            ))}
                          </Flex>
                        ) : (
                          'All events'
                        )
                      ]
                    };
                  })}
                />
              </Flex>

              <Flex direction="column" gap={8}>
                <Text size="2" weight="strong">
                  Linked destinations
                </Text>
                {configuredCallback.destinations.length ? (
                  <Flex gap={6} style={{ flexWrap: 'wrap' }}>
                    {configuredCallback.destinations.map(destination => (
                      <Badge key={destination.id} color="blue">
                        {destination.name}
                      </Badge>
                    ))}
                  </Flex>
                ) : (
                  <Text size="2" color="gray600">
                    No webhook destinations linked.
                  </Text>
                )}
              </Flex>

              {configuredCallback.config ? (
                <Flex direction="column" gap={8}>
                  <Text size="2" weight="strong">
                    Callback configuration
                  </Text>
                  <Flex gap={6} style={{ flexWrap: 'wrap' }}>
                    {configuredCallback.config.configuredKeys.map(key => (
                      <Badge key={key} color="green">
                        {key} configured
                      </Badge>
                    ))}
                  </Flex>
                </Flex>
              ) : null}

              <CallbackInstancesSection
                instanceId={p.instanceId}
                integrationId={p.integrationId}
                callbackId={configuredCallback.id}
              />
            </>
          )}
        </ProviderCardBody>
      </ProviderCard>
    );
  });
};

let WebhookDestinationsManager = (p: {
  instanceId: string;
  callbacks: readonly Callback[];
}) => {
  let [search, setSearch] = useState('');
  let destinations = useWebhookDestinations(p.instanceId, { order: 'desc', limit: 25 });
  let archiveDestination = destinations.useDeleteMutator();
  let normalizedSearch = search.trim().toLowerCase();

  let getLinkedCallbackCount = (destinationId: string) =>
    p.callbacks.filter(
      callback =>
        callback.status === 'active' &&
        callback.destinations.some(destination => destination.id === destinationId)
    ).length;

  let edit = (destination: WebhookDestination) =>
    showWebhookDestinationFormModal({
      instanceId: p.instanceId,
      destination,
      onComplete: destinations.refetch
    });

  return (
    <Box
      title="Webhook destinations"
      description="Create and manage every destination in this instance, including destinations that are not linked to a callback."
      rightActions={
        <Button
          size="2"
          onClick={() =>
            showWebhookDestinationFormModal({
              instanceId: p.instanceId,
              onComplete: destinations.refetch
            })
          }
        >
          New destination
        </Button>
      }
    >
      <Input
        label="Search destinations"
        hideLabel
        placeholder="Search destinations..."
        value={search}
        onChange={event => setSearch(event.target.value)}
      />
      <Text size="1" color="gray600">
        Search filters the currently loaded page; use pagination to inspect other pages.
      </Text>
      <Spacer height={12} />
      {renderWithPagination(destinations, {
        emptyState: <Callout color="gray">No webhook destinations configured yet.</Callout>,
        hidePaginationWhenUnavailable: true
      })(({ data }) => {
        let visibleDestinations = normalizedSearch
          ? data.items.filter(destination =>
              `${destination.name} ${destination.description ?? ''} ${destination.url} ${destination.method}`
                .toLowerCase()
                .includes(normalizedSearch)
            )
          : data.items;

        if (!visibleDestinations.length) {
          return <Callout color="gray">No destinations match this search.</Callout>;
        }

        return (
          <Table
            headers={['Destination', 'Endpoint', 'Linked callbacks', 'Updated', 'Actions']}
            data={visibleDestinations.map(destination => {
              let linkedCallbackCount = getLinkedCallbackCount(destination.id);
              return {
                data: [
                  <Flex direction="column" gap={2}>
                    <Text size="2" weight="strong">
                      {destination.name}
                    </Text>
                    <Text size="1" color="gray600">
                      {destination.description ?? destination.id}
                    </Text>
                  </Flex>,
                  <Flex direction="column" gap={2}>
                    <Text size="2">{destination.url}</Text>
                    <Badge color="gray">{destination.method}</Badge>
                  </Flex>,
                  `${linkedCallbackCount}`,
                  <RenderDate date={destination.updatedAt} />,
                  <Flex gap={6} style={{ flexWrap: 'wrap' }}>
                    <Button size="1" variant="outline" onClick={() => edit(destination)}>
                      Edit
                    </Button>
                    <Button
                      size="1"
                      variant="outline"
                      onClick={() =>
                        showWebhookDestinationSigningSecretModal({
                          instanceId: p.instanceId,
                          webhookDestinationId: destination.id,
                          onComplete: destinations.refetch
                        })
                      }
                    >
                      Rotate secret
                    </Button>
                    <Button
                      size="1"
                      color="red"
                      variant="soft"
                      onClick={() =>
                        confirm({
                          title: `Archive ${destination.name}?`,
                          description:
                            linkedCallbackCount > 0
                              ? `This destination is linked to ${linkedCallbackCount} active ${linkedCallbackCount === 1 ? 'callback' : 'callbacks'}. Archiving removes it from those callbacks.`
                              : 'This destination is not linked to an active callback.',
                          confirmText: 'Archive',
                          onConfirm: async () => {
                            let [result] = await archiveDestination.mutate({
                              webhookDestinationId: destination.id
                            });
                            if (!result) return;
                            toast.success('Destination archived');
                            destinations.refetch();
                          }
                        })
                      }
                    >
                      Archive
                    </Button>
                  </Flex>
                ]
              };
            })}
          />
        );
      })}
    </Box>
  );
};

export let IntegrationCallbacksManager = (p: { integrationId: string }) => {
  let currentInstance = useCurrentInstance();
  let instanceId = currentInstance.data?.id;
  let integration = useIntegration(instanceId, p.integrationId);
  let integrationProviders = useAllIntegrationProviders(instanceId, p.integrationId);
  let callbacks = useAllCallbacks(instanceId);

  return renderWithLoader({ currentInstance, integration, integrationProviders, callbacks })(
    () => (
      <Flex direction="column" gap={20}>
        <Box
          title="Provider callbacks"
          description="Enable provider triggers, configure callback secrets, and link delivery destinations."
        >
          <Flex direction="column" gap={12}>
            {integrationProviders.data?.length ? (
              integrationProviders.data.map(integrationProvider => (
                <IntegrationProviderCallbackRow
                  key={integrationProvider.id}
                  instanceId={currentInstance.data!.id}
                  integrationId={p.integrationId}
                  integrationProvider={integrationProvider}
                />
              ))
            ) : (
              <Callout color="gray">
                Add a provider to this integration before configuring callbacks.
              </Callout>
            )}
          </Flex>
        </Box>

        <WebhookDestinationsManager
          instanceId={currentInstance.data!.id}
          callbacks={callbacks.data ?? []}
        />
      </Flex>
    )
  );
};
