import { renderWithPagination } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  usePortal,
  usePortalFeaturedServers,
  useProviderListings
} from '@metorial/state';
import {
  Button,
  Checkbox,
  Entity,
  Flex,
  Input,
  Panel,
  showModal,
  Spacer,
  Text
} from '@metorial/ui';
import { SideBox, Table } from '@metorial/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDebounced } from '../../../../../../hooks/useDebounced';

export let PortalFeaturedServersPage = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.id, params.portalId!);

  let requests = usePortalFeaturedServers(instance.data?.id, portal.data?.id);
  let requestsOuter = requests;

  let removeListing = requests.removeListingMutator();

  return renderWithPagination(requests)(requests => (
    <>
      <SideBox
        title="Featured Providers"
        description="Select which providers to feature on your portal."
      >
        <Button
          size="2"
          onClick={() => {
            showModal(({ dialogProps, close }) => {
              let addListing = requestsOuter.addListingMutator();

              let [selected, setSelected] = useState<string>();
              let [search, setSearch] = useState('');
              let searchDebounced = useDebounced(search, 300);

              let servers = useProviderListings({
                limit: 20,
                search: searchDebounced
              });

              return (
                <Panel.Wrapper {...dialogProps}>
                  <Panel.Header>
                    <Panel.Title>Add Featured Provider</Panel.Title>
                    <Panel.Description>
                      Select a provider to feature on your portal.
                    </Panel.Description>
                  </Panel.Header>

                  <Panel.Content>
                    <Input
                      placeholder="Search providers..."
                      label="Search Providers"
                      hideLabel
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />

                    <Spacer height={15} />

                    {renderWithPagination(servers)(servers =>
                      servers.data.items.map(listing => (
                        <div
                          key={listing.id}
                          onClick={() => {
                            setSelected(prev => {
                              if (prev == listing.id) {
                                return undefined;
                              } else {
                                return listing.id;
                              }
                            });
                          }}
                        >
                          <Entity.Wrapper>
                            <Entity.Content>
                              <Entity.Field
                                prefix={
                                  <div
                                    onClick={e => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                    }}
                                  >
                                    <Checkbox
                                      checked={selected === listing.id}
                                      onCheckedChange={v =>
                                        setSelected(prev => {
                                          if (prev == listing.id) {
                                            return undefined;
                                          } else {
                                            return listing.id;
                                          }
                                        })
                                      }
                                      label="Select Provider"
                                      hideLabel
                                    />
                                  </div>
                                }
                                title={listing.name}
                                description={listing.description}
                              />
                            </Entity.Content>
                          </Entity.Wrapper>
                        </div>
                      ))
                    )}

                    <Spacer height={15} />

                    <Button
                      fullWidth
                      size="2"
                      disabled={!selected}
                      loading={addListing.isLoading}
                      success={addListing.isSuccess}
                      onClick={async () => {
                        if (!selected) return;

                        let listing = servers.data?.items.find(s => s.id === selected);
                        if (!listing) return;

                        let [res] = await addListing.mutate({
                          serverId: listing.id
                        });
                        if (res) {
                          setTimeout(() => close(), 500);
                        }
                      }}
                    >
                      Add Featured Provider
                    </Button>
                  </Panel.Content>
                </Panel.Wrapper>
              );
            });
          }}
        >
          Feature Provider
        </Button>
      </SideBox>

      <Spacer height={5} />

      <Table
        headers={['Provider', '']}
        data={requests.data.items.map(request => ({
          data: [
            request.server.name,
            <Flex justify="end" gap={10} style={{ width: '100%' }}>
              <Button
                size="1"
                variant="outline"
                disabled={removeListing.isLoading}
                onClick={async () => {
                  await removeListing.mutate({
                    serverId: request.server.id
                  });
                }}
              >
                Remove
              </Button>
            </Flex>
          ]
        }))}
      />

      {requests.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No featured providers found.
        </Text>
      )}
    </>
  ));
};
