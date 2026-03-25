import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import type { DashboardInstanceCallbacksInstancesListOutput } from '@metorial/dashboard-sdk';
import {
  useCallback,
  useCreateCallbackInstance,
  useCallbackInstances,
  useCurrentInstance,
  useProvider,
  useProviderAuthConfigs,
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
  Select,
  Spacer,
  Text,
  confirm,
  toast,
  showModal
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { RiAddLine } from '@remixicon/react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  emptyConfigurationSelection,
  type ConfigurationSelection
} from '../../lib/configSelection';
import { showProviderAuthConfigCreateModal } from '../providerAuthConfigs/modal';
import { ProviderConfigurationSelection } from '../providerConfigs/selection';
import { RouterPanel } from '../routerPanel';

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
  let callback = useCallback(instance.data?.id, p.callbackId);
  let instances = useCallbackInstances(instance.data?.id, p.callbackId, {
    order: 'desc'
  });
  let updateCallback = callback.useUpdateMutator();
  let deployment = useProviderDeployment(
    instance.data?.id,
    callback.data?.providerDeployment.id
  );
  let provider = useProvider(
    instance.data?.id,
    deployment.data?.providerId ?? callback.data?.providerDeployment.providerId
  );
  let providerVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let availableTriggers = useProviderTriggers(instance.data?.id, providerVersionId, {
    limit: 100
  });
  let deleteCallbackInstance = instances.useDeleteMutator();
  let [_, setSearchParams] = useSearchParams();
  let [selectedTriggerKeys, setSelectedTriggerKeys] = useState<string[]>([]);
  let shouldPollOverview =
    !!callback.data &&
    !!instances.data &&
    (instances.data.items.some(instance => instance.registrationStatus === 'pending') ||
      (callback.data.providerTriggers.length > 0 &&
        instances.data.items.length > 0 &&
        instances.data.items.every(instance => instance.triggers.length === 0)));

  useEffect(() => {
    setSelectedTriggerKeys(
      callback.data?.providerTriggers.map(trigger => trigger.providerTriggerKey) ?? []
    );
  }, [callback.data?.id, callback.data?.updatedAt, callback.data?.providerTriggers]);

  useEffect(() => {
    if (!shouldPollOverview) return;

    let interval = window.setInterval(() => {
      callback.refetch?.();
      instances.refetch?.();
    }, CALLBACK_WAITING_POLL_MS);

    return () => window.clearInterval(interval);
  }, [shouldPollOverview, callback.refetch, instances.refetch]);

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
    (callback.data?.providerTriggers.map(trigger => trigger.providerTriggerKey) ?? [])
      .slice()
      .sort()
      .join('|');

  return renderWithLoader({ callback, instances, provider })(
    ({ callback, instances, provider }) => {
      let instanceItems = instances.data.items;
      let triggerInstances = instanceItems.flatMap(instance => instance.triggers);
      let receiverUrlItems = Array.from(
        new Map(
          triggerInstances
            .filter(
              (
                trigger
              ): trigger is (typeof triggerInstances)[number] & {
                webhookUrl: string;
              } => Boolean(trigger.webhookUrl)
            )
            .map(trigger => {
              let providerTriggerLabel = trigger.providerTrigger
                ? `${trigger.providerTrigger.name} (${trigger.providerTrigger.key})`
                : trigger.id;

              return [
                `${providerTriggerLabel}:${trigger.webhookUrl}`,
                {
                  id: trigger.id,
                  label: providerTriggerLabel,
                  webhookUrl: trigger.webhookUrl
                }
              ] as const;
            })
        ).values()
      );
      let receiverUrlTemplate =
        provider.data.type.triggers.status === 'enabled'
          ? provider.data.type.triggers.receiverUrl
          : null;
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
                label: 'Status',
                content: (
                  <Badge color={callback.data.status === 'active' ? 'blue' : 'gray'}>
                    {callback.data.status}
                  </Badge>
                )
              },
              {
                label: 'Type',
                content: getCallbackType(triggerInstances)
              },
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
              },
              {
                label: 'Created At',
                content: <RenderDate date={callback.data.createdAt} />
              }
            ]}
          />

          <Spacer height={15} />

          {receiverUrlItems.length > 0 && (
            <>
              <Box
                title="Receiver URLs"
                description="Use the receiver URL for the specific attached trigger you want the external provider to call."
              >
                <Table
                  headers={['Trigger', 'Receiver URL', '']}
                  data={receiverUrlItems.map(item => ({
                    data: [
                      <Flex direction="column" gap={2} style={{ minWidth: 0 }}>
                        <Text size="2" weight="strong">
                          {item.label.split(' (')[0]}
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
                          {item.label.includes(' (')
                            ? item.label.slice(item.label.indexOf(' (') + 2, -1)
                            : item.id}
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

          {receiverUrlTemplate && (
            <>
              <Box
                title="Receiver URL Template"
                description="This is the provider-level receiver URL template. The live per-trigger receiver URLs are listed above when available."
              >
                <Copy value={receiverUrlTemplate} />
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
                    onClick={() =>
                      setSelectedTriggerKeys(
                        callback.data.providerTriggers.map(
                          trigger => trigger.providerTriggerKey
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
            title="Provider Triggers"
            description="These provider triggers can create callback events for this callback."
          >
            {callback.data.providerTriggers.length > 0 ? (
              <Table
                headers={['Trigger', 'Key', 'Event Types']}
                data={callback.data.providerTriggers.map(trigger => ({
                  data: [
                    <Text size="2" weight="strong">
                      {trigger.providerTriggerName}
                    </Text>,
                    trigger.providerTriggerKey,
                    trigger.eventTypes.length ? trigger.eventTypes.join(', ') : 'All'
                  ]
                }))}
              />
            ) : (
              <Callout color="gray">
                No provider triggers have been attached to this callback yet.
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
                        instances.refetch?.();
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
                headers={['Status', 'Registration', 'Triggers', 'Updated']}
                data={instanceItems.map(instance => ({
                  data: [
                    <Badge color={instance.status === 'attached' ? 'blue' : 'gray'}>
                      {instance.status}
                    </Badge>,
                    <Badge
                      color={instance.registrationStatus === 'registered' ? 'blue' : 'orange'}
                    >
                      {instance.registrationStatus}
                    </Badge>,
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
                            callback.refetch?.();
                            instances.refetch?.();
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

type CallbackInstanceFormValues = {
  selectedConfiguration: ConfigurationSelection;
  selectedAuthConfigId: string;
};

let CallbackInstanceFormModalContent = (p: {
  instanceId: string;
  callbackId: string;
  providerDeploymentId: string;
  close: () => void;
  onCreate?: (callbackInstanceId: string) => void;
}) => {
  let createCallbackInstance = useCreateCallbackInstance();
  let authConfigs = useProviderAuthConfigs(p.instanceId, p.providerDeploymentId);
  let authConfigItems = authConfigs.data?.items ?? [];
  let requiresAuthConfig = !authConfigs.isLoading && authConfigItems.length > 0;
  let emptyAuthConfigLabel = requiresAuthConfig ? 'Select an auth config' : 'None';
  let form = useForm<CallbackInstanceFormValues>({
    initialValues: {
      selectedConfiguration: emptyConfigurationSelection(),
      selectedAuthConfigId: ''
    },
    onSubmit: async values => {
      if (values.selectedConfiguration.kind !== 'config') return;

      let [result] = await createCallbackInstance.mutate({
        instanceId: p.instanceId,
        callbackId: p.callbackId,
        providerConfigId: values.selectedConfiguration.id,
        providerAuthConfigId: values.selectedAuthConfigId || undefined
      });

      if (!result) return;

      p.onCreate?.(result.id);
      p.close();
    },
    schema: yup =>
      yup.object({
        selectedConfiguration: yup
          .mixed<ConfigurationSelection>()
          .defined()
          .test(
            'selectedConfiguration',
            'Select a provider config',
            value => value?.kind === 'config'
          ),
        selectedAuthConfigId: yup
          .string()
          .default('')
          .test(
            'selectedAuthConfigId',
            'Select an auth config',
            value => !requiresAuthConfig || Boolean(value)
          )
      })
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Callout color="gray">
        Attach this callback to a provider config and optional auth config so the receiver can
        register.
      </Callout>

      <Spacer height={15} />

      <ProviderConfigurationSelection
        instanceId={p.instanceId}
        providerDeploymentId={p.providerDeploymentId}
        value={form.values.selectedConfiguration}
        onChange={value => {
          form.setFieldValue('selectedConfiguration', value);
          form.setFieldTouched('selectedConfiguration', false, false);
          form.setFieldError('selectedConfiguration', undefined);
        }}
        label="Provider Config"
        includeVaults={false}
      />
      <form.RenderError field="selectedConfiguration" />

      <Spacer height={15} />

      <Flex gap={8} align="end">
        <div style={{ flex: 1 }}>
          <Select
            label={requiresAuthConfig ? 'Auth Config (required)' : 'Auth Config'}
            value={form.values.selectedAuthConfigId || '__none__'}
            onChange={value => {
              form.setFieldValue('selectedAuthConfigId', value === '__none__' ? '' : value);
              form.setFieldTouched('selectedAuthConfigId', false, false);
              form.setFieldError('selectedAuthConfigId', undefined);
            }}
            items={[
              { id: '__none__', label: emptyAuthConfigLabel },
              ...authConfigItems.map(authConfig => ({
                id: authConfig.id,
                label: authConfig.name ?? authConfig.id
              }))
            ]}
          />
          <form.RenderError field="selectedAuthConfigId" />
        </div>

        <Button
          type="button"
          size="3"
          iconLeft={<RiAddLine />}
          aria-label="Create Auth Config"
          onClick={() =>
            showProviderAuthConfigCreateModal({
              instanceId: p.instanceId,
              providerDeploymentId: p.providerDeploymentId,
              onCreate: authConfig => {
                authConfigs.refetch?.();
                form.setFieldValue('selectedAuthConfigId', authConfig.id);
                form.setFieldTouched('selectedAuthConfigId', false, false);
                form.setFieldError('selectedAuthConfigId', undefined);
              }
            })
          }
        />
      </Flex>

      <Spacer height={20} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={p.close}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={createCallbackInstance.isLoading}
          success={createCallbackInstance.isSuccess}
        >
          Attach Instance
        </Button>
      </Dialog.Actions>

      {createCallbackInstance.error && (
        <>
          <Spacer height={15} />
          <createCallbackInstance.RenderError />
        </>
      )}
    </form>
  );
};

let showCallbackInstanceFormModal = (p: {
  instanceId: string;
  callbackId: string;
  providerDeploymentId: string;
  onCreate?: (callbackInstanceId: string) => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>Attach Callback Instance</Dialog.Title>
      <Dialog.Description>
        Attach this callback to a provider config and optional auth config combination.
      </Dialog.Description>

      <CallbackInstanceFormModalContent {...p} close={close} />
    </Dialog.Wrapper>
  ));

let getCallbackInstanceRegistrationBadge = (
  status: CallbackInstanceListItem['registrationStatus']
) => <Badge color={status === 'registered' ? 'blue' : 'orange'}>{status}</Badge>;

let getCallbackInstanceStatusBadge = (status: CallbackInstanceListItem['status']) => (
  <Badge color={status === 'attached' ? 'blue' : 'gray'}>{status}</Badge>
);

let CallbackInstanceDetails = (p: {
  callbackInstance: CallbackInstanceListItem;
  onDetach: (callbackInstanceId: string) => void;
  deleteCallbackInstance: ReturnType<
    ReturnType<typeof useCallbackInstances>['useDeleteMutator']
  >;
}) => (
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
            label: 'Registration',
            value: getCallbackInstanceRegistrationBadge(p.callbackInstance.registrationStatus)
          },
          {
            label: 'ID',
            value: <ID id={p.callbackInstance.id} />
          },
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
    </Box>

    <Spacer height={15} />

    {p.callbackInstance.registrationStatus === 'pending' && (
      <>
        <Callout color="orange">
          Registration is still pending. The receiver will only register after reconcile
          completes and all callback requirements are satisfied.
        </Callout>

        <Spacer height={15} />
      </>
    )}

    <Text size="2" weight="strong">
      Trigger Registrations
    </Text>
    <Text size="2" color="gray600">
      These are the resolved trigger registrations currently associated with this callback
      instance.
    </Text>

    <Spacer height={12} />

    {p.callbackInstance.triggers.length > 0 ? (
      p.callbackInstance.triggers.map(trigger => (
        <div key={trigger.id}>
          <Box
            title={trigger.providerTrigger?.name ?? 'Unknown Trigger'}
            description={trigger.providerTrigger?.key ?? trigger.id}
          >
            <Datalist
              items={[
                { label: 'Source', value: trigger.source },
                {
                  label: 'Polling',
                  value: trigger.pollIntervalSeconds
                    ? `${trigger.pollIntervalSeconds}s`
                    : 'N/A'
                },
                {
                  label: 'Next Poll',
                  value: trigger.nextPollAt ? <RenderDate date={trigger.nextPollAt} /> : 'N/A'
                }
              ]}
            />

            {trigger.webhookUrl && (
              <>
                <Spacer height={15} />

                <Flex align="end" gap={10}>
                  <div style={{ flex: 1 }}>
                    <Text size="2" weight="strong">
                      Webhook URL
                    </Text>
                    <Spacer height={5} />
                    <Copy value={trigger.webhookUrl} />
                  </div>

                  <Button
                    size="3"
                    variant="outline"
                    onClick={() =>
                      showCallbackTriggerPostModal({
                        triggerLabel:
                          trigger.providerTrigger?.name ??
                          trigger.providerTrigger?.key ??
                          trigger.id,
                        webhookUrl: trigger.webhookUrl!
                      })
                    }
                  >
                    Send Test POST
                  </Button>
                </Flex>
              </>
            )}
          </Box>

          <Spacer height={15} />
        </div>
      ))
    ) : (
      <Callout color="gray">
        No trigger registrations have been created for this callback instance yet.
      </Callout>
    )}

    <Spacer height={20} />

    <Box
      title="Danger Zone"
      description="Detach this callback instance from its provider config and auth config pair."
    >
      <Button
        color="red"
        loading={p.deleteCallbackInstance.isLoading}
        success={p.deleteCallbackInstance.isSuccess}
        onClick={() => p.onDetach(p.callbackInstance.id)}
      >
        Detach Instance
      </Button>
    </Box>
  </>
);

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
        This sends a direct `POST` request to the registered receiver URL for this trigger.
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
