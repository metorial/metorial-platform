import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  EventDestinationListenerPreview,
  useAllEventDestinationListeners,
  useBoot,
  useCreateEventDestinationListener,
  useCurrentInstance,
  useCurrentOrganization,
  useDeleteEventDestinationListener,
  useEventDestination,
  useUpdateEventDestinationListener
} from '@metorial/state';
import { Button, Callout, Spacer, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import {
  applyCreatedListenerDraft,
  applyDeletedListenerDraft,
  applyUpdatedListenerDraft,
  createListenerDraft,
  getListenerDraftOperations,
  ListenerDraft,
  listenerDraftCanSubmit,
  ListenerDraftsEditor,
  listenerDraftToCreateBody,
  listenerToDraft
} from '../../../../scenes/callbacks/listenerEditor';

export let getOtherInstanceListenerGroups = (input: {
  listeners: { instanceId: string }[];
  currentInstanceId: string;
  instances: {
    id: string;
    name: string;
    slug: string;
    project: { name: string; slug: string };
    organization: { slug: string };
  }[];
  eventDestinationId: string;
}) => {
  let counts = new Map<string, number>();
  for (let listener of input.listeners) {
    if (listener.instanceId === input.currentInstanceId) continue;
    counts.set(listener.instanceId, (counts.get(listener.instanceId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([instanceId, count]) => {
      let instance = input.instances.find(item => item.id === instanceId);

      return {
        instanceId,
        count,
        label: instance ? `${instance.project.name} - ${instance.name}` : instanceId,
        href: instance
          ? Paths.instance.eventDestinationListeners(
              instance.organization,
              instance.project,
              instance,
              input.eventDestinationId
            )
          : undefined
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

let Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

let EventDestinationListenersEditor = ({
  listeners,
  organizationId,
  instanceId,
  eventDestinationId,
  archived,
  onComplete
}: {
  listeners: EventDestinationListenerPreview[];
  organizationId: string;
  instanceId: string;
  eventDestinationId: string;
  archived: boolean;
  onComplete: () => Promise<unknown>;
}) => {
  let initialDrafts = listeners.map(listenerToDraft);
  let [savedDrafts, setSavedDrafts] = useState(initialDrafts);
  let [drafts, setDrafts] = useState(initialDrafts);
  let createListener = useCreateEventDestinationListener();
  let updateListener = useUpdateEventDestinationListener();
  let deleteListener = useDeleteEventDestinationListener();

  let operations = getListenerDraftOperations(savedDrafts, drafts);
  let isLoading =
    createListener.isLoading || updateListener.isLoading || deleteListener.isLoading;
  let isSuccess =
    operations.length === 0 &&
    (createListener.isSuccess || updateListener.isSuccess || deleteListener.isSuccess);
  let canSave =
    !archived && operations.length > 0 && drafts.every(listenerDraftCanSubmit) && !isLoading;

  let save = async () => {
    let currentSavedDrafts = savedDrafts;
    let currentDrafts = drafts;
    let checkpoint = (next: { savedDrafts: ListenerDraft[]; nextDrafts: ListenerDraft[] }) => {
      currentSavedDrafts = next.savedDrafts;
      currentDrafts = next.nextDrafts;
      setSavedDrafts(currentSavedDrafts);
      setDrafts(currentDrafts);
    };

    for (let operation of operations) {
      if (operation.type === 'create' || operation.type === 'replace') {
        let [created] = await createListener.mutate({
          organizationId,
          ...listenerDraftToCreateBody(operation.draft, instanceId, eventDestinationId)
        });
        if (!created) return;

        checkpoint(
          applyCreatedListenerDraft(
            currentSavedDrafts,
            currentDrafts,
            operation.draft.id,
            listenerToDraft(created)
          )
        );

        if (operation.type === 'replace') {
          let [deleted] = await deleteListener.mutate({
            organizationId,
            eventDestinationListenerId: operation.listenerId
          });
          if (!deleted) return;

          checkpoint(
            applyDeletedListenerDraft(currentSavedDrafts, currentDrafts, operation.listenerId)
          );
        }
      } else if (operation.type === 'update') {
        let [updated] = await updateListener.mutate({
          organizationId,
          eventDestinationListenerId: operation.listenerId,
          ...(operation.draft.type === 'callback'
            ? { triggers: operation.draft.eventKeys }
            : { eventTypes: operation.draft.eventKeys })
        });
        if (!updated) return;

        checkpoint(
          applyUpdatedListenerDraft(
            currentSavedDrafts,
            currentDrafts,
            listenerToDraft(updated)
          )
        );
      } else {
        let [deleted] = await deleteListener.mutate({
          organizationId,
          eventDestinationListenerId: operation.listenerId
        });
        if (!deleted) return;

        checkpoint(
          applyDeletedListenerDraft(currentSavedDrafts, currentDrafts, operation.listenerId)
        );
      }
    }

    await onComplete();
  };

  return (
    <>
      {archived ? (
        <>
          <Callout color="orange">
            Archived webhooks cannot receive events or change listeners.
          </Callout>
          <Spacer size={15} />
        </>
      ) : null}

      <ListenerDraftsEditor
        organizationId={organizationId}
        instanceId={instanceId}
        value={drafts}
        onChange={setDrafts}
        minimum={0}
      />

      <Spacer size={18} />
      <Actions>
        <Button
          type="button"
          size="2"
          variant="outline"
          disabled={archived || isLoading}
          onClick={() => setDrafts([...drafts, createListenerDraft()])}
        >
          Add Listener
        </Button>
        <Button
          size="2"
          loading={isLoading}
          success={isSuccess}
          disabled={!canSave}
          onClick={() => void save()}
        >
          Save Listeners
        </Button>
      </Actions>

      <createListener.RenderError />
      <updateListener.RenderError />
      <deleteListener.RenderError />
    </>
  );
};

export let EventDestinationListenersSettingsPage = () => {
  let organization = useCurrentOrganization();
  let instance = useCurrentInstance();
  let boot = useBoot();
  let { eventDestinationId } = useParams();
  let destination = useEventDestination(organization.data?.id, eventDestinationId);
  let listeners = useAllEventDestinationListeners(organization.data?.id, {
    eventDestinationId
  });

  return renderWithLoader({ destination, listeners, organization, instance })(
    ({ destination, listeners, organization, instance }) => {
      let currentListeners = listeners.data.filter(
        listener => listener.instanceId === instance.data.id
      );
      let otherInstanceGroups = getOtherInstanceListenerGroups({
        listeners: listeners.data,
        currentInstanceId: instance.data.id,
        instances: boot.data?.instances ?? [],
        eventDestinationId: destination.data.id
      });

      return (
        <>
          {otherInstanceGroups.length ? (
            <>
              <Box
                title="Other Instances"
                description="This destination also has listeners on other instances. Open an instance to manage them."
              >
                <Table
                  headers={['Instance', 'Listeners']}
                  data={otherInstanceGroups.map(group => ({
                    // href: group.href,
                    onClick: group.href
                      ? () => {
                          window.location.href = group.href!;
                        }
                      : undefined,
                    data: [
                      group.label,
                      <Text size="2" key="count">
                        {group.count}
                      </Text>
                    ]
                  }))}
                />
              </Box>
              <Spacer size={20} />
            </>
          ) : null}

          <EventDestinationListenersEditor
            listeners={currentListeners}
            organizationId={organization.data.id}
            instanceId={instance.data.id}
            eventDestinationId={destination.data.id}
            archived={destination.data.status === 'archived'}
            onComplete={async () => {
              await listeners.refetch();
              await destination.refetch();
            }}
          />
        </>
      );
    }
  );
};
