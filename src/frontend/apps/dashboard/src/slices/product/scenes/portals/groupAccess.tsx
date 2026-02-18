import {
  DashboardInstanceServersDeploymentsTemplatesCreateOutput,
  ServersListingsGetOutput
} from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { renderWithPagination, useForm } from '@metorial/data-hooks';
import { delay } from '@metorial/delay';
import {
  createSessionTemplate,
  getProvider,
  useCreateSessionTemplate,
  useCurrentInstance,
  useMagicMcpServers,
  usePortal,
  usePortalAccesses,
  usePortalConsumerGroup,
  useProviderListings,
  useUpdateSessionTemplate
} from '@metorial/state';
import {
  AccordionSingle,
  Button,
  Checkbox,
  Copy,
  Dialog,
  Entity,
  Input,
  Menu,
  Panel,
  showModal,
  Spacer,
  Text
} from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { useState } from 'react';
import { Markdown } from '../../../../components/markdown';
import { useDebounced } from '../../../../hooks/useDebounced';

export let PortalGroupAccess = (p: { portalId: string; groupId: string }) => {
  let instance = useCurrentInstance();
  let portal = usePortal(instance.data?.id, p.portalId!);
  let group = usePortalConsumerGroup(instance.data?.id, portal.data?.id, p.groupId);

  let serverDeploymentTemplateAccess = usePortalAccesses(
    instance.data?.id,
    group.data ? portal.data?.id : undefined,
    {
      consumerGroupId: group.data?.id,
      type: 'server_deployment_template'
    }
  );
  let removeDeploymentServerTemplateAccessMutator =
    serverDeploymentTemplateAccess.deleteMutator();
  let addAccessMutator = serverDeploymentTemplateAccess.createMutator();

  let linkMagicMcpServer = () =>
    showModal(({ dialogProps, close }) => {
      let [selected, setSelected] = useState<string>();
      let [search, setSearch] = useState('');
      let searchDebounced = useDebounced(search, 300);

      let createTemplateMutator = useCreateSessionTemplate();

      let servers = useMagicMcpServers(instance.data?.id, {
        limit: 20,
        search: searchDebounced
      });

      let [loading, setLoading] = useState(false);

      return (
        <Panel.Wrapper {...dialogProps}>
          <Panel.Header>
            <Panel.Title>Add Access to Magic MCP Server</Panel.Title>
            <Panel.Description>
              Add access to a Magic MCP server for members of this consumer group.
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
                              label="Select Provider"
                              hideLabel
                            />
                          </div>
                        }
                        title={server.name ?? 'Untitled Server'}
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
              loading={loading}
              onClick={async () => {
                setLoading(true);

                try {
                  if (!selected) return;
                  let server = servers.data?.items.find(s => s.id === selected);
                  if (!server) return;

                  let defaultServerDeployment = server.serverDeployments[0];
                  if (!defaultServerDeployment) return;

                  let [templateRes] = await createTemplateMutator.mutate({
                    name: server.name ?? 'Untitled',
                    instanceId: instance.data!.id
                  });
                  if (!templateRes) return;

                  let [res] = await addAccessMutator.mutate({
                    consumerGroupId: group.data!.id,
                    access: {
                      type: 'server_deployment_template',
                      serverDeploymentTemplateId: templateRes.id
                    }
                  });
                  if (res) {
                    serverDeploymentTemplateAccess.refetch();
                    close();
                  }
                } finally {
                  setLoading(false);
                }
              }}
            >
              Add Magic MCP Group
            </Button>
          </Panel.Content>
        </Panel.Wrapper>
      );
    });

  return (
    <>
      <Box
        title="Deployable Providers"
        description="Choose which MCP providers can be self-deployed by members of this group."
        rightActions={
          <Menu
            items={[
              {
                id: 'magic-mcp-server',
                label: 'Magic MCP Server',
                description: 'Add access to an existing Magic MCP server'
              },
              {
                id: 'server-deployment-template',
                label: 'Self-Hosted MCP Provider',
                description: 'Let the members deploy a specific MCP provider themselves'
              }
            ]}
            onItemClick={id => {
              switch (id) {
                case 'magic-mcp-server':
                  linkMagicMcpServer();
                  break;
                case 'server-deployment-template':
                  linkServerDeploymentTemplate({
                    addAccess: async template => {
                      let [res] = await addAccessMutator.mutate({
                        consumerGroupId: group.data!.id,
                        access: {
                          type: 'server_deployment_template',
                          serverDeploymentTemplateId: template.id
                        }
                      });

                      return !!res;
                    }
                  });
                  break;
              }
            }}
          >
            <Button size="2">Add Provider Access</Button>
          </Menu>
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

                          let update = useUpdateSessionTemplate();

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
                                sessionTemplateId: template.id,
                                instanceId: instance.data!.id,
                                name: values.name,
                                description: values.description
                              });
                              if (res) {
                                close();
                                serverDeploymentTemplateAccess.refetch();
                              }
                            }
                          });

                          return (
                            <Dialog.Wrapper {...dialogProps}>
                              <Dialog.Title>Update Server Listing</Dialog.Title>

                              <Dialog.Description>
                                This is how users will see this server deployment template when
                                deploying it themselves.
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
                        if (res) {
                          serverDeploymentTemplateAccess.refetch();
                        }
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
                This group doesn't have access to any MCP providers.
              </Text>
            )}
          </>
        ))}
      </Box>
    </>
  );
};

export let linkServerDeploymentTemplate = (p: {
  addAccess: (
    template: DashboardInstanceServersDeploymentsTemplatesCreateOutput
  ) => Promise<boolean>;
}) =>
  showModal(({ dialogProps, close }) => {
    let instance = useCurrentInstance();

    let [selected, setSelected] = useState<string>();
    let [search, setSearch] = useState('');
    let searchDebounced = useDebounced(search, 300);

    let servers = useProviderListings({
      limit: 20,
      search: searchDebounced
    });

    let [loading, setLoading] = useState(false);

    return (
      <Panel.Wrapper {...dialogProps}>
        <Panel.Header>
          <Panel.Title>Add Access to Provider</Panel.Title>
          <Panel.Description>
            Add access to an MCP provider for members of this consumer group.
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
            loading={loading}
            onClick={async () => {
              if (!selected) return;

              setLoading(true);

              let listing = servers.data?.items.find(s => s.id === selected);
              if (!listing) return;

              try {
                await createSessionTemplateForConsumerSurface({
                  instanceId: instance.data!.id,
                  serverId: listing.id,
                  listing: listing as unknown as ServersListingsGetOutput,
                  addAccess: p.addAccess
                });
                close();
              } finally {
                setLoading(false);
              }
            }}
          >
            Add Provider
          </Button>
        </Panel.Content>
      </Panel.Wrapper>
    );
  });

export let createSessionTemplateForConsumerSurface = async ({
  instanceId,
  serverId,
  addAccess,
  listing
}: {
  instanceId: string;
  serverId: string;
  listing?: ServersListingsGetOutput;
  addAccess: (
    template: DashboardInstanceServersDeploymentsTemplatesCreateOutput
  ) => Promise<boolean>;
}) => {
  let [provider] = await getProvider(instanceId, serverId);
  if (!provider) return;

  let doCreate = async (
    client:
      | {
          clientId: string;
          clientSecret: string;
        }
      | undefined
  ) => {
    let [template] = await createSessionTemplate({
      name: provider.name,
      instanceId: instanceId
    });
    if (!template) return;

    let ok = await addAccess(template as unknown as DashboardInstanceServersDeploymentsTemplatesCreateOutput);
    if (ok) close();
  };

  if (
    false /* OAuth status checking removed in Provider API migration */
  ) {
    showModal(({ dialogProps, close }) => {
      let form = useForm({
        initialValues: {
          clientId: '',
          clientSecret: ''
        },
        schema: yup =>
          yup.object({
            clientId: yup.string().required('Client ID is required'),
            clientSecret: yup.string().required('Client Secret is required')
          }),
        onSubmit: async values => {
          doCreate({
            clientId: values.clientId,
            clientSecret: values.clientSecret
          });

          close();
        }
      });

      let rootDomain = document.location.hostname.split('.').slice(-2).join('.');
      return (
        <Dialog.Wrapper {...dialogProps}>
          <Dialog.Title>OAuth Configuration Required</Dialog.Title>

          <Dialog.Description>
            Please provide an OAuth Client ID and Client Secret to proceed with the server
            deployment template.
          </Dialog.Description>

          {listing?.oauthExplainer && (
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

    return delay(1000);
  } else {
    await doCreate(undefined);
  }
};
