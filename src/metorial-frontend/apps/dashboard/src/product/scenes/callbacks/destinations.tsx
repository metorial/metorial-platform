import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCallback,
  useCallbackDestination,
  useCallbackDestinations,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import {
  Button,
  Copy,
  Entity,
  Flex,
  Menu,
  Panel,
  RenderDate,
  Spacer,
  Text
} from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { RiAddLine, RiEyeLine, RiEyeOffLine, RiMore2Line } from '@remixicon/react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RouterPanel } from '../routerPanel';
import { showCallbackDestinationFormModal } from './destinationModal';
import { CallbackNotificationsTable } from './logs';

let getMaskedSigningSecret = (signingSecret: string) => {
  let prefix = 'metorial_whsec_';
  if (signingSecret.startsWith(prefix)) return `${prefix}${'*'.repeat(12)}`;
  return '*'.repeat(Math.min(Math.max(signingSecret.length, 8), 24));
};

let SigningSecretFooter = ({ signingSecret }: { signingSecret: string | null }) => {
  let [revealed, setRevealed] = useState(false);

  return (
    <Entity.Footer>
      <div
        onClick={event => event.stopPropagation()}
        onKeyDown={event => event.stopPropagation()}
        style={{ width: '100%' }}
      >
        {signingSecret ? (
          <Flex gap={10} align="end" wrap="wrap">
            <div style={{ flex: 1, minWidth: 260 }}>
              <Copy
                label="Signing Secret"
                value={revealed ? signingSecret : getMaskedSigningSecret(signingSecret)}
                copyValue={signingSecret}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="3"
              iconLeft={revealed ? <RiEyeOffLine /> : <RiEyeLine />}
              onClick={() => setRevealed(current => !current)}
            />
          </Flex>
        ) : (
          <Text size="2" color="gray600">
            Signing secret is not available for this destination.
          </Text>
        )}
      </div>
    </Entity.Footer>
  );
};

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

      {renderWithLoader({ destinations })(({ destinations }) => (
        <>
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
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No destinations are attached to this callback yet.
            </Text>
          )}

          <Spacer height={15} />

          <Button
            iconRight={<RiAddLine />}
            size="2"
            onClick={() =>
              instance.data &&
              showCallbackDestinationFormModal({
                instanceId: instance.data.id,
                onCreate: destination => {
                  let nextDestinationIds = [
                    ...new Set([...selectedDestinationIds, destination.id])
                  ];
                  setSelectedDestinationIds(nextDestinationIds);
                  updateCallback.mutate({
                    destinationIds: nextDestinationIds
                  });

                  destinations.refetch();
                }
              })
            }
          >
            Create Destination
          </Button>
        </>
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
      <Entity.Wrapper>
        <Entity.Content>
          <Entity.Field title="ID" value={<ID id={destination.data.id} />} />
          <Entity.Field title="Status" value={destination.data.status} />
          <Entity.Field title="URL" value={<Copy value={destination.data.url} />} />
          <Entity.Field title="Method" value={destination.data.method} />
          <Entity.Field
            title="Created"
            value={<RenderDate date={destination.data.createdAt} />}
          />
        </Entity.Content>
        <SigningSecretFooter signingSecret={destination.data.signingSecret} />
      </Entity.Wrapper>

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
