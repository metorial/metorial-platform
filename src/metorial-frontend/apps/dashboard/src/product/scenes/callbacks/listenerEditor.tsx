import {
  EventDestinationListenerPreview,
  callbacksLoader,
  chatConnectionsLoader,
  providerListingsLoader,
  useAllEventDestinations,
  useCallbackById,
  useChatConnection,
  useCreateEventDestinationListener,
  useEventTypes,
  useProvider,
  useProviderTriggers,
  useProvidersByIds,
  useUpdateEventDestinationListener
} from '@metorial/state';
import {
  Button,
  Checkbox,
  Combobox,
  Dialog,
  Flex,
  Input,
  OptionToggle,
  Select,
  showModal,
  Spacer,
  Text,
  theme
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { RiCloseLine } from '@remixicon/react';
import { useMemo, useState } from 'react';
import styled from 'styled-components';

export type ListenerDraftType = 'chat' | 'callback' | 'system';
export type ListenerDraftScope = 'all' | 'provider' | 'specific';

export type ListenerDraft = {
  id: string;
  type: ListenerDraftType;
  scope: ListenerDraftScope;
  targetId: string | null;
  eventKeys: string[];
};

export type ListenerChoice = {
  id: string;
  label: string;
  description?: string | null;
};

export let CHAT_EVENT_CATALOG: ListenerChoice[] = [
  {
    id: 'chat.message.received',
    label: 'Message Received',
    description: 'A new message is received in a connected chat.'
  },
  {
    id: 'chat.message.updated',
    label: 'Message Updated',
    description: 'An existing message is edited.'
  },
  {
    id: 'chat.message.deleted',
    label: 'Message Deleted',
    description: 'A message is deleted.'
  },
  {
    id: 'chat.mention.received',
    label: 'Mention Received',
    description: 'A user or bot is mentioned in a message.'
  },
  {
    id: 'chat.reaction.added',
    label: 'Reaction Added',
    description: 'A reaction is added to a message.'
  },
  {
    id: 'chat.reaction.removed',
    label: 'Reaction Removed',
    description: 'A reaction is removed from a message.'
  },
  {
    id: 'chat.command.invoked',
    label: 'Command Invoked',
    description: 'A chat command is invoked.'
  },
  {
    id: 'chat.member.joined',
    label: 'Member Joined',
    description: 'A member joins a connected workspace or channel.'
  },
  {
    id: 'chat.member.left',
    label: 'Member Left',
    description: 'A member leaves a connected workspace or channel.'
  }
];

let Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 3px 0px 5px 0px;
`;

let FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 640px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

let ListHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

let ListActions = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
`;

let ChoiceList = styled.div`
  max-height: 360px;
  overflow: auto;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  background: ${theme.colors.background};
`;

let ChoiceRow = styled.div`
  padding: 12px 14px;

  &:not(:last-child) {
    border-bottom: 1px solid ${theme.colors.gray300};
  }
`;

let Empty = styled.div`
  padding: 15px 20px;
  text-align: center;
`;

let sentenceCase = (value: string) => {
  let sentence = value.replace(/[._-]+/g, ' ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
};

export let createListenerDraft = (
  input: Partial<Omit<ListenerDraft, 'id'>> & { id?: string } = {}
): ListenerDraft => ({
  id: input.id ?? `listener-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  type: input.type ?? 'callback',
  scope: input.scope ?? 'all',
  targetId: input.targetId ?? null,
  eventKeys: input.eventKeys ?? []
});

export let listenerToDraft = (listener: EventDestinationListenerPreview): ListenerDraft => ({
  id: listener.id,
  type: listener.type === 'event' ? 'system' : listener.type,
  scope:
    listener.callbackId || listener.chatConnectionId
      ? 'specific'
      : listener.providerId
        ? 'provider'
        : 'all',
  targetId: listener.callbackId ?? listener.chatConnectionId ?? listener.providerId,
  eventKeys:
    listener.type === 'callback' ? (listener.triggers ?? []) : (listener.eventTypes ?? [])
});

export let getCallbackTriggersLoading = (input: {
  scope: ListenerDraftScope;
  targetId: string | null;
  triggerProviderId?: string | null;
  providerVersionId?: string | null;
  targetLoading: boolean;
  providerLoading: boolean;
  providerTriggersLoading: boolean;
}) => {
  if (input.scope !== 'all' && !input.targetId) return false;
  if (input.scope === 'specific' && input.targetLoading) return true;
  if (input.triggerProviderId && input.providerLoading) return true;
  return (input.scope === 'all' || !!input.providerVersionId) && input.providerTriggersLoading;
};

export let getEventSelectionMode = (
  items: { id: string }[],
  value: string[]
): 'all' | 'custom' =>
  items.length > 0 && items.every(item => value.includes(item.id)) ? 'all' : 'custom';

export let getListenerScopeSummary = (
  draft: ListenerDraft,
  choices?: { providers?: ListenerChoice[]; resources?: ListenerChoice[] }
) => {
  if (draft.type === 'system') return 'All activity in this instance';
  if (draft.scope === 'all') {
    return draft.type === 'chat' ? 'All active chat connections' : 'All active callbacks';
  }

  let source = draft.scope === 'provider' ? choices?.providers : choices?.resources;
  let target = source?.find(item => item.id === draft.targetId);
  if (target) {
    return draft.scope === 'provider'
      ? `All ${target.label} ${draft.type === 'chat' ? 'connections' : 'callbacks'}`
      : target.label;
  }

  return draft.scope === 'provider' ? 'Choose a provider' : 'Choose a connection';
};

export let DescribedCheckboxList = ({
  label,
  description,
  items,
  value,
  onChange,
  isLoading,
  emptyMessage = 'No choices are available.',
  searchable = true
}: {
  label: string;
  description?: string;
  items: ListenerChoice[];
  value: string[];
  onChange: (value: string[]) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  searchable?: boolean;
}) => {
  let [search, setSearch] = useState('');
  let normalizedSearch = search.trim().toLowerCase();
  let visibleItems = items.filter(item =>
    `${item.label} ${item.description ?? ''} ${item.id}`
      .toLowerCase()
      .includes(normalizedSearch)
  );
  let selectionMode = getEventSelectionMode(items, value);

  let toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...new Set([...value, id])] : value.filter(item => item !== id));

  return (
    <Section>
      <ListHeader>
        <div>
          <Text size="2" weight="strong">
            {label}
          </Text>
          {description ? (
            <Text size="1" color="gray600">
              {description}
            </Text>
          ) : null}
        </div>
        <ListActions>
          {value.length > 0 ? (
            <Button
              type="button"
              size="1"
              variant="ghost"
              aria-label="Clear selection"
              iconLeft={<RiCloseLine size={14} />}
              onClick={() => onChange([])}
            />
          ) : null}
          <OptionToggle
            ariaLabel={`${label} selection`}
            size="1"
            value={selectionMode}
            disabled={!items.length}
            onChange={mode => {
              if (mode === 'all') {
                onChange([...new Set(items.map(item => item.id))]);
                return;
              }

              if (selectionMode === 'all') onChange([]);
            }}
            items={[
              { id: 'all', label: 'All' },
              { id: 'custom', label: 'Custom' }
            ]}
          />
        </ListActions>
      </ListHeader>

      {searchable && items.length > 6 ? (
        <Input
          label={`Search ${label}`}
          hideLabel
          value={search}
          placeholder={`Search ${label.toLowerCase()}...`}
          onChange={event => setSearch(event.target.value)}
        />
      ) : null}

      <ChoiceList>
        {isLoading ? (
          <Empty>
            <Text size="2" color="gray600">
              Loading choices...
            </Text>
          </Empty>
        ) : visibleItems.length ? (
          visibleItems.map(item => (
            <ChoiceRow key={item.id}>
              <Checkbox
                checked={value.includes(item.id)}
                onCheckedChange={checked => toggle(item.id, checked)}
                label={
                  <Flex direction="column" gap={2}>
                    <Text size="2" weight="strong">
                      {item.label}
                    </Text>
                    {item.description ? (
                      <Text size="1" color="gray600">
                        {item.description}
                      </Text>
                    ) : null}
                  </Flex>
                }
              />
            </ChoiceRow>
          ))
        ) : (
          <Empty>
            <Text size="2" color="gray600">
              {normalizedSearch ? 'No choices match your search.' : emptyMessage}
            </Text>
          </Empty>
        )}
      </ChoiceList>
    </Section>
  );
};

let ListenerTargetCombobox = ({
  instanceId,
  type,
  scope,
  label,
  value,
  valueLabel,
  onChange
}: {
  instanceId: string;
  type: ListenerDraftType;
  scope: Exclude<ListenerDraftScope, 'all'>;
  label: string;
  value: string | null;
  valueLabel?: string;
  onChange: (value: string | null) => void;
}) => (
  <Combobox
    label={label}
    placeholder={`Search ${label.toLowerCase()}s...`}
    value={value}
    valueLabel={valueLabel}
    provider={({ searchQuery }) => {
      let providerListings = providerListingsLoader.use(
        scope === 'provider' && instanceId
          ? {
              instanceId,
              search: searchQuery,
              limit: 50,
              orderByRank: true,
              ...(type === 'callback'
                ? { capabilities: { supportsCallbacks: true } }
                : { adapter: 'chat' })
            }
          : null
      );
      let callbacks = callbacksLoader.use(
        scope === 'specific' && type === 'callback' && instanceId
          ? { instanceId, search: searchQuery, limit: 50, status: 'active' }
          : null
      );
      let connections = chatConnectionsLoader.use(
        scope === 'specific' && type === 'chat' && instanceId
          ? { instanceId, search: searchQuery, limit: 50, status: 'active' }
          : null
      );
      let items =
        scope === 'provider'
          ? (providerListings.data?.items ?? []).map(listing => ({
              id: listing.provider.id,
              label: listing.name
            }))
          : (type === 'chat'
              ? (connections.data?.items ?? [])
              : (callbacks.data?.items ?? [])
            ).map(item => ({
              id: item.id,
              label: item.name
            }));
      let isLoading =
        scope === 'provider'
          ? providerListings.isLoading
          : type === 'chat'
            ? connections.isLoading
            : callbacks.isLoading;

      return {
        items,
        isLoading,
        empty: `No ${label.toLowerCase()}s found.`
      };
    }}
    onChange={onChange}
  />
);

export let ListenerDraftEditor = ({
  organizationId,
  instanceId,
  value,
  onChange,
  lockType = false,
  lockScope = false
}: {
  organizationId: string;
  instanceId: string;
  value: ListenerDraft;
  onChange: (value: ListenerDraft) => void;
  lockType?: boolean;
  lockScope?: boolean;
}) => {
  let systemEventTypes = useEventTypes(organizationId);
  let selectedProvider = useProvider(
    instanceId,
    value.scope === 'provider' ? value.targetId : null
  );
  let selectedCallback = useCallbackById(
    instanceId,
    value.type === 'callback' && value.scope === 'specific' ? value.targetId : null
  );
  let selectedChatConnection = useChatConnection(
    instanceId,
    value.type === 'chat' && value.scope === 'specific' ? value.targetId : null
  );

  let triggerProviderId =
    value.type === 'callback'
      ? value.scope === 'specific'
        ? selectedCallback.data?.provider.id
        : value.scope === 'provider'
          ? value.targetId
          : null
      : null;
  let provider = useProvider(instanceId, triggerProviderId);
  let providerVersionId = provider.data?.currentVersion?.id;
  let providerTriggers = useProviderTriggers(
    instanceId,
    value.type !== 'callback'
      ? null
      : value.scope === 'all'
        ? { userManagedCallbacks: 'true' }
        : providerVersionId
          ? { providerVersionId }
          : null
  );
  let triggerProviderIds = useMemo(() => {
    if (value.type !== 'callback' || value.scope !== 'all') return null;
    let ids = [
      ...new Set((providerTriggers.data?.items ?? []).map(trigger => trigger.providerId))
    ];
    return ids.length ? ids : null;
  }, [providerTriggers.data?.items, value.scope, value.type]);
  let triggerProviders = useProvidersByIds(instanceId, triggerProviderIds);
  let triggerProviderNames = useMemo(() => {
    let names = new Map<string, string>();
    for (let listedProvider of triggerProviders.data ?? []) {
      names.set(listedProvider.id, listedProvider.name);
    }
    return names;
  }, [triggerProviders.data]);

  let triggerChoices = useMemo(
    () =>
      (providerTriggers.data?.items ?? []).map(trigger => ({
        id: trigger.key,
        label: trigger.name || sentenceCase(trigger.key),
        description:
          value.scope === 'all'
            ? (triggerProviderNames.get(trigger.providerId) ?? trigger.description)
            : trigger.description
      })),
    [providerTriggers.data?.items, triggerProviderNames, value.scope]
  );
  let systemChoices = useMemo(
    () =>
      (systemEventTypes.data?.items ?? []).map(eventType => ({
        id: eventType.name,
        label: sentenceCase(eventType.name),
        description: eventType.description
      })),
    [systemEventTypes.data?.items]
  );
  let targetLabel =
    value.scope === 'provider'
      ? 'Provider'
      : value.type === 'chat'
        ? 'Connection'
        : 'Callback';
  let targetValueLabel =
    selectedProvider.data?.name ??
    selectedCallback.data?.name ??
    selectedChatConnection.data?.name;
  let isCallbackTriggersLoading = getCallbackTriggersLoading({
    scope: value.scope,
    targetId: value.targetId,
    triggerProviderId,
    providerVersionId,
    targetLoading: selectedCallback.isLoading,
    providerLoading: provider.isLoading,
    providerTriggersLoading: providerTriggers.isLoading
  });

  let update = (patch: Partial<ListenerDraft>) => onChange({ ...value, ...patch });
  let setType = (type: ListenerDraftType) =>
    update({
      type,
      scope: 'all',
      targetId: null,
      eventKeys: []
    });
  let setScope = (scope: ListenerDraftScope) =>
    update({ scope, targetId: null, eventKeys: [] });

  return (
    <Section>
      <FieldGrid>
        {!lockType ? (
          <Select
            label="Listener Type"
            value={value.type}
            onChange={type =>
              setType(type === 'chat' ? 'chat' : type === 'system' ? 'system' : 'callback')
            }
            items={[
              { id: 'callback', label: 'Callback Triggers' },
              { id: 'chat', label: 'Chat Events' },
              { id: 'system', label: 'System Events' }
            ]}
          />
        ) : null}

        {value.type !== 'system' && !lockScope ? (
          <Select
            label="Scope"
            value={value.scope}
            onChange={scope =>
              setScope(
                scope === 'provider' ? 'provider' : scope === 'specific' ? 'specific' : 'all'
              )
            }
            items={[
              {
                id: 'all',
                label: value.type === 'chat' ? 'All Connections' : 'All Callbacks'
              },
              { id: 'provider', label: 'One Provider' },
              {
                id: 'specific',
                label: value.type === 'chat' ? 'Specific Connection' : 'Specific Callback'
              }
            ]}
          />
        ) : null}

        {value.type !== 'system' && value.scope !== 'all' && !lockScope ? (
          <ListenerTargetCombobox
            instanceId={instanceId}
            type={value.type}
            scope={value.scope}
            label={targetLabel}
            value={value.targetId}
            valueLabel={targetValueLabel}
            onChange={targetId => update({ targetId, eventKeys: [] })}
          />
        ) : null}
      </FieldGrid>

      {value.type === 'callback' ? (
        <DescribedCheckboxList
          label="Callback Triggers"
          items={triggerChoices}
          value={value.eventKeys}
          onChange={eventKeys => update({ eventKeys })}
          isLoading={isCallbackTriggersLoading}
          emptyMessage={
            value.scope !== 'all' && !value.targetId
              ? `Choose a ${value.scope === 'provider' ? 'provider' : 'callback'} to view triggers.`
              : 'No callback triggers are available for this scope.'
          }
        />
      ) : value.type === 'chat' ? (
        <DescribedCheckboxList
          label="Chat Events"
          items={CHAT_EVENT_CATALOG}
          value={value.eventKeys}
          onChange={eventKeys => update({ eventKeys })}
        />
      ) : (
        <DescribedCheckboxList
          label="System Events"
          items={systemChoices}
          value={value.eventKeys}
          onChange={eventKeys => update({ eventKeys })}
          isLoading={systemEventTypes.isLoading}
          emptyMessage="No system event types are available."
        />
      )}
    </Section>
  );
};

export let ListenerDraftsEditor = ({
  organizationId,
  instanceId,
  value,
  onChange,
  minimum = 1
}: {
  organizationId: string;
  instanceId: string;
  value: ListenerDraft[];
  onChange: (value: ListenerDraft[]) => void;
  minimum?: number;
}) => {
  let updateDraft = (index: number, draft: ListenerDraft) =>
    onChange(value.map((item, itemIndex) => (itemIndex === index ? draft : item)));

  return (
    <Flex direction="column" gap={12}>
      {value.map((draft, index) => (
        <Box
          key={draft.id}
          title={`Listener ${index + 1}`}
          description={`${draft.eventKeys.length} event${
            draft.eventKeys.length === 1 ? '' : 's'
          } selected`}
          rightActions={
            <Button
              type="button"
              size="1"
              variant="outline"
              color="red"
              disabled={value.length <= minimum}
              onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
            >
              Remove
            </Button>
          }
        >
          <ListenerDraftEditor
            organizationId={organizationId}
            instanceId={instanceId}
            value={draft}
            onChange={nextDraft => updateDraft(index, nextDraft)}
          />
        </Box>
      ))}
    </Flex>
  );
};

export let listenerDraftCanSubmit = (draft: ListenerDraft) =>
  draft.eventKeys.length > 0 &&
  (draft.type === 'system' || draft.scope === 'all' || !!draft.targetId);

export let getUncreatedListenerDrafts = (
  drafts: ListenerDraft[],
  createdDraftIds: ReadonlySet<string>
) => drafts.filter(draft => !createdDraftIds.has(draft.id));

export let listenerDraftToCreateBody = (
  draft: ListenerDraft,
  instanceId: string,
  eventDestinationId: string
) => {
  let scopeFields =
    draft.scope === 'specific'
      ? draft.type === 'chat'
        ? { chatConnectionId: draft.targetId! }
        : { callbackId: draft.targetId! }
      : draft.scope === 'provider'
        ? { providerId: draft.targetId! }
        : {};

  if (draft.type === 'system') {
    return {
      instanceId,
      eventDestinationId,
      type: 'event' as const,
      eventTypes: draft.eventKeys
    };
  }

  if (draft.type === 'chat') {
    return {
      instanceId,
      eventDestinationId,
      type: 'chat' as const,
      eventTypes: draft.eventKeys,
      ...scopeFields
    };
  }

  return {
    instanceId,
    eventDestinationId,
    type: 'callback' as const,
    triggers: draft.eventKeys,
    ...scopeFields
  };
};

export type ListenerDraftOperation =
  | { type: 'create'; draft: ListenerDraft }
  | { type: 'update'; listenerId: string; draft: ListenerDraft }
  | { type: 'replace'; listenerId: string; draft: ListenerDraft }
  | { type: 'delete'; listenerId: string };

let eventKeysMatch = (left: string[], right: string[]) =>
  [...left].sort().join('\0') === [...right].sort().join('\0');

export let getListenerDraftOperations = (
  originalDrafts: ListenerDraft[],
  nextDrafts: ListenerDraft[]
): ListenerDraftOperation[] => {
  let originalById = new Map(originalDrafts.map(draft => [draft.id, draft]));
  let nextById = new Map(nextDrafts.map(draft => [draft.id, draft]));
  let operations: ListenerDraftOperation[] = [];

  for (let draft of nextDrafts) {
    let original = originalById.get(draft.id);
    if (!original) {
      operations.push({ type: 'create', draft });
    } else if (
      original.type !== draft.type ||
      original.scope !== draft.scope ||
      original.targetId !== draft.targetId
    ) {
      operations.push({ type: 'replace', listenerId: original.id, draft });
    } else if (!eventKeysMatch(original.eventKeys, draft.eventKeys)) {
      operations.push({ type: 'update', listenerId: original.id, draft });
    }
  }

  for (let original of originalDrafts) {
    if (!nextById.has(original.id)) {
      operations.push({ type: 'delete', listenerId: original.id });
    }
  }

  return operations;
};

export let applyCreatedListenerDraft = (
  savedDrafts: ListenerDraft[],
  nextDrafts: ListenerDraft[],
  replacedDraftId: string,
  createdDraft: ListenerDraft
) => ({
  savedDrafts: [...savedDrafts, createdDraft],
  nextDrafts: nextDrafts.map(draft => (draft.id === replacedDraftId ? createdDraft : draft))
});

export let applyUpdatedListenerDraft = (
  savedDrafts: ListenerDraft[],
  nextDrafts: ListenerDraft[],
  updatedDraft: ListenerDraft
) => ({
  savedDrafts: savedDrafts.map(draft => (draft.id === updatedDraft.id ? updatedDraft : draft)),
  nextDrafts: nextDrafts.map(draft => (draft.id === updatedDraft.id ? updatedDraft : draft))
});

export let applyDeletedListenerDraft = (
  savedDrafts: ListenerDraft[],
  nextDrafts: ListenerDraft[],
  deletedDraftId: string
) => ({
  savedDrafts: savedDrafts.filter(draft => draft.id !== deletedDraftId),
  nextDrafts
});

export let showEventDestinationListenerModal = (
  p: {
    organizationId: string;
    instanceId: string;
    onComplete: () => void;
  } & (
    | { listener: EventDestinationListenerPreview; fixedTarget?: undefined }
    | {
        listener?: undefined;
        fixedTarget: { type: 'callback' | 'chat'; targetId: string };
        excludeEventDestinationIds?: string[];
      }
  )
) =>
  showModal(({ dialogProps, close }) => {
    let createListener = useCreateEventDestinationListener();
    let updateListener = useUpdateEventDestinationListener();
    let isUpdate = !!p.listener;
    let initialDraft = p.listener
      ? listenerToDraft(p.listener)
      : createListenerDraft({
          type: p.fixedTarget.type,
          scope: 'specific',
          targetId: p.fixedTarget.targetId
        });
    let [draft, setDraft] = useState(initialDraft);
    let [destinationId, setDestinationId] = useState(p.listener?.eventDestinationId ?? '');
    let destinations = useAllEventDestinations(isUpdate ? null : p.organizationId, {
      status: 'active'
    });
    let eligibleDestinations = (destinations.data ?? []).filter(
      destination => !p.excludeEventDestinationIds?.includes(destination.id)
    );
    let mutator = isUpdate ? updateListener : createListener;

    let submit = async () => {
      if (p.listener) {
        let [updated] = await updateListener.mutate({
          organizationId: p.organizationId,
          eventDestinationListenerId: p.listener.id,
          ...(p.listener.type === 'callback'
            ? { triggers: draft.eventKeys }
            : { eventTypes: draft.eventKeys })
        });
        if (!updated) return;
      } else {
        let [created] = await createListener.mutate({
          organizationId: p.organizationId,
          ...listenerDraftToCreateBody(draft, p.instanceId, destinationId)
        });
        if (!created) return;
      }

      close();
      p.onComplete();
    };

    return (
      <Dialog.Wrapper {...dialogProps} width={700}>
        <Dialog.Title>{isUpdate ? 'Edit Subscription' : 'Add Subscription'}</Dialog.Title>
        <Dialog.Description>Choose which events this destination receives.</Dialog.Description>

        {!isUpdate ? (
          <>
            <Combobox
              label="Destination"
              description="Where matching events are delivered."
              placeholder="Search event destinations..."
              value={destinationId || null}
              valueLabel={eligibleDestinations.find(d => d.id === destinationId)?.name}
              items={eligibleDestinations.map(destination => ({
                id: destination.id,
                label: destination.name
              }))}
              onChange={value => setDestinationId(value ?? '')}
            />
            <Spacer size={16} />
          </>
        ) : null}

        <ListenerDraftEditor
          organizationId={p.organizationId}
          instanceId={p.instanceId}
          value={draft}
          onChange={setDraft}
          lockType
          lockScope
        />

        <Spacer size={18} />
        <Dialog.Actions>
          <Button type="button" variant="outline" disabled={mutator.isLoading} onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!destinationId || !listenerDraftCanSubmit(draft)}
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

export let ListenerSummary = ({ listener }: { listener: EventDestinationListenerPreview }) => {
  let draft = listenerToDraft(listener);
  return (
    <Flex direction="column" gap={2}>
      <Text size="2" weight="strong">
        {draft.type === 'callback'
          ? 'Callback Triggers'
          : draft.type === 'chat'
            ? 'Chat Events'
            : 'System Events'}
      </Text>
      <Text size="1" color="gray600">
        {draft.eventKeys.length
          ? `${getListenerScopeSummary(draft)} · ${draft.eventKeys.length} selected`
          : 'Nothing selected'}
      </Text>
    </Flex>
  );
};
