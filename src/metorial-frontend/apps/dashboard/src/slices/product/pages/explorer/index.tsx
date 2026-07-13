import type {
  DashboardInstanceProvidersGetOutput,
  DashboardInstanceProvidersListOutput,
  ProviderListingsGetOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateProviderConfig,
  useCreateProviderDeployment,
  useCreateSession,
  useCurrentInstance,
  useProvider,
  useProviderConfigs,
  useProviderConfigSchemaTarget,
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
  RenderDate,
  Spacer,
  Text,
  theme,
  Title
} from '@metorial/ui';
import { RiArrowLeftLine, RiArrowRightLine, RiCloseLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { OpenExplorerButton, type OpenExplorerMode } from '../../components/openExplorer';
import {
  emptyConfigurationSelection,
  type ConfigurationSelection
} from '../../lib/configSelection';
import { getProviderConfigSchemaCapabilities } from '../../lib/providerCreationCapabilities';
import { ProviderSearch } from '../../scenes/providers/search';
import { ProviderSetupSections } from '../../scenes/sessionTemplates/addProviderPanelFlow';
import { SessionTracingScene } from '../../scenes/sessionTracing';
import type { ExplorerTabMode } from '../../scenes/sessionTracing/types';

type ProviderSelection =
  | DashboardInstanceProvidersListOutput['items'][number]
  | DashboardInstanceProvidersGetOutput
  | ProviderListingsGetOutput['provider'];

let Wrapper = styled.div`
  display: flex;
  height: 100%;
  min-height: 0;
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
  let modeParam = search.get('mode');
  let hasExplorerModeParam = modeParam == 'manual' || modeParam == 'assistant';
  let initialExplorerMode: ExplorerTabMode = modeParam == 'assistant' ? 'assistant' : 'manual';
  let sessionTemplateIdFromState =
    (location.state as { sessionTemplateId?: string } | null)?.sessionTemplateId ?? null;
  let magicMcpServerIdFromState =
    (location.state as { magicMcpServerId?: string } | null)?.magicMcpServerId ?? null;
  let isSessionFirstMode = !!sessionIdParam && !providerDeploymentIdParam && !providerIdParam;

  let [open, setOpen] = useState(
    !providerDeploymentIdParam && !sessionIdParam && !providerIdParam
  );

  let [providerDeploymentId, setProviderDeploymentId] = useState<string | null>(null);
  let [selectedConfiguration, setSelectedConfiguration] = useState<ConfigurationSelection>(
    emptyConfigurationSelection()
  );
  let [selectedAuthConfigId, setSelectedAuthConfigId] = useState('');
  let [sessionId, setSessionId] = useState<string | null>(null);
  let [isCreatingSession, setIsCreatingSession] = useState(false);
  let [selectedProvider, _setSelectedProvider] = useState<ProviderSelection | null>(null);
  let resolvingProviderIdRef = useRef<string | null>(null);
  let failedAutoCreateProviderIdRef = useRef<string | null>(null);
  let providerIdToResolveRef = useRef<string | null>(null);

  let instance = useCurrentInstance();
  let createSession = useCreateSession(instance.data?.id);
  let createProviderConfig = useCreateProviderConfig();

  useEffect(() => {
    if (sessionIdParam) setSessionId(sessionIdParam);
  }, [sessionIdParam]);

  let resetSessionSetupSelections = useCallback(() => {
    setSelectedConfiguration(emptyConfigurationSelection());
    setSelectedAuthConfigId('');
  }, []);

  let resetExplorerSelection = useCallback(() => {
    resolvingProviderIdRef.current = null;
    failedAutoCreateProviderIdRef.current = null;
    _setSelectedProvider(null);
    setProviderDeploymentId(null);
    setSessionId(null);
    resetSessionSetupSelections();
    setSearch(() => new URLSearchParams(), { replace: true });
    setOpen(true);
  }, [resetSessionSetupSelections, setSearch]);

  let selectProvider = useCallback(
    (provider: ProviderSelection) => {
      resolvingProviderIdRef.current = null;
      failedAutoCreateProviderIdRef.current = null;
      setProviderDeploymentId(null);
      setSessionId(null);
      resetSessionSetupSelections();
      _setSelectedProvider(provider);
      setOpen(false);
      setSearch(
        v => {
          v.set('provider_id', provider.id);
          v.delete('provider_deployment_id');
          v.delete('session_id');
          return v;
        },
        { replace: true }
      );
    },
    [resetSessionSetupSelections, setSearch]
  );

  let createSessionForDeployment = useCallback(
    async (
      deploymentId: string,
      options?: {
        providerConfigId?: string;
        providerConfigVaultId?: string;
        providerAuthConfigId?: string;
        mode?: OpenExplorerMode;
        name?: string;
      }
    ) => {
      if (!instance.data) return;
      setIsCreatingSession(true);

      let [res, err] = await createSession.mutate({
        name: options?.name,
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
            if (options?.mode) v.set('mode', options.mode);
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
      resolvingProviderIdRef.current = null;
      setProviderDeploymentId(deploymentId);
      setSessionId(null);
      resetSessionSetupSelections();
      setOpen(false);
    },
    [resetSessionSetupSelections]
  );
  let providerIdToResolve =
    !isSessionFirstMode && !providerDeploymentId
      ? (selectedProvider?.id ?? providerIdParam)
      : null;
  let deploymentsFilter = useMemo(
    () => (providerIdToResolve ? { providerId: providerIdToResolve } : undefined),
    [providerIdToResolve]
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
  let providerSupportsConfig = activeProvider.data?.type.config.status == 'enabled';
  let providerConfigSchema = useProviderConfigSchemaTarget(
    instance.data?.id,
    providerDeploymentId
      ? { providerDeploymentId }
      : activeProviderId
        ? { providerId: activeProviderId }
        : null
  );
  let configCapabilities = getProviderConfigSchemaCapabilities({
    schemaValue: providerConfigSchema.data?.schema,
    hasVaults: (providerConfigVaults.data?.items ?? []).length > 0,
    isLoading: providerSupportsConfig ? providerConfigSchema.isLoading : false
  });
  let createMutation = useCreateProviderDeployment();

  useEffect(() => {
    providerIdToResolveRef.current = providerIdToResolve;
  }, [providerIdToResolve]);

  useEffect(() => {
    if (
      !instance.data ||
      !providerIdToResolve ||
      providerDeploymentId ||
      sessionId ||
      isSessionFirstMode ||
      provider.isLoading ||
      deployments.isLoading ||
      failedAutoCreateProviderIdRef.current === providerIdToResolve
    ) {
      return;
    }

    let providerForName = selectedProvider ?? provider.data;
    if (!providerForName) return;

    let matchingDeployments = (deployments.data?.items ?? [])
      .filter(deployment => deployment.providerId === providerIdToResolve)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (matchingDeployments[0]) {
      selectDeployment(matchingDeployments[0].id);
      return;
    }

    if (createMutation.isPending || resolvingProviderIdRef.current === providerIdToResolve) {
      return;
    }

    resolvingProviderIdRef.current = providerIdToResolve;

    createMutation
      .mutate({
        instanceId: instance.data.id,
        name: `${providerForName.name ?? providerForName.slug ?? 'Provider'} Deployment`,
        providerId: providerIdToResolve
      })
      .then(([result, err]) => {
        if (resolvingProviderIdRef.current === providerIdToResolve) {
          resolvingProviderIdRef.current = null;
        }

        if (providerIdToResolveRef.current !== providerIdToResolve) return;

        if (err) {
          failedAutoCreateProviderIdRef.current = providerIdToResolve;
          console.error('Failed to create deployment:', err);
          return;
        }

        if (result) selectDeployment(result.id);
      });
  }, [
    createMutation,
    deployments.data?.items,
    deployments.isLoading,
    instance.data,
    isSessionFirstMode,
    provider.data,
    provider.isLoading,
    providerDeploymentId,
    providerIdToResolve,
    selectDeployment,
    selectedProvider,
    sessionId
  ]);

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

  let canAutoCreateProviderConfig =
    !!providerSupportsConfig &&
    !configCapabilities.isLoading &&
    configCapabilities.canAutoCreateEmptyConfig;
  let showConfigSection =
    !!providerSupportsConfig &&
    (configCapabilities.hasSchemaFields || !canAutoCreateProviderConfig);
  let configRequirement: 'required' | 'optional' =
    providerSupportsConfig && !canAutoCreateProviderConfig ? 'required' : 'optional';
  let requiresProviderConfig = providerSupportsConfig && !canAutoCreateProviderConfig;
  let requiresAuthConfig = activeProvider.data?.type.auth.status == 'enabled';
  let isResolvingProviderDeployment =
    !!providerIdToResolve &&
    !providerDeploymentId &&
    !sessionId &&
    (provider.isLoading ||
      deployments.isLoading ||
      createMutation.isPending ||
      resolvingProviderIdRef.current === providerIdToResolve);

  let createSessionWithSelectedSetup = useCallback(
    async (deploymentId: string, options?: { name?: string; mode?: OpenExplorerMode }) => {
      let providerConfigId =
        selectedConfiguration.kind === 'config' ? selectedConfiguration.id : undefined;
      let providerConfigVaultId =
        selectedConfiguration.kind === 'vault' ? selectedConfiguration.id : undefined;

      if (
        !providerConfigId &&
        !providerConfigVaultId &&
        canAutoCreateProviderConfig &&
        activeProviderId &&
        instance.data
      ) {
        setIsCreatingSession(true);
        let [config] = await createProviderConfig.mutate({
          instanceId: instance.data.id,
          providerId: activeProviderId,
          providerDeploymentId: deploymentId,
          name: `${activeProvider.data?.name ?? provider.data?.name ?? 'Provider'} Config`,
          value: configCapabilities.defaultConfigValue
        });

        providerConfigId = config?.id;
        if (!providerConfigId) {
          setIsCreatingSession(false);
          return;
        }
      }

      await createSessionForDeployment(deploymentId, {
        name: options?.name,
        providerConfigId,
        providerConfigVaultId,
        providerAuthConfigId: selectedAuthConfigId || undefined,
        mode: options?.mode
      });
    },
    [
      activeProvider.data?.name,
      activeProviderId,
      canAutoCreateProviderConfig,
      configCapabilities.defaultConfigValue,
      createProviderConfig,
      createSessionForDeployment,
      instance.data,
      provider.data?.name,
      selectedAuthConfigId,
      selectedConfiguration
    ]
  );

  useEffect(() => {
    if (
      providerDeploymentId &&
      !sessionId &&
      !isCreatingSession &&
      !!activeProvider.data &&
      !activeProvider.isLoading &&
      !showConfigSection &&
      !requiresAuthConfig
    ) {
      createSessionWithSelectedSetup(providerDeploymentId, {
        name: `Explorer Session - ${new Date().toLocaleString()}`
      });
    }
  }, [
    providerDeploymentId,
    sessionId,
    isCreatingSession,
    activeProvider.data,
    activeProvider.isLoading,
    showConfigSection,
    requiresAuthConfig,
    createSessionWithSelectedSetup
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
            defaultAuthConfigName="Explorer Auth"
            providerDeploymentId={providerDeploymentId}
            selectedConfiguration={selectedConfiguration}
            onSelectedConfigurationChange={setSelectedConfiguration}
            selectedAuthConfigId={selectedAuthConfigId}
            onSelectedAuthConfigIdChange={setSelectedAuthConfigId}
            showToolFilters={false}
            showConfigSection={showConfigSection}
            configRequirement={configRequirement}
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
            supplementaryContent={
              <>
                <createProviderConfig.RenderError />
                <createSession.RenderError />
              </>
            }
            footer={
              (showConfigSection || requiresAuthConfig) && (
                <Flex gap={10}>
                  {hasExplorerModeParam ? (
                    <Button
                      type="button"
                      disabled={!canOpenExplorer}
                      onClick={() => {
                        if (!canOpenExplorer) return;

                        createSessionWithSelectedSetup(providerDeploymentId, {
                          name: `Explorer Session - ${new Date().toLocaleString()}`
                        });
                      }}
                      loading={isCreatingSession}
                    >
                      Open Explorer
                    </Button>
                  ) : (
                    <OpenExplorerButton
                      disabled={!canOpenExplorer}
                      onOpen={mode => {
                        if (!canOpenExplorer) return;

                        createSessionWithSelectedSetup(providerDeploymentId, {
                          name: `Explorer Session - ${new Date().toLocaleString()}`,
                          mode
                        });
                      }}
                      loading={isCreatingSession}
                    />
                  )}
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

                {!isSessionFirstMode && (
                  <>
                    {(providerDeploymentId ||
                      selectedProvider ||
                      providerIdParam ||
                      sessionId) && (
                      <>
                        <Flex justify="space-between" align="center">
                          <Button
                            iconLeft={<RiArrowLeftLine />}
                            onClick={resetExplorerSelection}
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
                      onSelect={selectProvider}
                    />
                  </>
                )}
              </Providers>
            )}
          </AsideInner>
        </AnimatePresence>
      </Aside>

      <Main>
        {!providerDeploymentId && !sessionId && (
          <MainEmpty>
            {isResolvingProviderDeployment ? (
              <CenteredSpinner />
            ) : (
              <p>Click on a provider to start</p>
            )}
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
          renderWithLoader(
            { session: sessionFromQuery },
            { spaceTop: 20 }
          )(({ session }) => (
            <SessionTracingScene
              session={session.data}
              initialExplorerTab
              initialExplorerMode={initialExplorerMode}
              inspectorOptions={{
                sessionTemplateId: resolvedSessionTemplateId,
                magicMcpServerId: magicMcpServerIdFromState
              }}
            />
          ))}
      </Main>
    </Wrapper>
  );
};
