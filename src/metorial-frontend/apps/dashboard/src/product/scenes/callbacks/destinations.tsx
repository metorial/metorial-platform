import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCallback,
  useCallbackDestination,
  useCallbackDestinations,
  useConsumeCallbackDestinationSigningSecretReceipt,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useRotateCallbackDestinationSigningSecret
} from '@metorial/state';
import {
  Button,
  Callout,
  Copy,
  Datalist,
  Dialog,
  Entity,
  Flex,
  Menu,
  Panel,
  RenderDate,
  Select,
  showModal,
  Spacer
} from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { RiMore2Line } from '@remixicon/react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RouterPanel } from '../routerPanel';
import { showCallbackDestinationFormModal } from './destinationModal';
import { CallbackNotificationsTable } from './logs';

export let CallbackDestinationsList = (p: { callbackId: string | undefined }) => {
  let instance = useCurrentInstance();
  let callback = useCallback(instance.data?.id, p.callbackId);
  let destinations = useCallbackDestinations(
    instance.data?.id && p.callbackId ? instance.data.id : null,
    {
      callbackId: p.callbackId,
      order: 'desc'
    }
  );
  let deleteMutator = destinations.useDeleteMutator();
  let updateCallback = callback.useUpdateMutator();
  let [_, setSearchParams] = useSearchParams();
  let [selectedDestinationIds, setSelectedDestinationIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedDestinationIds(
      callback.data?.destinations.map(destination => destination.id) ?? []
    );
  }, [callback.data?.id, callback.data?.updatedAt, callback.data?.destinations]);

  return (
    <>
      {/* {renderWithLoader({ callback, destinations })(() => (
        <>
          <MultiSelect
            label="Attached Destinations"
            description="Only the selected destinations will receive notifications for this callback."
            placeholder="Select destinations"
            value={selectedDestinationIds}
            onChange={setSelectedDestinationIds}
            items={destinationSelectItems}
          />

          <Spacer height={10} />

          <Flex gap={10} justify="end">
            <Button
              variant="outline"
              onClick={() => setSelectedDestinationIds(currentDestinationIds)}
              disabled={!hasPendingDestinationChanges}
            >
              Reset
            </Button>
            <Button
              loading={updateCallback.isLoading}
              disabled={!hasPendingDestinationChanges}
              onClick={() =>
                updateCallback.mutate({
                  destinationIds: selectedDestinationIds
                })
              }
            >
              Save Destinations
            </Button>
          </Flex>

          <updateCallback.RenderError />

          <Spacer height={15} />
        </>
      ))} */}

      {renderWithLoader({ destinations, callback })(({ destinations, callback }) => (
        <Box
          title="Destinations"
          description="HTTP endpoints that receive event notifications from this callback."
          rightActions={
            instance.data && callback.data.status === 'active' ? (
              <Button
                size="1"
                onClick={() =>
                  instance.data &&
                  showCallbackDestinationFormModal({
                    instanceId: instance.data.id,
                    onCreate: async destination => {
                      let nextDestinationIds = [
                        ...new Set([...selectedDestinationIds, destination.id])
                      ];
                      setSelectedDestinationIds(nextDestinationIds);
                      let [, updateError] = await updateCallback.mutate({
                        destinationIds: nextDestinationIds
                      });

                      if (updateError) return;

                      await destinations.refetch();
                    }
                  })
                }
              >
                Create Destination
              </Button>
            ) : undefined
          }
        >
          <Flex direction="column" gap={10}>
            {destinations.data.items.map(destination => (
              <div
                key={destination.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  setSearchParams(params => {
                    params.set('destination_id', destination.id);
                    return params;
                  })
                }
                onKeyDown={event => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  setSearchParams(params => {
                    params.set('destination_id', destination.id);
                    return params;
                  });
                }}
                style={{ cursor: 'pointer' }}
              >
                <Entity.Wrapper>
                  <Entity.Content>
                    <Entity.Field
                      title={destination.name}
                      description={destination.description}
                    />
                    <Entity.Field title="URL" value={destination.url} />
                    <Entity.Field
                      title="Updated"
                      value={<RenderDate date={destination.updatedAt} />}
                    />
                    <Entity.Field title="Actions" right>
                      <div
                        onClick={event => {
                          event.stopPropagation();
                          event.preventDefault();
                        }}
                      >
                        <Menu
                          items={[{ id: 'delete', label: 'Delete' }]}
                          onItemClick={async id => {
                            if (id == 'delete') {
                              await deleteMutator.mutate({
                                callbackDestinationId: destination.id
                              });

                              setSearchParams(params => {
                                if (params.get('destination_id') == destination.id) {
                                  params.delete('destination_id');
                                }
                                return params;
                              });
                              destinations.refetch();
                              callback.refetch();
                            }
                          }}
                        >
                          <Button variant="outline" size="1" iconLeft={<RiMore2Line />} />
                        </Menu>
                      </div>
                    </Entity.Field>
                  </Entity.Content>
                </Entity.Wrapper>
              </div>
            ))}
          </Flex>

          {destinations.data.items.length == 0 && (
            <Callout color="gray">
              No destinations are attached to this callback yet. Create one to deliver its
              events to your application.
            </Callout>
          )}
        </Box>
      ))}

      <RouterPanel param="destination_id" width={1000}>
        {destinationId => (
          <>
            <Panel.Header>
              <Panel.Title>Destination Details</Panel.Title>
            </Panel.Header>

            <Panel.Content>
              <Destination destinationId={destinationId!} callbackId={p.callbackId!} />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  );
};

let Destination = ({
  destinationId,
  callbackId
}: {
  destinationId: string;
  callbackId: string;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let destination = useCallbackDestination(instance.data?.id, destinationId);

  return renderWithLoader({ destination })(({ destination }) => (
    <>
      <Box
        title="Destination"
        description="Where notifications for this callback are delivered."
        rightActions={
          destination.data.signingSecretConfigured && instance.data ? (
            <Button
              size="1"
              variant="outline"
              onClick={() =>
                showDestinationSigningSecretModal({
                  instanceId: instance.data!.id,
                  callbackDestinationId: destination.data.id,
                  onComplete: destination.refetch
                })
              }
            >
              Rotate Signing Secret
            </Button>
          ) : undefined
        }
      >
        <Datalist
          items={[
            { label: 'Name', value: destination.data.name },
            ...(destination.data.description
              ? [{ label: 'Description', value: destination.data.description }]
              : []),
            { label: 'Status', value: destination.data.status },
            { label: 'ID', value: <ID id={destination.data.id} /> },
            { label: 'URL', value: <Copy value={destination.data.url} /> },
            { label: 'Method', value: destination.data.method },
            {
              label: 'Created At',
              value: <RenderDate date={destination.data.createdAt} />
            },
            {
              label: 'Signing Secret',
              value: destination.data.signingSecretConfigured
                ? 'Configured — plaintext is never returned by ordinary reads'
                : 'Not configured'
            }
          ]}
        />
      </Box>

      <Spacer height={15} />

      <Box
        title="Recent Logs"
        description="Recent callback notifications sent to this destination for the current callback."
      >
        <CallbackNotificationsTable
          callbackId={callbackId}
          destinationId={destination.data.id}
          onNotificationClick={notificationId => {
            let path = Paths.instance.callback(
              organization.data,
              project.data,
              instance.data,
              callbackId,
              'logs'
            );
            let searchParams = new URLSearchParams({ notification_id: notificationId });
            navigate(`${path}?${searchParams.toString()}`);
          }}
        />
      </Box>
    </>
  ));
};

let SIGNING_SECRET_GRACE_OPTIONS = [
  { id: '0', label: 'Immediately — revoke the previous secret now' },
  { id: '3600', label: '1 hour' },
  { id: '86400', label: '24 hours (recommended)' }
];

let DestinationSigningSecretModalContent = (p: {
  instanceId: string;
  callbackDestinationId: string;
  close: () => void;
  onComplete: () => void;
}) => {
  let rotateSecret = useRotateCallbackDestinationSigningSecret();
  let consumeReceipt = useConsumeCallbackDestinationSigningSecretReceipt();
  let [gracePeriodSeconds, setGracePeriodSeconds] = useState('86400');
  let [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  let [graceExpiresAt, setGraceExpiresAt] = useState<Date | null>(null);

  let submit = async () => {
    let [mutation, mutationError] = await rotateSecret.mutate({
      instanceId: p.instanceId,
      callbackDestinationId: p.callbackDestinationId,
      gracePeriodSeconds: Number(gracePeriodSeconds)
    });
    if (!mutation || mutationError || !mutation.secretIssuanceReceipt) return;

    let [consumption, consumptionError] = await consumeReceipt.mutate({
      instanceId: p.instanceId,
      callbackDestinationId: p.callbackDestinationId,
      receiptId: mutation.secretIssuanceReceipt.id,
      receiptToken: mutation.secretIssuanceReceipt.token
    });
    if (!consumption || consumptionError) return;

    setRevealedSecret(consumption.value);
    setGraceExpiresAt(mutation.graceExpiresAt);
    p.onComplete();
  };

  return (
    <>
      <Callout color={revealedSecret ? 'orange' : 'gray'}>
        {revealedSecret
          ? 'Copy this signing secret now. It cannot be read again after this dialog closes.'
          : 'Metorial signs each callback delivery with this destination-specific secret. Rotating creates an expiring, single-use receipt for revealing the new value.'}
      </Callout>

      <Spacer height={15} />

      {revealedSecret ? (
        <>
          <Copy label="Signing secret" value={revealedSecret} />
          {graceExpiresAt && (
            <>
              <Spacer height={10} />
              <Callout color="orange">
                <span>
                  The previous secret remains valid through{' '}
                  <RenderDate date={graceExpiresAt} />.
                </span>
              </Callout>
            </>
          )}
        </>
      ) : (
        <Select
          label="Keep the previous secret valid for"
          description="Keep both signatures valid while the receiving service is updated."
          value={gracePeriodSeconds}
          onChange={setGracePeriodSeconds}
          items={SIGNING_SECRET_GRACE_OPTIONS}
        />
      )}

      <rotateSecret.RenderError />
      <consumeReceipt.RenderError />

      <Spacer height={20} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={p.close}>
          {revealedSecret ? 'Done' : 'Cancel'}
        </Button>
        {!revealedSecret && (
          <Button
            type="button"
            loading={rotateSecret.isLoading || consumeReceipt.isLoading}
            onClick={submit}
          >
            Rotate and reveal once
          </Button>
        )}
      </Dialog.Actions>
    </>
  );
};

let showDestinationSigningSecretModal = (p: {
  instanceId: string;
  callbackDestinationId: string;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={720}>
      <Dialog.Title>Rotate destination signing secret</Dialog.Title>
      <Dialog.Description>
        Verify `Metorial-Signature` against the exact raw callback body.
      </Dialog.Description>
      <DestinationSigningSecretModalContent {...p} close={close} />
    </Dialog.Wrapper>
  ));
