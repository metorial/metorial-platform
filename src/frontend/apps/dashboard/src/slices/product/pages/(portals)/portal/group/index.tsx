import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useMagicMcpGroups,
  usePortal,
  usePortalAccesses,
  usePortalConsumerGroup
} from '@metorial/state';
import { Button, Checkbox, Entity, Input, Panel, showModal, Spacer, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDebounced } from '../../../../../../hooks/useDebounced';

export let PortalGroupOverviewPage = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.id, params.portalId!);
  let group = usePortalConsumerGroup(instance.data?.id, portal.data?.id, params.groupId);

  let magicMcpAccess = usePortalAccesses(
    instance.data?.id,
    group.data ? portal.data?.id : undefined,
    {
      consumerGroupId: group.data?.id,
      type: 'magic_mcp_group'
    }
  );
  let magicMcpAccessOuter = magicMcpAccess;
  let removeMagicMcpAccessMutator = magicMcpAccess.deleteMutator();

  return renderWithLoader({ group })(({ group }) => (
    <>
      <Box
        title="Magic MCP Servers"
        description="Which Magic MCP servers to members of this group have access to."
        rightActions={
          <Button
            size="2"
            onClick={() =>
              showModal(({ dialogProps, close }) => {
                let [selected, setSelected] = useState<string>();
                let [search, setSearch] = useState('');
                let searchDebounced = useDebounced(search, 300);

                let addAccessMutator = magicMcpAccessOuter.createMutator();

                let servers = useMagicMcpGroups(instance.data?.id, {
                  limit: 100,
                  search: searchDebounced
                });

                return (
                  <Panel.Wrapper {...dialogProps}>
                    <Panel.Header>
                      <Panel.Title>Add Access to Magic MCP Group</Panel.Title>
                      <Panel.Description>
                        Add access to a Magic MCP group for members of this consumer group.
                      </Panel.Description>
                    </Panel.Header>

                    <Panel.Content>
                      <Input
                        placeholder="Search servers..."
                        label="Search Servers"
                        hideLabel
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />

                      <Spacer height={15} />

                      {renderWithPagination(servers)(servers =>
                        servers.data.items.map(server => (
                          <div
                            key={server.id}
                            onClick={() => {
                              setSelected(prev => {
                                if (prev == server.id) {
                                  return undefined;
                                } else {
                                  return server.id;
                                }
                              });
                            }}
                          >
                            <Entity.Wrapper>
                              <Entity.Content>
                                <Entity.Field
                                  prefix={
                                    <Checkbox
                                      checked={selected === server.id}
                                      onCheckedChange={v =>
                                        setSelected(prev => {
                                          if (prev == server.id) {
                                            return undefined;
                                          } else {
                                            return server.id;
                                          }
                                        })
                                      }
                                      label="Select Server"
                                      hideLabel
                                    />
                                  }
                                  title={server.name}
                                  description={server.description}
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
                        onClick={async () => {
                          if (!selected) return;
                          let [res] = await addAccessMutator.mutate({
                            consumerGroupId: group.data!.id,
                            access: {
                              type: 'magic_mcp_group',
                              magicMcpGroupId: selected
                            }
                          });
                          if (res) {
                            magicMcpAccessOuter.refetch();
                            close();
                          }
                        }}
                      >
                        Add Magic MCP Group
                      </Button>
                    </Panel.Content>
                  </Panel.Wrapper>
                );
              })
            }
          >
            Add Magic MCP Group Access
          </Button>
        }
      >
        {renderWithPagination(magicMcpAccess)(accesses => (
          <>
            <Table
              headers={['Name', '']}
              data={accesses.data.items.map(access => ({
                data: [
                  <Text>{access.access.magicMcpGroup.name}</Text>,

                  <div
                    onClick={e => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'flex-end'
                    }}
                  >
                    <Button
                      size="1"
                      variant="outline"
                      disabled={removeMagicMcpAccessMutator.isLoading}
                      loading={
                        removeMagicMcpAccessMutator.isLoading &&
                        removeMagicMcpAccessMutator.input?.accessId === access.id
                      }
                      onClick={async () => {
                        let [res] = await removeMagicMcpAccessMutator.mutate({
                          accessId: access.id
                        });
                        if (res) magicMcpAccessOuter.refetch();
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ],
                href: Paths.instance.portal(
                  instance.data?.organization,
                  instance.data?.project,
                  instance.data,
                  access.id
                )
              }))}
            />

            {accesses.data.items.length == 0 && (
              <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
                This group has access to no resources.
              </Text>
            )}
          </>
        ))}
      </Box>
    </>
  ));
};
