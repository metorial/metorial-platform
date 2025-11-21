import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  getServer,
  useCreateServerDeploymentTemplate,
  useCurrentInstance,
  useMagicMcpGroups,
  usePortal,
  usePortalAccesses,
  usePortalConsumerGroup,
  useServerListings,
  useUpdateServerDeploymentTemplate
} from '@metorial/state';
import {
  AccordionSingle,
  Button,
  Checkbox,
  Copy,
  Dialog,
  Entity,
  Input,
  Panel,
  showModal,
  Spacer,
  Text
} from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Markdown } from '../../../../../../components/markdown';
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

  let serverDeploymentTemplateAccess = usePortalAccesses(
    instance.data?.id,
    group.data ? portal.data?.id : undefined,
    {
      consumerGroupId: group.data?.id,
      type: 'server_deployment_template'
    }
  );
  let serverDeploymentTemplateAccessOuter = serverDeploymentTemplateAccess;
  let removeDeploymentServerTemplateAccessMutator =
    serverDeploymentTemplateAccess.deleteMutator();

  return renderWithLoader({ group })(({ group }) => (
    <>
      <Box
        title="Magic MCP Servers"
        description="Choose which Magic MCP servers members of this group have access to."
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
                  limit: 20,
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
                                    <div
                                      onClick={e => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                      }}
                                    >
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
                                    </div>
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
                        loading={addAccessMutator.isLoading}
                        success={addAccessMutator.isSuccess}
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
                  <Text>
                    {access.access.type == 'magic_mcp_group'
                      ? access.access.magicMcpGroup.name
                      : 'Unknown'}
                  </Text>,

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
                ]
              }))}
            />

            {accesses.data.items.length == 0 && (
              <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
                This group doesn't have access to any Magic MCP groups.
              </Text>
            )}
          </>
        ))}
      </Box>

      <Spacer height={20} />

      <Box
        title="Deployable Servers"
        description="Choose which MCP servers can be self-deployed by members of this group."
        rightActions={
          <Button
            size="2"
            onClick={() =>
              showModal(({ dialogProps, close }) => {
                let [selected, setSelected] = useState<string>();
                let [search, setSearch] = useState('');
                let searchDebounced = useDebounced(search, 300);

                let addAccessMutator = serverDeploymentTemplateAccessOuter.createMutator();

                let createTemplateMutator = useCreateServerDeploymentTemplate();

                let servers = useServerListings({
                  limit: 20,
                  search: searchDebounced
                });

                let [loading, setLoading] = useState(false);

                return (
                  <Panel.Wrapper {...dialogProps}>
                    <Panel.Header>
                      <Panel.Title>Add Access to Server</Panel.Title>
                      <Panel.Description>
                        Add access to an MCP server for members of this consumer group.
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
                                        label="Select Server"
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
                        loading={loading}
                        onClick={async () => {
                          if (!selected) return;

                          setLoading(true);

                          let listing = servers.data?.items.find(s => s.id === selected);
                          if (!listing) return;

                          let [server] = await getServer(instance.data!.id, listing.server.id);
                          if (!server) return;

                          let doCreate = async (
                            client:
                              | {
                                  clientId: string;
                                  clientSecret: string;
                                }
                              | undefined
                          ) => {
                            try {
                              let [template] = await createTemplateMutator.mutate({
                                name: listing.name,
                                serverId: server.id,
                                instanceId: instance.data!.id,
                                oauth: client
                              });
                              if (!template) {
                                setLoading(false);
                                return;
                              }

                              let [res] = await addAccessMutator.mutate({
                                consumerGroupId: group.data!.id,
                                access: {
                                  type: 'server_deployment_template',
                                  serverDeploymentTemplateId: template.id
                                }
                              });
                              if (res) {
                                serverDeploymentTemplateAccessOuter.refetch();
                                close();
                              }
                            } finally {
                              setLoading(false);
                            }
                          };

                          if (
                            server.variants.some(
                              v =>
                                v.currentVersion?.oauth.status == 'enabled' &&
                                v.currentVersion?.oauth.credentialProvider == 'manual'
                            )
                          ) {
                            setTimeout(() => setLoading(false), 1000);

                            showModal(({ dialogProps, close }) => {
                              let form = useForm({
                                initialValues: {
                                  clientId: '',
                                  clientSecret: ''
                                },
                                schema: yup =>
                                  yup.object({
                                    clientId: yup.string().required('Client ID is required'),
                                    clientSecret: yup
                                      .string()
                                      .required('Client Secret is required')
                                  }),
                                onSubmit: async values => {
                                  doCreate({
                                    clientId: values.clientId,
                                    clientSecret: values.clientSecret
                                  });

                                  close();
                                }
                              });

                              let rootDomain = document.location.hostname
                                .split('.')
                                .slice(-2)
                                .join('.');
                              return (
                                <Dialog.Wrapper {...dialogProps}>
                                  <Dialog.Title>OAuth Configuration Required</Dialog.Title>

                                  <Dialog.Description>
                                    Please provide an OAuth Client ID and Client Secret to
                                    proceed with the server deployment template.
                                  </Dialog.Description>

                                  {listing.oauthExplainer && (
                                    <>
                                      <AccordionSingle title="OAuth Setup Instructions">
                                        <Markdown>{listing.oauthExplainer}</Markdown>
                                      </AccordionSingle>
                                      <Spacer size={10} />
                                    </>
                                  )}

                                  <Copy
                                    label="Redirect URL"
                                    value={`https://provider-auth.${rootDomain}/provider-oauth/callback`}
                                  />
                                  <Spacer size={15} />

                                  <form onSubmit={form.handleSubmit}>
                                    <Input
                                      label="Client ID"
                                      placeholder="Enter your OAuth Client ID"
                                      {...form.getFieldProps('clientId')}
                                      autoFocus
                                    />
                                    <form.RenderError field="clientId" />
                                    <Spacer size={15} />

                                    <Input
                                      label="Client Secret"
                                      placeholder="Enter your OAuth Client Secret"
                                      type="password"
                                      {...form.getFieldProps('clientSecret')}
                                    />
                                    <form.RenderError field="clientSecret" />
                                    <Spacer size={15} />

                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        gap: 10
                                      }}
                                    >
                                      <Button type="submit" loading={form.isSubmitting}>
                                        Submit
                                      </Button>
                                    </div>
                                  </form>
                                </Dialog.Wrapper>
                              );
                            });
                          } else {
                            doCreate(undefined);
                          }
                        }}
                      >
                        Add Server
                      </Button>
                    </Panel.Content>
                  </Panel.Wrapper>
                );
              })
            }
          >
            Add Server Access
          </Button>
        }
      >
        {renderWithPagination(serverDeploymentTemplateAccess)(accesses => (
          <>
            <Table
              headers={['Name', '']}
              data={accesses.data.items.map(access => ({
                data: [
                  <Text>
                    {access.access.type == 'server_deployment_template'
                      ? access.access.serverDeploymentTemplate.name
                      : 'Unknown'}
                  </Text>,

                  <div
                    onClick={e => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      gap: 10,
                      justifyContent: 'flex-end'
                    }}
                  >
                    <Button
                      size="1"
                      variant="outline"
                      disabled={
                        removeDeploymentServerTemplateAccessMutator.isLoading &&
                        removeDeploymentServerTemplateAccessMutator.input?.accessId ===
                          access.id
                      }
                      onClick={() =>
                        showModal(({ dialogProps, close }) => {
                          let template =
                            access.access.type == 'server_deployment_template'
                              ? access.access.serverDeploymentTemplate
                              : undefined!;

                          let update = useUpdateServerDeploymentTemplate();

                          let form = useForm({
                            initialValues: {
                              name: template.name,
                              description: template.description || ''
                            },
                            schema: yup =>
                              yup.object({
                                name: yup.string().required('Name is required'),
                                description: yup.string()
                              }),
                            onSubmit: async values => {
                              let [res] = await update.mutate({
                                serverDeploymentTemplateId: template.id,
                                instanceId: instance.data!.id,
                                name: values.name,
                                description: values.description
                              });
                              if (res) {
                                close();
                                serverDeploymentTemplateAccessOuter.refetch();
                              }
                            }
                          });

                          return (
                            <Dialog.Wrapper {...dialogProps}>
                              <Dialog.Title>Update Server Deployment Template</Dialog.Title>

                              <Dialog.Description>
                                Update the details of the server deployment template.
                              </Dialog.Description>

                              <form onSubmit={form.handleSubmit}>
                                <Input
                                  label="Name"
                                  placeholder="Enter template name"
                                  {...form.getFieldProps('name')}
                                  autoFocus
                                />
                                <form.RenderError field="name" />
                                <Spacer size={15} />

                                <Input
                                  label="Description"
                                  placeholder="Enter template description"
                                  {...form.getFieldProps('description')}
                                />
                                <form.RenderError field="description" />
                                <Spacer size={15} />

                                <Button type="submit" loading={form.isSubmitting}>
                                  Update Template
                                </Button>
                              </form>
                            </Dialog.Wrapper>
                          );
                        })
                      }
                    >
                      Update
                    </Button>

                    <Button
                      size="1"
                      variant="outline"
                      disabled={removeDeploymentServerTemplateAccessMutator.isLoading}
                      loading={
                        removeDeploymentServerTemplateAccessMutator.isLoading &&
                        removeDeploymentServerTemplateAccessMutator.input?.accessId ===
                          access.id
                      }
                      onClick={async () => {
                        let [res] = await removeDeploymentServerTemplateAccessMutator.mutate({
                          accessId: access.id
                        });
                        if (res) magicMcpAccessOuter.refetch();
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ]
              }))}
            />

            {accesses.data.items.length == 0 && (
              <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
                This group doesn't have access to any MCP servers.
              </Text>
            )}
          </>
        ))}
      </Box>
    </>
  ));
};
