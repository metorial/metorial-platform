import type { DashboardInstanceCallbacksInstancesListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCallback,
  useCallbackInstances,
  useCreateCallbackInstance,
  useCurrentInstance,
  useProvider,
  useProviderDeployment,
  useProviderTriggers
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Button,
  Callout,
  Copy,
  Datalist,
  Dialog,
  Flex,
  Input,
  InlineCopy,
  MultiSelect,
  Panel,
  RenderDate,
  Spacer,
  Text,
  confirm,
  showModal,
  toast
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { showProviderCreationPanel } from '../providerCreationPanel';
import { RouterPanel } from '../routerPanel';
import {
  AddProviderPanelFlow,
  type ProviderPanelSubmitInput
} from '../sessionTemplates/addProviderPanelFlow';

type CallbackInstanceListItem = DashboardInstanceCallbacksInstancesListOutput['items'][number];
let CALLBACK_WAITING_POLL_MS = 3000;

let getCallbackType = (
  triggers: {
    webhookUrl: string | null;
    pollIntervalSeconds: number | null;
  }[]
) => {
  if (triggers.some(trigger => trigger.webhookUrl)) return 'Webhook';
  if (triggers.some(trigger => trigger.pollIntervalSeconds != null)) return 'Polling';
  return 'Managed';
};

export let CallbackOverview = (p: { callbackId: string | undefined }) => {
  let instance = useCurrentInstance();
  let callbackLoader = useCallback(instance.data?.id, p.callbackId);
  let instancesLoader = useCallbackInstances(instance.data?.id, p.callbackId, {
    order: 'desc'
  });
  let updateCallback = callbackLoader.useUpdateMutator();
  let deployment = useProviderDeployment(
    instance.data?.id,
    callbackLoader.data?.providerDeployment.id
  );
  let provider = useProvider(
    instance.data?.id,
    deployment.data?.providerId ?? callbackLoader.data?.providerDeployment.providerId
  );
  let providerVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let availableTriggers = useProviderTriggers(
    instance.data?.id,
    providerVersionId ? { providerVersionId, limit: 100 } : null
  );
  let deleteCallbackInstance = instancesLoader.useDeleteMutator();
  let [_, setSearchParams] = useSearchParams();
  let [selectedTriggerKeys, setSelectedTriggerKeys] = useState<string[]>([]);
  let shouldPollOverview =
    !!callbackLoader.data &&
    !!instancesLoader.data &&
    callbackLoader.data.providerTriggers.length > 0 &&
    instancesLoader.data.items.length > 0 &&
    instancesLoader.data.items.every(instance => instance.triggers.length === 0);

  useEffect(() => {
    setSelectedTriggerKeys(
      callbackLoader.data?.providerTriggers.map(trigger => trigger.providerTrigger.key) ?? []
    );
  }, [
    callbackLoader.data?.id,
    callbackLoader.data?.updatedAt,
    callbackLoader.data?.providerTriggers
  ]);

  useEffect(() => {
    if (!shouldPollOverview) return;

    let interval = window.setInterval(() => {
      callbackLoader.refetch?.();
      instancesLoader.refetch?.();
    }, CALLBACK_WAITING_POLL_MS);

    return () => window.clearInterval(interval);
  }, [shouldPollOverview, callbackLoader.refetch, instancesLoader.refetch]);

  let availableTriggerItems = useMemo(
    () =>
      (availableTriggers.data?.items ?? []).map(trigger => ({
        id: trigger.key,
        label: `${trigger.name} (${trigger.key})`
      })),
    [availableTriggers.data?.items]
  );

  let hasPendingTriggerChanges =
    selectedTriggerKeys.slice().sort().join('|') !==
    (callbackLoader.data?.providerTriggers.map(trigger => trigger.providerTrigger.key) ?? [])
      .slice()
      .sort()
      .join('|');

  return renderWithLoader({ callback: callbackLoader, instances: instancesLoader, provider })(
    ({ callback, instances, provider }) => {
      let instanceItems = instances.data.items;
      let triggerInstances = instanceItems.flatMap(instance => instance.triggers);
      let receiverUrlItems = instanceItems
        .filter(
          (
            instance
          ): instance is typeof instance & {
            webhookUrl: string;
          } => Boolean(instance.webhookUrl)
        )
        .map(instance => ({
          id: instance.id,
          label: instance.config.name || instance.config.id,
          webhookUrl: instance.webhookUrl
        }));
      let nextPollAt = triggerInstances
        .map(trigger => trigger.nextPollAt)
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => a.getTime() - b.getTime())[0];

      return (
        <>
          <Attributes
            columns={3}
            attributes={[
              {
                label: 'Provider Deployment',
                content:
                  callback.data.providerDeployment.name || callback.data.providerDeployment.id
              },
              {
                label: 'Next Poll At',
                content: nextPollAt ? <RenderDate date={nextPollAt} /> : 'N/A'
              },
              {
                label: 'ID',
                content: <ID id={callback.data.id} />
              }
            ]}
          />

          <Spacer height={15} />

          {receiverUrlItems.length > 0 && (
            <>
              <Box
                title="Receiver URLs"
                description={`${provider.data.name} requires manual configuration. Register the following receiver URLs with the provider to start receiving events.`}
              >
                <Table
                  headers={['Receiver', 'Receiver URL', '']}
                  data={receiverUrlItems.map(item => ({
                    data: [
                      <Flex direction="column" gap={2} style={{ minWidth: 0 }}>
                        <Text size="2" weight="strong">
                          {item.label}
                        </Text>
                        <Text
                          size="2"
                          color="gray600"
                          style={{
                            display: 'block',
                            maxWidth: '100%',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {item.id}
                        </Text>
                      </Flex>,
                      <div style={{ width: '100%', minWidth: 0 }}>
                        <Text
                          size="2"
                          style={{
                            display: 'block',
                            width: '100%',
                            minWidth: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontFamily: 'monospace'
                          }}
                        >
                          {item.webhookUrl}
                        </Text>
                      </div>,
                      <InlineCopy value={item.webhookUrl} />
                    ]
                  }))}
                />
              </Box>

              <Spacer height={15} />
            </>
          )}

          <Box
            title="Manage Triggers"
            description="Choose which provider triggers should create events for this callback."
          >
            {availableTriggers.data?.items.length ? (
              <>
                <MultiSelect
                  label="Attached Triggers"
                  description="Event type filters can still be added through the API if needed."
                  placeholder="Select provider triggers"
                  value={selectedTriggerKeys}
                  onChange={setSelectedTriggerKeys}
                  items={availableTriggerItems}
                />

                <Spacer height={15} />

                <DialogActionsWrapper>
                  <Button
                    variant="outline"
                    size="2"
                    onClick={() =>
                      setSelectedTriggerKeys(
                        callback.data.providerTriggers.map(
                          trigger => trigger.providerTrigger.key
                        )
                      )
                    }
                    disabled={!hasPendingTriggerChanges}
                  >
                    Reset
                  </Button>
                  <Button
                    loading={updateCallback.isLoading}
                    disabled={!hasPendingTriggerChanges}
                    size="2"
                    onClick={() =>
                      updateCallback.mutate({
                        triggers: selectedTriggerKeys.map(triggerId => ({ triggerId }))
                      })
                    }
                  >
                    Save Triggers
                  </Button>
                </DialogActionsWrapper>

                <updateCallback.RenderError />
              </>
            ) : (
              <Callout color="gray">
                No provider triggers are available for this deployment yet.
              </Callout>
            )}
          </Box>

          <Spacer height={15} />

          <Box
            title="Instances"
            description="Callback instances track registration state for provider configuration combinations."
            rightActions={
              instance.data && callback.data?.id ? (
                <Button
                  size="1"
                  onClick={() =>
                    showCallbackInstanceFormModal({
                      instanceId: instance.data.id,
                      callbackId: callback.data.id,
                      providerDeploymentId: callback.data.providerDeployment.id,
                      onCreate: callbackInstanceId => {
                        instancesLoader.refetch?.();
                        setSearchParams(params => {
                          params.set('callback_instance_id', callbackInstanceId);
                          return params;
                        });
                      }
                    })
                  }
                >
                  Attach Instance
                </Button>
              ) : undefined
            }
          >
            {instanceItems.length > 0 ? (
              <Table
                headers={['Status', 'Config', 'Auth Config', 'Triggers', 'Updated']}
                data={instanceItems.map(instance => ({
                  data: [
                    <Badge color={instance.status === 'attached' ? 'blue' : 'gray'}>
                      {instance.status}
                    </Badge>,
                    instance.config.name ?? <ID id={instance.config.id} />,
                    instance.authConfig ? (
                      (instance.authConfig.name ?? <ID id={instance.authConfig?.id} />)
                    ) : (
                      <span style={{ opacity: 0.5 }}>None</span>
                    ),
                    <Text size="2">
                      {instance.triggers.length}{' '}
                      {instance.triggers.length === 1 ? 'trigger' : 'triggers'}
                    </Text>,
                    <RenderDate date={instance.updatedAt} />
                  ],
                  onClick: () =>
                    setSearchParams(params => {
                      params.set('callback_instance_id', instance.id);
                      return params;
                    })
                }))}
              />
            ) : (
              <Callout color="gray">
                No callback instances have been attached to this callback yet.
              </Callout>
            )}
          </Box>

          <RouterPanel param="callback_instance_id" width={1000}>
            {callbackInstanceId => {
              let callbackInstance = instanceItems.find(
                instance => instance.id === callbackInstanceId
              );
              if (!callbackInstance) return null;

              return (
                <>
                  <Panel.Header>
                    <Panel.Title>Callback Instance Details</Panel.Title>
                  </Panel.Header>

                  <Panel.Content>
                    <CallbackInstanceDetails
                      callbackInstance={callbackInstance}
                      deleteCallbackInstance={deleteCallbackInstance}
                      onDetach={callbackInstanceId =>
                        confirm({
                          title: 'Detach callback instance',
                          description:
                            'Are you sure you want to detach this callback instance?',
                          confirmText: 'Detach',
                          onConfirm: async () => {
                            let [res] = await deleteCallbackInstance.mutate({
                              callbackInstanceId
                            });

                            if (!res) return;

                            toast.success('Callback instance detached');
                            callbackLoader.refetch?.();
                            instancesLoader.refetch?.();
                            setSearchParams(params => {
                              params.delete('callback_instance_id');
                              return params;
                            });
                          }
                        })
                      }
                    />
                  </Panel.Content>
                </>
              );
            }}
          </RouterPanel>
        </>
      );
    }
  );
};

let DialogActionsWrapper = (p: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10
    }}
  >
    {p.children}
  </div>
);

let CallbackInstanceAttachPanelContent = (p: {
  instanceId: string;
  callbackId: string;
  providerDeploymentId: string;
  close: () => void;
  setPanelWidth: (width: number) => void;
  onCreate?: (callbackInstanceId: string) => void;
}) => {
  let createCallbackInstance = useCreateCallbackInstance();
  let deployment = useProviderDeployment(p.instanceId, p.providerDeploymentId);

  if (deployment.isLoading) {
    return <Callout color="gray">Loading provider deployment...</Callout>;
  }

  if (!deployment.data) {
    return <Callout color="gray">Could not resolve the callback provider deployment.</Callout>;
  }

  return (
    <AddProviderPanelFlow
      close={p.close}
      setPanelWidth={p.setPanelWidth}
      instanceId={p.instanceId}
      providerId={deployment.data.providerId}
      hideProviderStep
      initialDeploymentId={p.providerDeploymentId}
      filterAvailableResources
      showToolFilters={false}
      ensureProviderConfig
      autoSubmitWhenReady
      title="Attach Callback Instance"
      description="Attach this callback to a provider config and optional auth config combination."
      action="Attach Instance"
      onSubmitProvider={async (input: ProviderPanelSubmitInput) => {
        if (!input.providerConfigId) {
          return {
            success: false,
            error: new Error('Could not create a provider config automatically.')
          };
        }

        let [result, error] = await createCallbackInstance.mutate({
          instanceId: p.instanceId,
          callbackId: p.callbackId,
          providerConfigId: input.providerConfigId,
          providerAuthConfigId: input.providerAuthConfigId || undefined
        });

        if (!result || error) return { success: false, error };

        p.onCreate?.(result.id);
        return { success: true };
      }}
      onComplete={() => {}}
    />
  );
};

let showCallbackInstanceFormModal = (p: {
  instanceId: string;
  callbackId: string;
  providerDeploymentId: string;
  onCreate?: (callbackInstanceId: string) => void;
}) =>
  showProviderCreationPanel(({ close, setWidth }) => (
    <CallbackInstanceAttachPanelContent {...p} close={close} setPanelWidth={setWidth} />
  ));

let getCallbackInstanceStatusBadge = (status: CallbackInstanceListItem['status']) => (
  <Badge color={status === 'attached' ? 'blue' : 'gray'}>{status}</Badge>
);

let CallbackInstanceDetails = (p: {
  callbackInstance: CallbackInstanceListItem;
  onDetach: (callbackInstanceId: string) => void;
  deleteCallbackInstance: ReturnType<
    ReturnType<typeof useCallbackInstances>['useDeleteMutator']
  >;
}) => {
  let webhookUrl = p.callbackInstance.webhookUrl;
  let needsManualWebhookSetup = p.callbackInstance.triggers.some(
    trigger => trigger.webhookUrl && !trigger.isWebhookRegistered
  );

  return (
    <>
      <Box
        title="Instance"
        description="This callback instance tracks the receiver registration for a specific provider config and optional auth config pair."
      >
        <Datalist
          items={[
            {
              label: 'Status',
              value: getCallbackInstanceStatusBadge(p.callbackInstance.status)
            },
            {
              label: 'ID',
              value: <ID id={p.callbackInstance.id} />
            },
            {
              label: 'Config ID',
              value: <ID id={p.callbackInstance.config.id} />
            },

            ...(p.callbackInstance.authConfig
              ? [
                  {
                    label: 'Auth Config ID',
                    value: <ID id={p.callbackInstance.authConfig.id} />
                  }
                ]
              : []),

            {
              label: 'Created At',
              value: <RenderDate date={p.callbackInstance.createdAt} />
            },
            {
              label: 'Updated At',
              value: <RenderDate date={p.callbackInstance.updatedAt} />
            }
          ]}
        />

        <Spacer height={5} />
      </Box>

      <Spacer height={15} />

      <Box
        title="Trigger Registrations"
        description="Each trigger registration represents a provider trigger that is registered to receive events for this callback instance."
      >
        {p.callbackInstance.triggers.length > 0 ? (
          <Table
            headers={['Trigger', 'Source', 'Next Poll']}
            data={p.callbackInstance.triggers.map(trigger => ({
              data: [
                trigger.providerTrigger?.name ?? 'Unknown Trigger',
                trigger.source,
                trigger.nextPollAt ? <RenderDate date={trigger.nextPollAt} /> : 'N/A'
              ]
            }))}
          />
        ) : (
          <Text size="2" color="gray600">
            No trigger registrations have been created for this callback instance yet.
          </Text>
        )}
      </Box>

      <Spacer height={15} />

      {webhookUrl && needsManualWebhookSetup && (
        <>
          <Box
            title="Callback Endpoint"
            description="Configure the provider to send manual webhook events to this callback instance URL. Slates will route matching events to the registered triggers."
          >
            <Copy value={webhookUrl} />

            <Spacer height={15} />

            <Button
              size="1"
              variant="outline"
              onClick={() =>
                showCallbackTriggerPostModal({
                  triggerLabel: 'callback instance',
                  webhookUrl
                })
              }
            >
              Send Test POST
            </Button>
          </Box>
          <Spacer height={15} />
        </>
      )}

      <Box
        title="Danger Zone"
        description="Detach this callback instance from its provider config and auth config pair."
      >
        <Button
          color="red"
          loading={p.deleteCallbackInstance.isLoading}
          success={p.deleteCallbackInstance.isSuccess}
          onClick={() => p.onDetach(p.callbackInstance.id)}
          size="2"
        >
          Detach Instance
        </Button>
      </Box>
    </>
  );
};

let CallbackTriggerPostModalContent = (p: {
  triggerLabel: string;
  webhookUrl: string;
  close: () => void;
}) => {
  let [payload, setPayload] = useState('{\n  "test": true\n}');
  let [isLoading, setIsLoading] = useState(false);

  let submit = async () => {
    let trimmedPayload = payload.trim();
    let body: string | undefined;

    if (trimmedPayload) {
      try {
        body = JSON.stringify(JSON.parse(trimmedPayload));
      } catch {
        toast.error('Payload must be valid JSON');
        return;
      }
    }

    try {
      setIsLoading(true);

      let response = await fetch(p.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        ...(body ? { body } : {})
      });

      let responseText = await response.text();

      if (!response.ok) {
        toast.error(responseText || `Webhook returned ${response.status}`);
        return;
      }

      toast.success(`Webhook queued for ${p.triggerLabel}`);
      p.close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to post webhook');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Callout color="gray">
        This sends a direct `POST` request to the callback instance receiver URL.
      </Callout>

      <Spacer height={15} />

      <Copy value={p.webhookUrl} />

      <Spacer height={15} />

      <Input
        label="JSON Payload"
        as="textarea"
        minRows={8}
        style={{ fontFamily: 'monospace' }}
        value={payload}
        onChange={event => setPayload(event.target.value)}
      />

      <Spacer height={20} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={p.close}>
          Cancel
        </Button>
        <Button type="button" loading={isLoading} onClick={submit}>
          Send POST
        </Button>
      </Dialog.Actions>
    </>
  );
};

let showCallbackTriggerPostModal = (p: { triggerLabel: string; webhookUrl: string }) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={720}>
      <Dialog.Title>Send Test POST</Dialog.Title>
      <Dialog.Description>
        Manually trigger the registered callback receiver for {p.triggerLabel}.
      </Dialog.Description>

      <CallbackTriggerPostModalContent {...p} close={close} />
    </Dialog.Wrapper>
  ));
