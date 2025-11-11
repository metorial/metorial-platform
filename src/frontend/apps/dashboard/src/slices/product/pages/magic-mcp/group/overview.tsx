import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useMagicMcpGroup, useMagicMcpServers } from '@metorial/state';
import {
  Attributes,
  Button,
  Checkbox,
  Entity,
  Input,
  Panel,
  RenderDate,
  showModal,
  Spacer,
  Text
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDebounced } from '../../../../../hooks/useDebounced';
import {
  createMagicMcpTokenModal,
  MagicTokensTable
} from '../../../scenes/magicMcp/tokensTable';

export let MagicMcpGroupOverviewPage = () => {
  let instance = useCurrentInstance();

  let { magicMcpGroupId } = useParams();
  let group = useMagicMcpGroup(instance.data?.id, magicMcpGroupId);
  let groupOuter = group;
  let removeServersMutator = group.useRemoveServersMutator();

  let servers = useMagicMcpServers(instance.data?.id, {
    order: 'desc',
    magicMcpGroupId
  });
  let serversOuter = servers;

  return renderWithLoader({ group })(({ group }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: group.data.name
          },
          {
            label: 'ID',
            content: <ID id={group.data.id} />
          },
          {
            label: 'Slug',
            content: <ID id={group.data.slug} />
          },
          {
            label: 'Created At',
            content: <RenderDate date={group.data.createdAt!} />
          }
        ]}
      />

      <Spacer height={15} />

      <Box
        title="Magic MCP Servers"
        description="Use this Magic MCP endpoint to connect to your server."
        rightActions={
          <Button
            size="2"
            onClick={() =>
              showModal(({ dialogProps, close }) => {
                let [selected, setSelected] = useState<string[]>([]);
                let [search, setSearch] = useState('');
                let searchDebounced = useDebounced(search, 300);

                let addServersMutator = groupOuter.useAddServersMutator();

                let servers = useMagicMcpServers(instance.data?.id, {
                  limit: 100,
                  search: searchDebounced
                });

                return (
                  <Panel.Wrapper {...dialogProps}>
                    <Panel.Header>
                      <Panel.Title>Add Servers To Group</Panel.Title>
                      <Panel.Description>
                        Add Magic MCP servers to this group.
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
                              let v = !selected.includes(server.id);
                              setSelected(prev => {
                                if (v) {
                                  return [...prev, server.id];
                                } else {
                                  return prev.filter(id => id !== server.id);
                                }
                              });
                            }}
                          >
                            <Entity.Wrapper>
                              <Entity.Content>
                                <Entity.Field
                                  prefix={
                                    <Checkbox
                                      checked={selected.includes(server.id)}
                                      onCheckedChange={v =>
                                        setSelected(prev => {
                                          if (v) {
                                            return [...prev, server.id];
                                          } else {
                                            return prev.filter(id => id !== server.id);
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
                        disabled={selected.length === 0}
                        onClick={async () => {
                          let [res] = await addServersMutator.mutate({
                            magicMcpServerIds: selected
                          });
                          if (res) {
                            serversOuter.refetch();
                            close();
                          }
                        }}
                      >
                        Add Selected Servers
                      </Button>
                    </Panel.Content>
                  </Panel.Wrapper>
                );
              })
            }
          >
            Add Server
          </Button>
        }
      >
        {renderWithPagination(servers)(servers => (
          <>
            <Table
              headers={['Name', '']}
              data={servers.data.items.map(server => ({
                data: [
                  <div>
                    <Text size="2" weight="strong">
                      {server.name}
                    </Text>
                    {server.description && (
                      <Text size="1" color="gray600">
                        {server.description}
                      </Text>
                    )}
                  </div>,

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
                      disabled={removeServersMutator.isLoading}
                      loading={
                        removeServersMutator.isLoading &&
                        removeServersMutator.input?.magicMcpServerIds?.includes(server.id)
                      }
                      onClick={async () => {
                        let [res] = await removeServersMutator.mutate({
                          magicMcpServerIds: [server.id]
                        });
                        if (res) serversOuter.refetch();
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ],
                href: Paths.instance.magicMcp.server(
                  instance.data?.organization,
                  instance.data?.project,
                  instance.data,
                  server.id
                )
              }))}
            />

            {servers.data.items.length == 0 && (
              <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
                No Magic MCP servers found.
              </Text>
            )}
          </>
        ))}
      </Box>

      <Spacer height={15} />

      <Box
        title="Magic MCP Tokens"
        description="Tokens which have access to the servers in this group."
        rightActions={
          <Button
            size="2"
            onClick={() =>
              createMagicMcpTokenModal({
                groupId: group.data.id
              })
            }
          >
            Create Token for Group
          </Button>
        }
      >
        <MagicTokensTable limit={15} magicMcpGroupId={group.data.id} />
      </Box>
    </>
  ));
};
