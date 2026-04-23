import type {
  DashboardInstanceProvidersGetOutput,
  DashboardInstanceProvidersListOutput,
  ProviderListingsGetOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateProviderDeployment,
  useCreateSession,
  useCurrentInstance,
  useProvider,
  useProviderConfigs,
  useProviderConfigVaults,
  useProviderDeployment,
  useProviderDeployments,
  useProviderListings,
  useSession
} from '@metorial/state';
import {
  Avatar,
  Button,
  CenteredSpinner,
  Entity,
  Flex,
  Input,
  RenderDate,
  Spacer,
  Tabs,
  Text,
  theme,
  Title
} from '@metorial/ui';
import { RiArrowLeftLine, RiArrowRightLine, RiCloseLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { Explainer } from '../../../../components/explainer';
import {
  emptyConfigurationSelection,
  type ConfigurationSelection
} from '../../lib/configSelection';
import { ProviderDeploymentsList } from '../../scenes/providerDeployments/list';
import { ProviderSearch } from '../../scenes/providers/search';
import { SessionTracingScene } from '../../scenes/sessionTracing';
import { ProviderSetupSections } from '../../scenes/sessionTemplates/addProviderPanelFlow';

type ProviderSelection =
  | DashboardInstanceProvidersListOutput['items'][number]
  | DashboardInstanceProvidersGetOutput
  | ProviderListingsGetOutput['provider'];

let Wrapper = styled.div`
  display: flex;
  height: calc(100vh - 78px);
`;

let Aside = styled(motion.aside)`
  height: 100%;
  position: relative;
  border-right: 1px solid ${theme.colors.gray400};
`;

let AsideInner = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #fafafa;
  overflow-y: auto;
  overflow-x: hidden;
`;

let Main = styled.main`
  height: 100%;
  overflow: hidden;
  flex: 1;
`;

let MainEmpty = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  p {
    color: ${theme.colors.gray600};
    font-size: 24px;
    font-weight: 500;
  }
`;

let Open = styled.button`
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: none;

  svg {
    height: 20px;
    width: 20px;
    color: ${theme.colors.gray600};
  }
`;

let Providers = styled.div`
  padding: 20px;
`;

let CreateForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding-top: 15px;
`;

let MainSetup = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 28px 28px;
  overflow: auto;
`;

let SetupCard = styled.div`
  width: min(760px, 100%);
  padding: 20px;
`;

let TemplateSessionCards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
`;

let TemplateSessionCard = styled(Link)`
  display: block;
  text-decoration: none;
  width: 100%;
`;

let TemplateSessionCardButton = styled.div`
  display: flex;
  width: 100%;
  transition:
    transform 0.15s ease,
    filter 0.15s ease;

  &:hover {
    filter: brightness(0.99);
  }
`;

export let ExplorerPage = () => {
  let location = useLocation();
  let [search, setSearch] = useSearchParams();
  let providerIdParam = search.get('provider_id');
  let providerDeploymentIdParam = search.get('provider_deployment_id');
  let sessionIdParam = search.get('session_id');
  let sessionTemplateIdFromState =
    (location.state as { sessionTemplateId?: string } | null)?.sessionTemplateId ?? null;
  let magicMcpServerIdFromState =
    (location.state as { magicMcpServerId?: string } | null)?.magicMcpServerId ?? null;
  let isSessionFirstMode = !!sessionIdParam && !providerDeploymentIdParam && !providerIdParam;

  let [open, setOpen] = useState(!providerDeploymentIdParam && !sessionIdParam);

  let [providerTab, setProviderTab] = useState<'create' | 'list'>('create');
  let [providerDeploymentId, setProviderDeploymentId] = useState<string | null>(null);
  let [selectedConfiguration, setSelectedConfiguration] = useState<ConfigurationSelection>(
    emptyConfigurationSelection()
  );
  let [selectedAuthConfigId, setSelectedAuthConfigId] = useState('');
  let [sessionId, setSessionId] = useState<string | null>(null);
  let [isCreatingSession, setIsCreatingSession] = useState(false);

  let instance = useCurrentInstance();
  let createSession = useCreateSession(instance.data?.id);

  useEffect(() => {
    if (sessionIdParam) setSessionId(sessionIdParam);
  }, [sessionIdParam]);

  let resetSessionSetupSelections = useCallback(() => {
    setSelectedConfiguration(emptyConfigurationSelection());
    setSelectedAuthConfigId('');
  }, []);

  let createSessionForDeployment = useCallback(
    async (
      deploymentId: string,
      options?: {
        providerConfigId?: string;
        providerConfigVaultId?: string;
        providerAuthConfigId?: string;
      }
    ) => {
      if (!instance.data) return;
      setIsCreatingSession(true);

      let [res, err] = await createSession.mutate({
        providers: [
          {
            providerDeploymentId: deploymentId,
            ...(options?.providerConfigId
              ? { providerConfigId: options.providerConfigId }
              : {}),
            ...(options?.providerConfigVaultId
              ? { providerConfigVaultId: options.providerConfigVaultId }
              : {}),
            ...(options?.providerAuthConfigId
              ? { providerAuthConfigId: options.providerAuthConfigId }
              : {})
          }
        ]
      });

      setIsCreatingSession(false);

      if (res) {
        setSessionId(res.id);
        setOpen(false);
        setSearch(
          v => {
            v.set('session_id', res.id);
            v.set('provider_deployment_id', deploymentId);
            return v;
          },
          { replace: true }
        );
      }
    },
    [createSession, instance.data, setSearch]
  );

  let provider = useProvider(instance.data?.id, providerIdParam ?? undefined);
  let sessionFromQuery = useSession(instance.data?.id, sessionIdParam ?? undefined);
  let resolvedSessionTemplateId =
    sessionTemplateIdFromState ?? sessionFromQuery.data?.fromTemplatesIds?.[0] ?? null;
  let sessionProviderIds = useMemo(
    () =>
      [
        ...new Set(
          (sessionFromQuery.data?.providers ?? []).map(
            sessionProvider => sessionProvider.providerId
          )
        )
      ].sort(),
    [sessionFromQuery.data?.providers]
  );
  let sessionProviderListings = useProviderListings(
    instance.data?.id,
    sessionProviderIds.length > 0
      ? {
          id: sessionProviderIds,
          orderByRank: true,
          limit: Math.max(sessionProviderIds.length, 100)
        }
      : null
  );
  let sessionProviderLookup = useMemo(() => {
    let lookup = new Map<string, { name?: string | null; imageUrl?: string | null }>();
    for (let providerListing of sessionProviderListings.data?.items ?? []) {
      lookup.set(providerListing.provider.id, {
        name: providerListing.name ?? providerListing.provider.name,
        imageUrl: providerListing.imageUrl
      });
    }
    return lookup;
  }, [sessionProviderListings.data?.items]);
  let [selectedProvider, _setSelectedProvider] = useState<ProviderSelection | null>(null);
  useEffect(() => {
    if (provider.data) {
      _setSelectedProvider(provider.data);
    }
  }, [provider.data]);

  useEffect(() => {
    if (providerDeploymentIdParam) {
      setProviderDeploymentId(providerDeploymentIdParam);
      resetSessionSetupSelections();
      if (!sessionIdParam) setOpen(false);
    }
  }, [providerDeploymentIdParam, resetSessionSetupSelections, sessionIdParam]);

  let selectDeployment = useCallback(
    (deploymentId: string) => {
      setProviderDeploymentId(deploymentId);
      setSessionId(null);
      resetSessionSetupSelections();
      setOpen(false);
    },
    [resetSessionSetupSelections]
  );
  let deploymentsFilter = useMemo(
    () => ({
      providerId: selectedProvider ? selectedProvider.id : undefined
    }),
    [selectedProvider]
  );

  let deployments = useProviderDeployments(instance.data?.id, deploymentsFilter);
  let selectedDeployment = useProviderDeployment(
    instance.data?.id,
    providerDeploymentId ?? undefined
  );
  let activeProviderId =
    selectedProvider?.id ?? providerIdParam ?? selectedDeployment.data?.providerId ?? null;
  let activeProvider = useProvider(instance.data?.id, activeProviderId ?? undefined);
  let providerConfigs = useProviderConfigs(instance.data?.id, {
    providerId: activeProviderId ?? undefined
  });
  let providerConfigVaults = useProviderConfigVaults(instance.data?.id, {
    providerDeploymentId: providerDeploymentId ?? undefined
  });

  useEffect(() => {
    let deploymentsForCurrentProvider = deployments.data?.items.filter(
      d => d.providerId == (selectedProvider?.id ?? providerIdParam)
    );

    if (!deployments.isLoading && deploymentsForCurrentProvider?.length)
      setProviderTab('list');
  }, [deployments.data, deployments.isLoading, providerIdParam, selectedProvider?.id]);

  useEffect(() => {
    if (!providerDeploymentId) {
      resetSessionSetupSelections();
      return;
    }
  }, [providerDeploymentId, resetSessionSetupSelections]);

  useEffect(() => {
    if (providerConfigs.isLoading || selectedConfiguration.kind !== 'config') return;
    let exists = (providerConfigs.data?.items ?? []).some(
      c => c.id === selectedConfiguration.id
    );
    if (!exists) setSelectedConfiguration(emptyConfigurationSelection());
  }, [providerConfigs.data, providerConfigs.isLoading, selectedConfiguration]);

  useEffect(() => {
    if (providerConfigVaults.isLoading || selectedConfiguration.kind !== 'vault') return;
    let exists = (providerConfigVaults.data?.items ?? []).some(
      vault => vault.id === selectedConfiguration.id
    );
    if (!exists) setSelectedConfiguration(emptyConfigurationSelection());
  }, [providerConfigVaults.data, providerConfigVaults.isLoading, selectedConfiguration]);

  let createMutation = useCreateProviderDeployment();
  let createDeploymentForm = useForm({
    initialValues: {
      deploymentName: '',
      deploymentDescription: ''
    },
    onSubmit: async values => {
      if (!instance.data || !selectedProvider || !values.deploymentName.trim()) return;

      let [result, err] = await createMutation.mutate({
        instanceId: instance.data.id,
        name: values.deploymentName.trim(),
        description: values.deploymentDescription.trim() || undefined,
        providerId: selectedProvider.id
      });

      if (err) {
        console.error('Failed to create deployment:', err);
      } else if (result) {
        createDeploymentForm.resetForm();
        selectDeployment(result.id);
      }
    },
    schema: yup =>
      yup.object({
        deploymentName: yup.string().required('Deployment name is required'),
        deploymentDescription: yup.string().optional().default('')
      })
  });

  useEffect(() => {
    if (
      !selectedProvider &&
      !isSessionFirstMode &&
      !!providerDeploymentId &&
      activeProvider.data &&
      selectedDeployment.data?.providerId
    ) {
      _setSelectedProvider(activeProvider.data);
      setSearch(
        v => {
          v.set('provider_id', selectedDeployment.data!.providerId);
          return v;
        },
        { replace: true }
      );
    }
  }, [
    selectedProvider,
    isSessionFirstMode,
    providerDeploymentId,
    activeProvider.data,
    selectedDeployment.data,
    setSearch
  ]);

  let requiresProviderConfig = activeProvider.data?.type.config.status == 'enabled';
  let requiresAuthConfig = activeProvider.data?.type.auth.status == 'enabled';

  useEffect(() => {
    if (
      providerDeploymentId &&
      !sessionId &&
      !isCreatingSession &&
      !!activeProvider.data &&
      !activeProvider.isLoading &&
      !requiresProviderConfig &&
      !requiresAuthConfig
    ) {
      createSessionForDeployment(providerDeploymentId);
    }
  }, [
    providerDeploymentId,
    sessionId,
    isCreatingSession,
    activeProvider.data,
    activeProvider.isLoading,
    requiresProviderConfig,
    requiresAuthConfig,
    createSessionForDeployment
  ]);

  let renderSetupPanel = () => {
    if (!providerDeploymentId || !instance.data) return null;
    if (!activeProviderId && (selectedDeployment.isLoading || activeProvider.isLoading)) {
      return (
        <MainSetup>
          <SetupCard>
            <CenteredSpinner />
          </SetupCard>
        </MainSetup>
      );
    }

    let resolvedProviderId =
      activeProviderId ?? selectedProvider?.id ?? providerIdParam ?? provider.data?.id ?? null;
    let canOpenExplorer =
      (!requiresProviderConfig || selectedConfiguration.kind !== 'none') &&
      (!requiresAuthConfig || Boolean(selectedAuthConfigId));

    if (!resolvedProviderId) return null;

    return (
      <MainSetup>
        <SetupCard>
          <Title as="h1" size="7" weight="strong" color="gray900">
            Connect to {selectedDeployment.data?.name ?? provider.data?.name ?? 'Provider'}
          </Title>

          <Spacer height={6} />

          <Text size="2" color="gray600" weight="medium">
            Configure the connection to your provider deployment before connecting with the
            Metorial Explorer.
          </Text>

          <Spacer height={16} />

          <ProviderSetupSections
            instanceId={instance.data.id}
            providerId={resolvedProviderId}
            providerName={
              selectedDeployment.data?.name ??
              activeProvider.data?.name ??
              provider.data?.name ??
              'Provider'
            }
            providerDeploymentId={providerDeploymentId}
            selectedConfiguration={selectedConfiguration}
            onSelectedConfigurationChange={setSelectedConfiguration}
            selectedAuthConfigId={selectedAuthConfigId}
            onSelectedAuthConfigIdChange={setSelectedAuthConfigId}
            showToolFilters={false}
            configError={
              providerConfigs.error || providerConfigVaults.error ? (
                <Text size="2" color="red500">
                  {providerConfigs.error?.message ??
                    providerConfigVaults.error?.message ??
                    'Failed to load configs and config vaults.'}
                </Text>
              ) : null
            }
            emptyState={null}
            supplementaryContent={<createSession.RenderError />}
            footer={
              (requiresProviderConfig || requiresAuthConfig) && (
                <Flex gap={10}>
                  <Button
                    type="button"
                    disabled={!canOpenExplorer}
                    onClick={() => {
                      if (!canOpenExplorer) return;

                      createSessionForDeployment(providerDeploymentId, {
                        providerConfigId:
                          selectedConfiguration.kind === 'config'
                            ? selectedConfiguration.id
                            : undefined,
                        providerConfigVaultId:
                          selectedConfiguration.kind === 'vault'
                            ? selectedConfiguration.id
                            : undefined,
                        providerAuthConfigId: selectedAuthConfigId || undefined
                      });
                    }}
                    loading={isCreatingSession}
                  >
                    Open Explorer
                  </Button>
                </Flex>
              )
            }
          />
        </SetupCard>
      </MainSetup>
    );
  };

  return (
    <Wrapper>
      <Aside
        initial={{ width: 400 }}
        animate={open ? { width: 450 } : { width: 30 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <AnimatePresence>
          <AsideInner
            key={
              open ? (selectedProvider ? 'select_deployment' : 'select_provider') : 'closed'
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            {!open && (
              <Open onClick={() => setOpen(!open)}>
                <RiArrowRightLine />
              </Open>
            )}

            {open && (
              <Providers>
                {isSessionFirstMode && !selectedProvider && !providerIdParam && (
                  <>
                    <Flex justify="space-between" align="center">
                      <Text as="p" size="3" weight="strong" color="gray900">
                        {magicMcpServerIdFromState ? 'Magic MCP session' : 'Template session'}
                      </Text>
                      <Button
                        iconLeft={<RiCloseLine />}
                        onClick={() => setOpen(false)}
                        size="1"
                        variant="outline"
                        type="button"
                      >
                        Close
                      </Button>
                    </Flex>

                    <Spacer height={8} />

                    {renderWithLoader({ session: sessionFromQuery })(({ session }) => (
                      <Flex direction="column" gap={8} style={{ width: '100%' }}>
                        <Text as="p" size="2" color="gray600">
                          Providers in this session
                        </Text>

                        {session.data.providers.length === 0 ? (
                          <Text size="2" color="gray600">
                            No providers are attached to this session.
                          </Text>
                        ) : (
                          <TemplateSessionCards>
                            {session.data.providers.map(provider => {
                              let providerDeploymentId = provider.deployment?.id ?? null;
                              let providerDeploymentName =
                                provider.deployment?.name ??
                                providerDeploymentId ??
                                provider.providerId;
                              let providerDeploymentCreatedAt =
                                provider.deployment?.createdAt ?? null;

                              return (
                                <TemplateSessionCard
                                  key={provider.id}
                                  to={
                                    providerDeploymentId
                                      ? Paths.instance.providerDeployment(
                                          instance.data?.organization,
                                          instance.data?.project,
                                          instance.data,
                                          providerDeploymentId
                                        )
                                      : '#'
                                  }
                                  onClick={event => {
                                    if (!providerDeploymentId) event.preventDefault();
                                  }}
                                >
                                  <TemplateSessionCardButton>
                                    <Entity.Wrapper style={{ width: '100%' }}>
                                      <Entity.Content>
                                        <Entity.Field
                                          prefix={
                                            <Avatar
                                              entity={{
                                                name:
                                                  sessionProviderLookup.get(
                                                    provider.providerId
                                                  )?.name ?? provider.providerId,
                                                imageUrl: sessionProviderLookup.get(
                                                  provider.providerId
                                                )?.imageUrl
                                              }}
                                              size={28}
                                              radius={8}
                                              noTooltip
                                              imageFit="contain"
                                            />
                                          }
                                          title={providerDeploymentName}
                                        />
                                        <Entity.Field
                                          title={
                                            <Text size="1" color="gray500">
                                              {providerDeploymentCreatedAt ? (
                                                <RenderDate
                                                  date={providerDeploymentCreatedAt}
                                                />
                                              ) : (
                                                'Deployment unavailable'
                                              )}
                                            </Text>
                                          }
                                          right
                                        />
                                      </Entity.Content>
                                    </Entity.Wrapper>
                                  </TemplateSessionCardButton>
                                </TemplateSessionCard>
                              );
                            })}
                          </TemplateSessionCards>
                        )}
                      </Flex>
                    ))}
                  </>
                )}

                {!isSessionFirstMode && !selectedProvider && !providerIdParam && (
                  <>
                    {providerDeploymentId && (
                      <>
                        <Button
                          iconLeft={<RiCloseLine />}
                          onClick={() => setOpen(!open)}
                          size="1"
                          variant="outline"
                          type="button"
                        >
                          Close
                        </Button>

                        <Spacer height={10} />
                      </>
                    )}

                    <Text as="p" size="3" weight="strong" color="gray900">
                      Select a provider
                    </Text>

                    <Spacer height={5} />

                    <ProviderSearch
                      filter={{
                        orderByUse: 'deployments',
                        order: 'desc'
                      }}
                      onSelect={provider => {
                        setProviderDeploymentId(null);
                        setSessionId(null);
                        resetSessionSetupSelections();
                        _setSelectedProvider(provider);
                        setSearch(
                          v => {
                            v.set('provider_id', provider.id);
                            return v;
                          },
                          { replace: true }
                        );
                      }}
                    />
                  </>
                )}

                {selectedProvider &&
                  renderWithLoader({ deployments, provider })(() => (
                    <>
                      <Flex justify="space-between" align="center">
                        <Button
                          iconLeft={<RiArrowLeftLine />}
                          onClick={() => {
                            _setSelectedProvider(null);
                            setProviderDeploymentId(null);
                            setSessionId(null);
                            resetSessionSetupSelections();
                            setSearch(v => new URLSearchParams(), { replace: true });
                            setOpen(true);
                          }}
                          size="1"
                          variant="outline"
                          type="button"
                        >
                          Back
                        </Button>

                        <Button
                          iconLeft={<RiCloseLine />}
                          onClick={() => setOpen(!open)}
                          size="1"
                          variant="outline"
                          type="button"
                        >
                          Close
                        </Button>
                      </Flex>

                      <Spacer height={10} />

                      <Text as="p" size="3" weight="strong" color="gray900">
                        {providerTab == 'create' ? (
                          <>
                            Set up{' '}
                            {selectedProvider.name ?? selectedProvider.slug ?? 'Provider'}
                          </>
                        ) : (
                          <>Choose a deployment</>
                        )}
                      </Text>

                      <Spacer height={5} />

                      <Tabs
                        tabs={[
                          { id: 'create', label: 'Create' },
                          { id: 'list', label: 'Your Deployments' }
                        ]}
                        action={v => setProviderTab(v as 'create' | 'list')}
                        current={providerTab}
                      />

                      {providerTab == 'create' && (
                        <CreateForm onSubmit={createDeploymentForm.handleSubmit}>
                          <Input
                            label="Deployment Name"
                            {...createDeploymentForm.getFieldProps('deploymentName')}
                            placeholder="My Deployment"
                            autoFocus
                          />
                          <createDeploymentForm.RenderError field="deploymentName" />

                          <Input
                            label="Description"
                            {...createDeploymentForm.getFieldProps('deploymentDescription')}
                            placeholder="Optional description"
                            as="textarea"
                            minRows={2}
                          />
                          <createMutation.RenderError />

                          <Flex gap={10}>
                            <Button
                              type="button"
                              variant="outline"
                              size="2"
                              onClick={() => {
                                _setSelectedProvider(null);
                                setProviderDeploymentId(null);
                                setSessionId(null);
                                resetSessionSetupSelections();
                                setSearch(v => new URLSearchParams(), { replace: true });
                                setOpen(true);
                              }}
                            >
                              Back
                            </Button>
                            <Button
                              type="submit"
                              size="2"
                              loading={createMutation.isPending}
                              disabled={!createDeploymentForm.values.deploymentName.trim()}
                            >
                              Create Deployment
                            </Button>
                          </Flex>
                        </CreateForm>
                      )}

                      {providerTab == 'list' && (
                        <ProviderDeploymentsList
                          providerId={selectedProvider.id}
                          order="desc"
                          onDeploymentClick={deployment => selectDeployment(deployment.id)}
                        />
                      )}
                    </>
                  ))}
              </Providers>
            )}
          </AsideInner>
        </AnimatePresence>
      </Aside>

      <Main>
        {!providerDeploymentId && !sessionId && (
          <MainEmpty>
            <p>Click on a provider to start</p>
          </MainEmpty>
        )}

        {providerDeploymentId && !sessionId && !isCreatingSession && renderSetupPanel()}

        {isCreatingSession && (
          <MainEmpty>
            <CenteredSpinner />
          </MainEmpty>
        )}

        {sessionId &&
          !isCreatingSession &&
          renderWithLoader({ session: sessionFromQuery })(({ session }) => (
            <SessionTracingScene
              session={session.data}
              initialExplorerTab
              inspectorOptions={{
                sessionTemplateId: resolvedSessionTemplateId,
                magicMcpServerId: magicMcpServerIdFromState
              }}
            />
          ))}
      </Main>

      <Explainer
        title="Using the MCP Explorer"
        description="Learn how to use the Explorer to explore and interact with your MCP provider."
        youtubeId="mzGOU3LVuT0"
        id="explorer"
      />
    </Wrapper>
  );
};
