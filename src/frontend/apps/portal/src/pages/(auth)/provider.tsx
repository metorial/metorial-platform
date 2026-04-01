import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  Attributes,
  Badge,
  Button,
  Callout,
  Dialog,
  Entity,
  Input,
  RenderDate,
  Select,
  showModal,
  Spacer,
  Text,
  theme
} from '@metorial/ui';
import { RiArrowRightUpLine, RiExternalLinkLine } from '@remixicon/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { JsonSchemaInput } from '../../scenes/jsonSchemaInput';
import {
  deployProvider,
  rememberPendingProviderSetup,
  requestProviderAccess,
  startProviderSetup,
  usePendingProviderSetup,
  useProviderCatalogItem
} from '../../state/consumer/catalog';
import { usePaths } from '../../state/portal/path';

let Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

let Split = styled.div`
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.9fr);

  @media (max-width: 1080px) {
    grid-template-columns: 1fr;
  }
`;

let Card = styled.div`
  padding: 24px;
  border-radius: 20px;
  border: 1px solid ${theme.colors.gray400};
  background: white;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
`;

let Inline = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

let FieldStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

let ProviderDeployButton = styled(Button)`
  width: fit-content;
`;

let getTargetLabel = (input: { name: string | null; description: string | null; id: string }) => {
  return input.name || input.description || input.id;
};

let showRequestAccessModal = (catalogItemId: string) =>
  showModal(({ dialogProps, close }) => {
    let form = useForm({
      initialValues: {
        message: ''
      },
      schema: yup =>
        yup.object({
          message: yup.string().max(500, 'Use 500 characters or fewer')
        }),
      onSubmit: async values => {
        await requestProviderAccess(catalogItemId, {
          message: values.message || undefined
        });
        close();
      }
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={520}>
        <Dialog.Title>Request access</Dialog.Title>
        <Dialog.Description>
          This creates a portal access request for the selected provider. Include context if the reviewer needs deployment details.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input
            label="Message"
            placeholder="Why do you need access?"
            {...form.getFieldProps('message')}
          />
          <form.RenderError field="message" />

          <Spacer height={18} />

          <Dialog.Actions>
            <Button type="button" variant="soft" color="gray" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">Send request</Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

export let ProviderPage = () => {
  let { catalogItemId } = useParams();
  let Paths = usePaths();
  let navigate = useNavigate();

  let providerItem = useProviderCatalogItem(catalogItemId);
  let pendingSetup = usePendingProviderSetup();

  let [deploymentName, setDeploymentName] = useState('');
  let [deploymentDescription, setDeploymentDescription] = useState('');
  let [selectedAuthMethodId, setSelectedAuthMethodId] = useState<string | null>(null);
  let [manualAuthValue, setManualAuthValue] = useState<Record<string, any>>({});
  let [configValue, setConfigValue] = useState<Record<string, any>>({});
  let [deploying, setDeploying] = useState(false);
  let [startingSetup, setStartingSetup] = useState(false);
  let [actionError, setActionError] = useState<string | null>(null);
  let providerTemplateItem =
    providerItem.data?.type == 'provider_template' ? providerItem.data : null;
  let pendingSetupAuthMethodId =
    providerTemplateItem && pendingSetup.pending?.catalogItemId == providerTemplateItem.id
      ? pendingSetup.pending.providerAuthMethodId
      : null;
  let authMethodIds = providerTemplateItem?.authMethods.map(method => method.id).join(',') ?? '';

  useEffect(() => {
    if (!providerTemplateItem) return;

    let nextAuthMethodId =
      pendingSetupAuthMethodId &&
      providerTemplateItem.authMethods.some(method => method.id == pendingSetupAuthMethodId)
        ? pendingSetupAuthMethodId
        : providerTemplateItem.authMethods[0]?.id ?? null;

    setSelectedAuthMethodId(nextAuthMethodId);
    setManualAuthValue({});
  }, [providerTemplateItem?.id, authMethodIds, pendingSetupAuthMethodId]);

  return renderWithLoader({ providerItem })(({ providerItem }) => {
    let item = providerItem.data;
    let pendingSetupSession =
      pendingSetup.pending?.catalogItemId == item.id ? pendingSetup.setupSession.data : null;

    if (item.type == 'magic_mcp_server') {
      let target = item.magicMcpServer;

      return (
        <ContentLayout>
          <Spacer height={28} />

          <PageHeader
            title={getTargetLabel(target)}
            description="This catalog item is a preconfigured Magic MCP deployment exposed directly through the portal."
            actions={
              item.availability == 'available_now' ? (
                <Link to={Paths.magicMcpServer(target.id)}>
                  <Button as="span" size="2">
                    Open deployment
                  </Button>
                </Link>
              ) : (
                <Button size="2" onClick={() => showRequestAccessModal(item.id)}>
                  Request access
                </Button>
              )
            }
          />

          <Spacer height={16} />

          <Card>
            <Inline>
              <Badge color={item.availability == 'available_now' ? 'green' : 'orange'}>
                {item.availability == 'available_now' ? 'Available now' : 'Request access'}
              </Badge>
              <Badge color="gray">Magic MCP</Badge>
            </Inline>

            <Spacer height={16} />

            <Attributes
              attributes={[
                {
                  label: 'Description',
                  content: target.description || 'No description provided.'
                },
                {
                  label: 'Deployment ID',
                  content: target.id
                }
              ]}
            />
          </Card>
        </ContentLayout>
      );
    }

    let defaultAuthMethod = item.authMethods[0] ?? null;
    let effectiveSelectedAuthMethodId =
      selectedAuthMethodId ?? pendingSetupAuthMethodId ?? defaultAuthMethod?.id ?? null;
    let selectedAuthMethod =
      item.authMethods.find(method => method.id == effectiveSelectedAuthMethodId) ||
      defaultAuthMethod;

    let hasCompletedSetup = pendingSetupSession?.status == 'completed';
    let deploymentReadyText =
      !pendingSetupSession
        ? null
        : pendingSetupSession.status == 'completed'
          ? 'OAuth setup finished. You can create the deployment now.'
          : pendingSetupSession.status == 'pending'
            ? 'OAuth setup is still pending. Resume the external flow to continue.'
            : `Setup status: ${pendingSetupSession.status.replace(/_/g, ' ')}.`;

    let deploy = async () => {
      setActionError(null);
      setDeploying(true);

      try {
        let auth =
          selectedAuthMethod?.type == 'oauth'
            ? hasCompletedSetup && pendingSetupSession
              ? {
                  type: 'setup_session' as const,
                  providerSetupSessionId: pendingSetupSession.id
                }
              : undefined
            : selectedAuthMethod
              ? {
                  type: 'manual' as const,
                  providerAuthMethodId: selectedAuthMethod.id,
                  value: manualAuthValue
                }
              : undefined;

        let deployment = await deployProvider(item.id, {
          name: deploymentName || undefined,
          description: deploymentDescription || undefined,
          config: item.configSchema ? configValue : undefined,
          auth
        });

        if (pendingSetup.pending?.catalogItemId == item.id) {
          pendingSetup.clear();
        }

        navigate(Paths.magicMcpServer(deployment.id));
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Deployment failed.');
      } finally {
        setDeploying(false);
      }
    };

    let beginSetup = async () => {
      if (!selectedAuthMethod) return;

      setActionError(null);
      setStartingSetup(true);

      try {
        let setupSession = await startProviderSetup(item.id, {
          providerAuthMethodId: selectedAuthMethod.id
        });

        rememberPendingProviderSetup({
          catalogItemId: item.id,
          providerSetupSessionId: setupSession.id,
          providerAuthMethodId: selectedAuthMethod.id,
          createdAt: new Date().toISOString()
        });

        window.location.replace(setupSession.url);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Unable to start provider setup.');
      } finally {
        setStartingSetup(false);
      }
    };

    return (
      <ContentLayout>
        <Spacer height={28} />

        <PageHeader
          title={item.providerTemplate.name}
          description={item.providerTemplate.description || item.provider.description || 'Configure this provider template and turn it into an owned Magic MCP deployment.'}
          actions={
            <Inline>
              <Badge color={item.availability == 'available_now' ? 'green' : 'orange'}>
                {item.availability == 'available_now' ? 'Available now' : 'Request access'}
              </Badge>
              <Badge color="gray">Provider template</Badge>
            </Inline>
          }
        />

        <Spacer height={18} />

        <Split>
          <Section>
            <Card>
              <Text weight="bold">Provider context</Text>
              <Spacer height={12} />

              <Attributes
                attributes={[
                  {
                    label: 'Provider',
                    content: item.provider.name
                  },
                  {
                    label: 'Publisher',
                    content: item.provider.publisher.name
                  },
                  {
                    label: 'Identifier',
                    content: item.provider.identifier
                  },
                  {
                    label: 'Version',
                    content: item.provider.currentVersion?.version || 'Unversioned'
                  }
                ]}
              />

              <Spacer height={18} />

              <Link to={Paths.catalog()}>
                <Button as="span" variant="ghost" color="gray" size="1">
                  Back to catalog
                </Button>
              </Link>
            </Card>

            {item.availability != 'available_now' ? (
              <Card>
                <Text weight="bold">Access is managed by portal policy</Text>
                <Spacer height={10} />
                <Text size="2" color="gray700">
                  This provider exists in the catalog, but your current portal access does not allow direct deployment yet.
                </Text>

                <Spacer height={16} />

                <Button onClick={() => showRequestAccessModal(item.id)}>Request access</Button>
              </Card>
            ) : (
              <Card>
                <Text weight="bold">Create deployment</Text>
                <Spacer height={12} />

                <FieldStack>
                  <Input
                    label="Deployment name"
                    placeholder="Optional deployment name"
                    value={deploymentName}
                    onChange={event => setDeploymentName(event.target.value)}
                  />

                  <Input
                    label="Description"
                    placeholder="Optional deployment description"
                    value={deploymentDescription}
                    onChange={event => setDeploymentDescription(event.target.value)}
                  />

                  {item.authMethods.length > 0 && (
                    <Select
                      label="Authentication method"
                      value={selectedAuthMethod?.id || ''}
                      items={item.authMethods.map(method => ({
                        id: method.id,
                        label: method.name
                      }))}
                      onChange={value => {
                        setSelectedAuthMethodId(value || null);
                        setManualAuthValue({});
                      }}
                    />
                  )}

                  {selectedAuthMethod?.type == 'oauth' ? (
                    <>
                      <Callout color={hasCompletedSetup ? 'green' : 'blue'}>
                        {deploymentReadyText || 'OAuth setup creates reusable credentials for this deployment.'}
                      </Callout>

                      <Inline>
                        <Button loading={startingSetup} onClick={beginSetup}>
                          {hasCompletedSetup ? 'Restart setup' : 'Start OAuth setup'}
                        </Button>

                        {pendingSetupSession?.url && pendingSetupSession.status == 'pending' && (
                          <Button
                            variant="soft"
                            color="gray"
                            onClick={() => {
                              window.location.replace(pendingSetupSession.url);
                            }}
                          >
                            Resume external flow
                          </Button>
                        )}

                        {hasCompletedSetup && (
                          <Button
                            variant="soft"
                            color="gray"
                            onClick={() => {
                              pendingSetup.clear();
                            }}
                          >
                            Clear setup session
                          </Button>
                        )}
                      </Inline>
                    </>
                  ) : selectedAuthMethod?.inputSchema?.schema ? (
                    <JsonSchemaInput
                      label="Authentication payload"
                      schema={selectedAuthMethod.inputSchema.schema as any}
                      value={manualAuthValue}
                      onChange={value => setManualAuthValue(value)}
                    />
                  ) : selectedAuthMethod ? (
                    <Callout color="orange">
                      This auth method has no input schema. The deployment will use an empty manual payload unless the provider supplies defaults on the backend.
                    </Callout>
                  ) : null}

                  {item.configSchema?.schema && (
                    <JsonSchemaInput
                      label="Provider configuration"
                      schema={item.configSchema.schema as any}
                      value={configValue}
                      onChange={value => setConfigValue(value)}
                    />
                  )}

                  {actionError && <Callout color="red">{actionError}</Callout>}

                  <ProviderDeployButton
                    loading={deploying}
                    disabled={selectedAuthMethod?.type == 'oauth' && !hasCompletedSetup}
                    onClick={deploy}
                  >
                    Deploy as Magic MCP server
                  </ProviderDeployButton>
                </FieldStack>
              </Card>
            )}
          </Section>

          <Section>
            <Card>
              <Text weight="bold">Template details</Text>
              <Spacer height={12} />

              <Entity.Wrapper>
                <Entity.Content>
                  <Entity.Field title="Template ID" value={item.providerTemplate.id} />
                  <Entity.Field title="Provider deployment" value={item.deployment.id} />
                  <Entity.Field
                    title="OAuth"
                    value={
                      item.provider.oauth?.status == 'enabled'
                        ? 'Enabled'
                        : 'Not required'
                    }
                  />
                  <Entity.Field
                    title="Published"
                    value={<RenderDate date={item.provider.createdAt} />}
                  />
                </Entity.Content>
              </Entity.Wrapper>
            </Card>

            {item.authMethods.length > 0 && (
              <Card>
                <Text weight="bold">Auth methods</Text>
                <Spacer height={12} />

                <FieldStack>
                  {item.authMethods.map(method => (
                    <div key={method.id}>
                      <Inline>
                        <Badge color={method.type == 'oauth' ? 'blue' : 'gray'}>
                          {method.type}
                        </Badge>
                        {method.id == selectedAuthMethod?.id && <Badge color="green">Selected</Badge>}
                      </Inline>
                      <Spacer height={8} />
                      <Text weight="bold">{method.name}</Text>
                      <Text size="2" color="gray700">
                        {method.description || 'No description provided.'}
                      </Text>
                    </div>
                  ))}
                </FieldStack>
              </Card>
            )}

            {pendingSetupSession && (
              <Card>
                <Text weight="bold">Latest setup session</Text>
                <Spacer height={12} />

                <Attributes
                  attributes={[
                    {
                      label: 'Status',
                      content: pendingSetupSession.status
                    },
                    {
                      label: 'Mode',
                      content: pendingSetupSession.uiMode
                    },
                    {
                      label: 'Expires',
                      content: <RenderDate date={pendingSetupSession.expiresAt} />
                    }
                  ]}
                />

                <Spacer height={14} />

                <Button
                  variant="soft"
                  color="gray"
                  onClick={() => {
                    window.location.replace(pendingSetupSession.url);
                  }}
                >
                  Open setup session
                  <RiExternalLinkLine />
                </Button>
              </Card>
            )}

            {item.availability == 'available_now' && (
              <Card>
                <Text weight="bold">Deployment outcome</Text>
                <Spacer height={10} />
                <Text size="2" color="gray700">
                  Successful deployments create a Magic MCP server owned by your consumer profile. You can manage endpoints, sessions, and tokens from the Magic MCP area afterwards.
                </Text>

                <Spacer height={16} />

                <Link to={Paths.magicMcpServers()}>
                  <Button as="span" size="1" variant="ghost" color="gray">
                    Open Magic MCP deployments
                    <RiArrowRightUpLine />
                  </Button>
                </Link>
              </Card>
            )}
          </Section>
        </Split>
      </ContentLayout>
    );
  });
};
