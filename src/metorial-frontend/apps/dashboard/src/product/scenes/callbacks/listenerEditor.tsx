import {
  EventDestinationListenerPreview,
  useAllCallbacks,
  useAllEventDestinations,
  useCreateEventDestinationListener,
  useEventTypes,
  useProvider,
  useProviderTriggers,
  useUpdateEventDestinationListener
} from '@metorial/state';
import {
  Button,
  Callout,
  Dialog,
  Flex,
  MultiSelect,
  Select,
  showModal,
  Spacer,
  Text
} from '@metorial/ui';
import { useMemo, useState } from 'react';

let TriggerPicker = ({
  instanceId,
  providerId,
  value,
  onChange
}: {
  instanceId: string;
  providerId: string | null | undefined;
  value: string[];
  onChange: (value: string[]) => void;
}) => {
  let provider = useProvider(instanceId, providerId);
  let providerVersionId = provider.data?.currentVersion?.id;
  let triggers = useProviderTriggers(
    instanceId,
    providerVersionId ? { providerVersionId } : null
  );

  let items = useMemo(
    () =>
      (triggers.data?.items ?? []).map(trigger => ({
        id: trigger.key,
        label: trigger.name || trigger.key
      })),
    [triggers.data?.items]
  );

  if (!providerId) {
    return (
      <Text size="2" color="gray600">
        Select a callback first.
      </Text>
    );
  }

  if (provider.isLoading || triggers.isLoading) {
    return (
      <Text size="2" color="gray600">
        Loading triggers...
      </Text>
    );
  }

  if (items.length === 0) {
    return (
      <Callout color="orange">
        <span>
          This provider does not publish any triggers, so there is nothing to subscribe to yet.
        </span>
      </Callout>
    );
  }

  return (
    <MultiSelect
      label="Triggers"
      description="Only these provider triggers are delivered to the destination."
      items={items}
      value={value}
      onChange={onChange}
    />
  );
};

export let showEventDestinationListenerModal = (p: {
  organizationId: string;
  instanceId: string;
  /** Fixed destination — omit to let the user pick one. */
  eventDestinationId?: string;
  listener?: EventDestinationListenerPreview;
  defaultCallbackId?: string;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createListener = useCreateEventDestinationListener();
    let updateListener = useUpdateEventDestinationListener();
    let isUpdate = !!p.listener;

    let [type, setType] = useState<'callback' | 'event'>(p.listener?.type ?? 'callback');
    let [callbackId, setCallbackId] = useState(
      p.listener?.callbackId ?? p.defaultCallbackId ?? ''
    );
    let [triggers, setTriggers] = useState<string[]>(p.listener?.triggers ?? []);
    let [eventTypes, setEventTypes] = useState<string[]>(p.listener?.eventTypes ?? []);
    let [destinationId, setDestinationId] = useState(
      p.listener?.eventDestinationId ?? p.eventDestinationId ?? ''
    );

    let callbacks = useAllCallbacks(p.instanceId, { status: 'active' });
    let eventTypeCatalog = useEventTypes(p.organizationId);
    let destinations = useAllEventDestinations(
      p.eventDestinationId || p.listener ? null : p.organizationId,
      { status: 'active' }
    );

    let selectedCallback = (callbacks.data ?? []).find(callback => callback.id === callbackId);

    let mutator = isUpdate ? updateListener : createListener;

    let submit = async () => {
      if (isUpdate) {
        let [updated] = await updateListener.mutate({
          organizationId: p.organizationId,
          eventDestinationListenerId: p.listener!.id,
          ...(p.listener!.type === 'callback' ? { triggers } : { eventTypes })
        });

        if (!updated) return;
      } else {
        let [created] = await createListener.mutate(
          type === 'callback'
            ? {
                organizationId: p.organizationId,
                instanceId: p.instanceId,
                eventDestinationId: destinationId,
                type: 'callback',
                callbackId,
                triggers
              }
            : {
                organizationId: p.organizationId,
                instanceId: p.instanceId,
                eventDestinationId: destinationId,
                type: 'event',
                eventTypes
              }
        );

        if (!created) return;
      }

      close();
      p.onComplete();
    };

    let canSubmit =
      !!destinationId &&
      (type === 'callback' ? !!callbackId && triggers.length > 0 : eventTypes.length > 0);

    return (
      <Dialog.Wrapper {...dialogProps} width={650}>
        <Dialog.Title>{isUpdate ? 'Edit Subscription' : 'Add Subscription'}</Dialog.Title>
        <Dialog.Description>
          Choose what this destination should be notified about.
        </Dialog.Description>

        {!isUpdate && !p.eventDestinationId ? (
          <>
            <Select
              label="Destination"
              description="Where matching events are delivered."
              value={destinationId}
              onChange={setDestinationId}
              items={(destinations.data ?? []).map(destination => ({
                id: destination.id,
                label: destination.name
              }))}
            />
            <Spacer size={12} />
          </>
        ) : null}

        {!isUpdate ? (
          <>
            <Select
              label="Subscribe To"
              value={type}
              onChange={value => setType(value === 'event' ? 'event' : 'callback')}
              items={[
                { id: 'callback', label: 'Callback triggers' },
                { id: 'event', label: 'Metorial resource events' }
              ]}
            />
            <Spacer size={12} />
          </>
        ) : null}

        {type === 'callback' ? (
          <>
            {!isUpdate ? (
              <>
                <Select
                  label="Callback"
                  description="Events from this callback are delivered to the destination."
                  value={callbackId}
                  onChange={value => {
                    setCallbackId(value);
                    setTriggers([]);
                  }}
                  items={(callbacks.data ?? []).map(callback => ({
                    id: callback.id,
                    label: `${callback.name} · ${callback.provider.name}`
                  }))}
                />
                <Spacer size={12} />
              </>
            ) : null}

            <TriggerPicker
              instanceId={p.instanceId}
              providerId={selectedCallback?.provider.id}
              value={triggers}
              onChange={setTriggers}
            />
          </>
        ) : (
          <MultiSelect
            label="Event Types"
            description="Metorial resource lifecycle events to deliver."
            items={(eventTypeCatalog.data?.items ?? []).map(eventType => ({
              id: eventType.name,
              label: eventType.name
            }))}
            value={eventTypes}
            onChange={setEventTypes}
          />
        )}

        <Spacer size={18} />

        <Dialog.Actions>
          <Button type="button" variant="outline" disabled={mutator.isLoading} onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            loading={mutator.isLoading}
            success={mutator.isSuccess}
            onClick={() => void submit()}
          >
            {isUpdate ? 'Save Subscription' : 'Add Subscription'}
          </Button>
        </Dialog.Actions>

        <mutator.RenderError />
      </Dialog.Wrapper>
    );
  });

export let ListenerSummary = ({ listener }: { listener: EventDestinationListenerPreview }) => (
  <Flex direction="column" gap={2}>
    <Text size="2" weight="strong">
      {listener.type === 'callback' ? 'Callback triggers' : 'Resource events'}
    </Text>
    <Text size="1" color="gray600">
      {(listener.type === 'callback' ? listener.triggers : listener.eventTypes)?.join(', ') ||
        'Nothing selected'}
    </Text>
  </Flex>
);
