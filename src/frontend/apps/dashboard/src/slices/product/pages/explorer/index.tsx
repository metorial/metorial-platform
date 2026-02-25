import type {
  DashboardInstanceProviderDeploymentsSetupSessionsGetOutput,
  DashboardInstanceProvidersGetOutput,
  DashboardInstanceProvidersListOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader, useForm } from '@metorial/data-hooks';
import {
  useCreateProviderDeployment,
  useCreateSession,
  useCurrentInstance,
  useProviderAuthConfigs,
  useProviderAuthMethods,
  useProvider,
  useProviderConfigSchema,
  useProviderConfigs,
  useProviderDeployment,
  useProviderDeployments
} from '@metorial/state';
import {
  Button,
  CenteredSpinner,
  Flex,
  Input,
  Select,
  Spacer,
  Tabs,
  Text,
  theme
} from '@metorial/ui';
import {
  RiAddLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCloseLine
} from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { Explainer } from '../../../../components/explainer';
import { showProviderConfigFormModal } from '../../scenes/providerConfigs/modal';
import { ProviderDeploymentsList } from '../../scenes/providerDeployments/list';
import { showProviderSetupSessionModal } from '../../scenes/providerDeployments/setupSessionModal';
import { ProviderSearch } from '../../scenes/providers/search';
import { InspectorFrame } from './inspector';

type ProviderSelection =
  | DashboardInstanceProvidersListOutput['items'][number]
  | DashboardInstanceProvidersGetOutput;

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

export let ExplorerPage = () => {
  let [search, setSearch] = useSearchParams();
  let providerIdParam = search.get('provider_id');
  let providerDeploymentIdParam = search.get('provider_deployment_id');
  let sessionIdParam = search.get('session_id');

  let [open, setOpen] = useState(!providerDeploymentIdParam && !sessionIdParam);

  let [providerTab, setProviderTab] = useState<'create' | 'list'>('create');
  let [providerDeploymentId, setProviderDeploymentId] = useState<string | null>(null);
  let [selectedConfigId, setSelectedConfigId] = useState('');
  let [selectedAuthConfigId, setSelectedAuthConfigId] = useState('');
  let [sessionId, setSessionId] = useState<string | null>(null);
  let [isCreatingSession, setIsCreatingSession] = useState(false);

  let instance = useCurrentInstance();
  let createSession = useCreateSession(instance.data?.id);

  useEffect(() => {
    if (sessionIdParam) setSessionId(sessionIdParam);
  }, [sessionIdParam]);

  let resetSessionSetupSelections = useCallback(() => {
    setSelectedConfigId('');
    setSelectedAuthConfigId('');
  }, []);

  let createSessionForDeployment = useCallback(
    async (
      deploymentId: string,
      options?: {
        providerConfigId?: string;
        providerAuthConfigId?: string;
      }
    ) => {
      if (!instance.data) return;
      setIsCreatingSession(true);

      let [res] = await createSession.mutate({
        providers: [
          {
            providerDeploymentId: deploymentId,
            ...(options?.providerConfigId
              ? { providerConfigId: options.providerConfigId }
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
      if (!sessionIdParam) setOpen(true);
    }
  }, [providerDeploymentIdParam, resetSessionSetupSelections, sessionIdParam]);

  let selectDeployment = useCallback(
    (deploymentId: string) => {
      setProviderDeploymentId(deploymentId);
      setSessionId(null);
      resetSessionSetupSelections();
      setOpen(true);
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
  let providerConfigs = useProviderConfigs(instance.data?.id, providerDeploymentId ?? undefined);
  let providerConfigSchema = useProviderConfigSchema(
    instance.data?.id,
    providerDeploymentId ?? undefined
  );
  let providerAuthConfigs = useProviderAuthConfigs(
    instance.data?.id,
    providerDeploymentId ?? undefined
  );

  let providerConfigsRef = useRef(providerConfigs);
  providerConfigsRef.current = providerConfigs;
  let providerAuthConfigsRef = useRef(providerAuthConfigs);
  providerAuthConfigsRef.current = providerAuthConfigs;

  let pendingAuthConfigIdRef = useRef<string | null>(null);

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
    if (providerConfigs.isLoading || !selectedConfigId) return;
    let exists = (providerConfigs.data?.items ?? []).some(c => c.id === selectedConfigId);
    if (!exists) setSelectedConfigId('');
  }, [providerConfigs.data, providerConfigs.isLoading, selectedConfigId]);

  useEffect(() => {
    if (providerAuthConfigs.isLoading || !selectedAuthConfigId) return;
    if (pendingAuthConfigIdRef.current === selectedAuthConfigId) {
      let exists = (providerAuthConfigs.data?.items ?? []).some(c => c.id === selectedAuthConfigId);
      if (exists) pendingAuthConfigIdRef.current = null;
      return;
    }
    let exists = (providerAuthConfigs.data?.items ?? []).some(c => c.id === selectedAuthConfigId);
    if (!exists) setSelectedAuthConfigId('');
  }, [providerAuthConfigs.data, providerAuthConfigs.isLoading, selectedAuthConfigId]);

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

  let activeProviderId =
    selectedProvider?.id ??
    providerIdParam ??
    selectedDeployment.data?.providerId ??
    null;
  let activeProvider = useProvider(instance.data?.id, activeProviderId ?? undefined);

  useEffect(() => {
    if (!selectedProvider && activeProvider.data && selectedDeployment.data?.providerId) {
      _setSelectedProvider(activeProvider.data);
      setSearch(
        v => {
          v.set('provider_id', selectedDeployment.data!.providerId);
          return v;
        },
        { replace: true }
      );
    }
  }, [selectedProvider, activeProvider.data, selectedDeployment.data, setSearch]);

  let effectiveVersionIdForAuth =
    selectedDeployment.data?.lockedVersion?.id ?? activeProvider.data?.currentVersion?.id;
  let providerAuthMethods = useProviderAuthMethods(
    instance.data?.id,
    effectiveVersionIdForAuth
  );

  let hasAuthMethods = (providerAuthMethods.data?.items?.length ?? 0) > 0;
  let hasConfigSchema =
    !!providerConfigSchema.data?.schema &&
    typeof providerConfigSchema.data.schema === 'object';
  let hasExistingConfigs = (providerConfigs.data?.items?.length ?? 0) > 0;
  let needsConfigStep = hasConfigSchema || hasExistingConfigs;
  let needsAuthStep = hasAuthMethods || (providerAuthConfigs.data?.items?.length ?? 0) > 0;

  useEffect(() => {
    if (
      providerDeploymentId &&
      !sessionId &&
      !isCreatingSession &&
      !providerConfigs.isLoading &&
      !providerConfigSchema.isLoading &&
      !providerAuthMethods.isLoading &&
      !providerAuthConfigs.isLoading &&
      !needsConfigStep &&
      !needsAuthStep
    ) {
      createSessionForDeployment(providerDeploymentId);
    }
  }, [
    providerDeploymentId,
    sessionId,
    isCreatingSession,
    providerConfigs.isLoading,
    providerConfigSchema.isLoading,
    providerAuthMethods.isLoading,
    providerAuthConfigs.isLoading,
    needsConfigStep,
    needsAuthStep
  ]);

  let renderSetupPanel = () => {
    if (!providerDeploymentId || !instance.data) return null;

    let configItems = providerConfigs.data?.items ?? [];
    let authConfigItems = providerAuthConfigs.data?.items ?? [];
    let configPlusTooltip = providerConfigSchema.isLoading
      ? 'Loading configuration schema...'
      : providerConfigSchema.error
        ? providerConfigSchema.error.message ?? 'Failed to load configuration schema.'
        : hasConfigSchema
          ? 'Create Config'
          : 'No configuration schema is provided for this deployment, so this config cannot be created from the dashboard.';
    let lockedProviderVersionId = selectedDeployment.data?.lockedVersion?.id ?? null;
    let currentProviderVersionId = activeProvider.data?.currentVersion?.id ?? null;
    let effectiveProviderVersionId = lockedProviderVersionId ?? currentProviderVersionId;
    let isAuthSetupLoadingVersion = !!activeProviderId && !lockedProviderVersionId && activeProvider.isLoading;
    let authPlusTooltip = !activeProviderId
      ? 'Could not resolve the provider for this deployment yet.'
      : selectedDeployment.isLoading || isAuthSetupLoadingVersion
        ? 'Loading provider version...'
        : activeProvider.error && !lockedProviderVersionId
          ? activeProvider.error.message ?? 'Failed to load provider details.'
          : !effectiveProviderVersionId
            ? 'No provider version is available yet, so authentication cannot be configured.'
            : 'Connect / Create Auth Config';
    let authPlusDisabled =
      !activeProviderId ||
      selectedDeployment.isLoading ||
      isAuthSetupLoadingVersion ||
      (!!activeProvider.error && !lockedProviderVersionId) ||
      !effectiveProviderVersionId;

    return (
      <MainSetup>
        <SetupCard>
          <Text as="p" size="4" weight="strong" color="gray900">
            Complete setup
          </Text>

          <Spacer height={6} />

          <Text size="2" color="gray600">
            Choose or create configuration and authentication for this deployment, then open the
            Explorer session.
          </Text>

          <Spacer height={16} />

          <Flex direction="column" gap={20}>
            {needsConfigStep && (
              <Flex direction="column" gap={12}>
                {selectedDeployment.isLoading ? (
                  <Flex align="center" gap={8}>
                    <CenteredSpinner />
                    <Text size="2" color="gray600">
                      Loading deployment details...
                    </Text>
                  </Flex>
                ) : (
                  <Flex gap={8} align="end">
                    <div style={{ flex: 1 }}>
                      <Select
                        label="Config (optional)"
                        value={selectedConfigId || '__none__'}
                        onChange={value =>
                          setSelectedConfigId(value === '__none__' ? '' : value)
                        }
                        items={[
                          { id: '__none__', label: 'None' },
                          ...configItems.map(config => ({
                            id: config.id,
                            label: config.name ?? config.id
                          }))
                        ]}
                      />
                    </div>

                    <div title={configPlusTooltip} style={{ display: 'inline-flex' }}>
                      <Button
                        type="button"
                        size="3"
                        iconLeft={<RiAddLine />}
                        aria-label="Create Config"
                        disabled={!hasConfigSchema || providerConfigSchema.isLoading}
                        onClick={() =>
                          showProviderConfigFormModal({
                            type: 'create',
                            providerDeploymentId,
                            onCreate: config => {
                              setSelectedConfigId(config.id);
                              providerConfigsRef.current.refetch();
                            }
                          })
                        }
                        style={
                          hasConfigSchema && !providerConfigSchema.isLoading
                            ? {
                                background: theme.colors.gray900,
                                borderColor: theme.colors.gray900,
                                color: 'white'
                              }
                            : {
                                background: theme.colors.gray200,
                                borderColor: theme.colors.gray300,
                                color: theme.colors.gray600
                              }
                        }
                      />
                    </div>
                  </Flex>
                )}

                {providerConfigs.error && (
                  <Text size="2" color="red500">
                    {providerConfigs.error.message ?? 'Failed to load configs.'}
                  </Text>
                )}
              </Flex>
            )}

            {needsAuthStep && (
              <Flex direction="column" gap={12}>
                <Flex gap={8} align="end">
                  <div style={{ flex: 1 }}>
                    <Select
                      label={hasAuthMethods ? 'Auth Config (required)' : 'Auth Config (optional)'}
                      value={selectedAuthConfigId || '__none__'}
                      onChange={value =>
                        setSelectedAuthConfigId(value === '__none__' ? '' : value)
                      }
                      items={[
                        { id: '__none__', label: 'None' },
                        ...authConfigItems.map(config => ({
                          id: config.id,
                          label: config.name ?? config.id
                        }))
                      ]}
                    />
                  </div>

                  <div title={authPlusTooltip} style={{ display: 'inline-flex' }}>
                    <Button
                      type="button"
                      size="3"
                      iconLeft={<RiAddLine />}
                      aria-label="Connect / Create Auth Config"
                      disabled={authPlusDisabled}
                      onClick={() => {
                        if (!activeProviderId) return;
                        showProviderSetupSessionModal({
                          instanceId: instance.data.id,
                          providerId: activeProviderId,
                          deploymentId: providerDeploymentId,
                          onComplete: (
                            result: DashboardInstanceProviderDeploymentsSetupSessionsGetOutput | null
                          ) => {
                            let authConfigId = result?.authConfig?.id;
                            if (authConfigId) {
                              pendingAuthConfigIdRef.current = authConfigId;
                              setSelectedAuthConfigId(authConfigId);
                            }
                            providerAuthConfigsRef.current.refetch();
                          }
                        });
                      }}
                      style={
                        !authPlusDisabled
                          ? {
                              background: theme.colors.gray900,
                              borderColor: theme.colors.gray900,
                              color: 'white'
                            }
                          : {
                              background: theme.colors.gray200,
                              borderColor: theme.colors.gray300,
                              color: theme.colors.gray600
                            }
                      }
                    />
                  </div>
                </Flex>

                {!activeProviderId && !selectedDeployment.isLoading && (
                  <Text size="2" color="red500">
                    Could not resolve the provider for this deployment yet. Re-open the
                    sidebar and re-select the deployment.
                  </Text>
                )}

                {activeProviderId &&
                  !selectedDeployment.isLoading &&
                  !isAuthSetupLoadingVersion &&
                  !effectiveProviderVersionId &&
                  !(activeProvider.error && !lockedProviderVersionId) && (
                    <Text size="2" color="gray600">
                      No provider version is available yet, so authentication cannot be
                      configured.
                    </Text>
                  )}

                {activeProvider.error && !lockedProviderVersionId && (
                  <Text size="2" color="red500">
                    {activeProvider.error.message ?? 'Failed to load provider details.'}
                  </Text>
                )}

                {providerAuthConfigs.error && (
                  <Text size="2" color="red500">
                    {providerAuthConfigs.error.message ?? 'Failed to load auth configs.'}
                  </Text>
                )}
              </Flex>
            )}

            <createSession.RenderError />

            {(needsConfigStep || needsAuthStep) && (
              <Flex gap={10}>
                <Button
                  type="button"
                  onClick={() =>
                    createSessionForDeployment(providerDeploymentId, {
                      providerConfigId: selectedConfigId || undefined,
                      providerAuthConfigId: selectedAuthConfigId || undefined
                    })
                  }
                  loading={isCreatingSession}
                  disabled={hasAuthMethods && !selectedAuthConfigId}
                >
                  Open Explorer
                </Button>
              </Flex>
            )}
          </Flex>
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
            key={open ? (selectedProvider ? 'select_deployment' : 'select_provider') : 'closed'}
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
                {!selectedProvider && !providerIdParam && (
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

        {sessionId && !isCreatingSession && <InspectorFrame sessionId={sessionId} />}
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
