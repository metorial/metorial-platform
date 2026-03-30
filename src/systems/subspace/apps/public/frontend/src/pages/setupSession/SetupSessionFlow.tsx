import { renderWithLoader, renderWithPagination, useMutation } from '@metorial/data-hooks';
import { Button, CenteredSpinner, Error, Flex, Input, Text } from '@metorial/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { JsonSchema } from '../../lib/jsonSchema';
import { client } from '../../state/client';
import {
  authConfigSchemaState,
  configSchemaState,
  useProviderSearch
} from '../../state/setupSession';
import { SetupLayout } from './components/setupLayout';
import { StepContentBlock, StepWrapper } from './components/stepLayout';
import { ToolFilterEditor } from './components/toolFilterEditor';
import { DashboardEmbeddableLayout } from './layouts/dashboardEmbeddableLayout';
import { MetorialElementsLayout } from './layouts/metorialElementsLayout';
import { AuthConfigStep } from './steps/authConfigStep';
import { CompletedStep } from './steps/completedStep';
import { ConfigStep } from './steps/configStep';
import { OAuthRedirectStep } from './steps/oAuthRedirectStep';
import { ProviderSelectionStep } from './steps/providerSelectionStep';
import type { Brand, OAuthSetup, Provider, Session, Step, ToolListItem } from './types';

interface SetupSessionFlowProps {
  session: Session;
  brand: Brand;
  provider: Provider | null;
  clientSecret: string;
}

interface ProviderSelectionPaneProps {
  sessionId: string;
  clientSecret: string;
  providerSearch: string;
  debouncedProviderSearch: string;
  setProviderSearch: (value: string) => void;
  onSelect: (providerId: string) => Promise<unknown>;
  isSubmitting: boolean;
  isMetorialElement: boolean;
}

let hasSchemaFields = (schema: JsonSchema | null) => {
  return schema !== null && Object.keys(schema.properties || {}).length > 0;
};

let extractSchema = (result: unknown): JsonSchema | null => {
  let r = result as { schema?: { type: string; schema: unknown } } | null;
  if (r?.schema?.type === 'required') {
    return r.schema.schema as JsonSchema;
  }
  return null;
};

let ProviderSelectionPane = ({
  sessionId,
  clientSecret,
  providerSearch,
  debouncedProviderSearch,
  setProviderSearch,
  onSelect,
  isSubmitting,
  isMetorialElement
}: ProviderSelectionPaneProps) => {
  let providerSearchLoader = useProviderSearch({
    sessionId,
    clientSecret,
    search: debouncedProviderSearch.trim() || undefined,
    limit: 12
  });

  return (
    <StepWrapper $isMetorialElement={isMetorialElement}>
      <StepContentBlock $isMetorialElement={isMetorialElement}>
        <Flex direction="column" gap={18}>
          <div>
            <Text size="4" weight="strong">
              Choose a provider
            </Text>
            <Text size="2" color="gray600">
              Select the provider you want to connect for this setup session.
            </Text>
          </div>

          <Input
            label="Search providers"
            hideLabel
            placeholder="Search providers"
            value={providerSearch}
            onInput={setProviderSearch}
          />

          {renderWithPagination(providerSearchLoader)(res => (
            <ProviderSelectionStep
              providers={res.data.items}
              onSelect={onSelect}
              isSubmitting={isSubmitting}
            />
          ))}
        </Flex>
      </StepContentBlock>
    </StepWrapper>
  );
};

export let SetupSessionFlow = ({
  session,
  brand,
  clientSecret,
  provider
}: SetupSessionFlowProps) => {
  let [flowSession, setFlowSession] = useState(session);
  let [flowProvider, setFlowProvider] = useState(provider);
  let [currentStep, setCurrentStep] = useState<Step | null>(null);
  let [oauthSetup, setOauthSetup] = useState<OAuthSetup | null>(null);
  let [oauthError, setOauthError] = useState<string | null>(null);
  let [providerSearch, setProviderSearch] = useState('');
  let [debouncedProviderSearch, setDebouncedProviderSearch] = useState('');
  let [toolItems, setToolItems] = useState<ToolListItem[]>([]);
  let [toolsLoading, setToolsLoading] = useState(false);
  let [toolFilterMode, setToolFilterMode] = useState<'all' | 'select'>('all');
  let [selectedToolKeys, setSelectedToolKeys] = useState<string[]>([]);
  let oauthInitiated = useRef(false);

  let needsProviderSelection = !flowSession.providerId;
  let needsAuthConfig = flowSession.type !== 'config_only' && !flowSession.authConfig;
  let needsConfig = flowSession.type !== 'auth_only' && !flowSession.config;
  let isOAuth = flowSession.authMethod?.type === 'oauth';
  let toolFiltersEnabled = !!flowSession.configuration?.toolFilters?.enabled;

  let loaderInput = needsProviderSelection
    ? null
    : { sessionId: flowSession.id, clientSecret };
  let authSchemaLoader = authConfigSchemaState.use(
    loaderInput && needsAuthConfig ? loaderInput : null
  );
  let configSchemaLoader = configSchemaState.use(
    loaderInput && needsConfig ? loaderInput : null
  );

  let authConfigSchema = extractSchema(authSchemaLoader.data);
  let configSchema = extractSchema(configSchemaLoader.data);

  useEffect(() => {
    let timeout = window.setTimeout(() => {
      setDebouncedProviderSearch(providerSearch);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [providerSearch]);

  let toolFilterPayload = useMemo(() => {
    if (!toolFiltersEnabled || toolFilterMode !== 'select' || selectedToolKeys.length === 0) {
      return undefined;
    }

    return {
      type: 'tool_keys' as const,
      keys: selectedToolKeys
    };
  }, [selectedToolKeys, toolFilterMode, toolFiltersEnabled]);

  useEffect(() => {
    if (!toolFiltersEnabled || needsProviderSelection) {
      setToolItems([]);
      return;
    }

    let ignore = false;
    setToolsLoading(true);
    client.setupSession
      .listTools({
        sessionId: flowSession.id,
        clientSecret
      })
      .then(res => {
        if (!ignore) setToolItems(res.items);
      })
      .catch(() => {
        if (!ignore) setToolItems([]);
      })
      .finally(() => {
        if (!ignore) setToolsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [clientSecret, flowSession.id, needsProviderSelection, toolFiltersEnabled]);

  useEffect(() => {
    if (toolFilterMode !== 'select') {
      setSelectedToolKeys([]);
      return;
    }

    setSelectedToolKeys(currentKeys =>
      currentKeys.filter(key => toolItems.some(tool => tool.key === key))
    );
  }, [toolFilterMode, toolItems]);

  let determineStep = (): Step => {
    if (needsProviderSelection) return 'provider';
    if (needsConfig && hasSchemaFields(configSchema)) return 'config';
    if (needsAuthConfig && hasSchemaFields(authConfigSchema)) return 'auth_config';
    if (
      needsAuthConfig &&
      isOAuth &&
      authSchemaLoader.data &&
      !hasSchemaFields(authConfigSchema)
    ) {
      return 'oauth_loading';
    }
    return 'completed';
  };

  let currentResolvedStep = currentStep ?? determineStep();
  let layoutVariant = flowSession.configuration?.ui?.layout ?? 'box';

  let selectProviderMutation = useMutation(async (providerId: string) => {
    let result = await client.setupSession.selectProvider({
      sessionId: flowSession.id,
      clientSecret,
      providerId
    });

    setFlowSession(result.session);
    setFlowProvider(result.provider);
    setCurrentStep(null);
  });

  let configMutation = useMutation(async (data: Record<string, unknown>) => {
    await client.setupSession.setConfig({
      sessionId: flowSession.id,
      clientSecret,
      configInput: data,
      toolFilters: toolFilterPayload
    });

    setFlowSession(current => ({ ...current, config: { id: 'pending' } as any }));

    if (needsAuthConfig && hasSchemaFields(authConfigSchema)) {
      setCurrentStep('auth_config');
    } else if (needsAuthConfig && isOAuth) {
      setCurrentStep('oauth_loading');
    } else {
      setCurrentStep('completed');
    }
  });

  let authConfigMutation = useMutation(async (data: Record<string, unknown>) => {
    await client.setupSession.setAuthConfig({
      sessionId: flowSession.id,
      clientSecret,
      authConfigInput: data,
      toolFilters: toolFilterPayload
    });

    if (isOAuth) {
      let oauthResult = await client.setupSession.getOauthSetup({
        sessionId: flowSession.id,
        clientSecret
      });
      if (oauthResult) {
        setOauthSetup(oauthResult);
        setCurrentStep('oauth_redirect');
        return;
      }
    }

    setCurrentStep('completed');
  });

  useEffect(() => {
    let shouldAutoInitiateOAuth =
      !needsProviderSelection &&
      needsAuthConfig &&
      isOAuth &&
      authSchemaLoader.data &&
      !hasSchemaFields(authConfigSchema) &&
      !oauthInitiated.current;

    if (shouldAutoInitiateOAuth) {
      oauthInitiated.current = true;
      (async () => {
        try {
          await client.setupSession.setAuthConfig({
            sessionId: flowSession.id,
            clientSecret,
            authConfigInput: {},
            toolFilters: toolFilterPayload
          });

          let oauthResult = await client.setupSession.getOauthSetup({
            sessionId: flowSession.id,
            clientSecret
          });
          if (oauthResult) {
            setOauthSetup(oauthResult);
            setCurrentStep('oauth_redirect');
          } else {
            setOauthError('Failed to get OAuth URL. Please try again with a new session.');
          }
        } catch (err: unknown) {
          let message = (err as { message?: string })?.message ?? 'Failed to initiate OAuth';
          setOauthError(message);
        }
      })();
    }
  }, [
    authConfigSchema,
    authSchemaLoader.data,
    clientSecret,
    flowSession.id,
    isOAuth,
    needsAuthConfig,
    needsProviderSelection,
    toolFilterPayload
  ]);

  let stepLabels = useMemo(() => {
    let labels: string[] = [];
    if (needsProviderSelection) labels.push('Provider');
    if (needsConfig && hasSchemaFields(configSchema)) labels.push('Configuration');
    if (needsAuthConfig) labels.push('Authentication');
    return labels;
  }, [authConfigSchema, configSchema, needsAuthConfig, needsConfig, needsProviderSelection]);

  let currentStepIndex = useMemo(() => {
    if (currentResolvedStep === 'provider') return 0;
    if (currentResolvedStep === 'config') return needsProviderSelection ? 1 : 0;
    if (
      currentResolvedStep === 'auth_config' ||
      currentResolvedStep === 'oauth_redirect' ||
      currentResolvedStep === 'oauth_loading'
    ) {
      return stepLabels.length > 1 ? stepLabels.length - 1 : 0;
    }
    return stepLabels.length;
  }, [currentResolvedStep, needsProviderSelection, stepLabels.length]);

  let extraToolFilterContent =
    toolFiltersEnabled && !toolsLoading ? (
      <ToolFilterEditor
        enabled={toolFiltersEnabled}
        tools={toolItems}
        mode={toolFilterMode}
        selectedKeys={selectedToolKeys}
        onModeChange={setToolFilterMode}
        onSelectedKeysChange={setSelectedToolKeys}
      />
    ) : null;

  let renderContent = () => {
    if (currentResolvedStep === 'provider') {
      return (
        <ProviderSelectionPane
          sessionId={flowSession.id}
          clientSecret={clientSecret}
          providerSearch={providerSearch}
          debouncedProviderSearch={debouncedProviderSearch}
          setProviderSearch={setProviderSearch}
          onSelect={selectProviderMutation.mutate}
          isSubmitting={selectProviderMutation.isLoading}
          isMetorialElement={flowSession.uiMode === 'metorial_elements'}
        />
      );
    }

    if (currentResolvedStep === 'auth_config' && authConfigSchema) {
      return (
        <AuthConfigStep
          schema={authConfigSchema}
          onSubmit={authConfigMutation.mutate}
          isSubmitting={authConfigMutation.isLoading}
          isMetorialElement={flowSession.uiMode === 'metorial_elements'}
          extraContent={extraToolFilterContent}
        />
      );
    }

    if (currentResolvedStep === 'oauth_loading') {
      if (oauthError) {
        return (
          <Flex direction="column" align="center" gap={16} style={{ padding: '24px 0' }}>
            <Error>{oauthError}</Error>
            <Button onClick={() => window.location.reload()} variant="outline" size="2">
              Try Again
            </Button>
          </Flex>
        );
      }

      return <CenteredSpinner />;
    }

    if (currentResolvedStep === 'oauth_redirect' && oauthSetup) {
      return (
        <OAuthRedirectStep
          oauthSetup={oauthSetup}
          isMetorialElement={flowSession.uiMode === 'metorial_elements'}
        />
      );
    }

    if (currentResolvedStep === 'config' && configSchema) {
      return (
        <ConfigStep
          schema={configSchema}
          onSubmit={configMutation.mutate}
          isSubmitting={configMutation.isLoading}
          isMetorialElement={flowSession.uiMode === 'metorial_elements'}
          extraContent={extraToolFilterContent}
        />
      );
    }

    return <CompletedStep redirectUrl={flowSession.redirectUrl} />;
  };

  let activeLoaders: Record<string, typeof authSchemaLoader | typeof configSchemaLoader> = {};
  if (!needsProviderSelection && needsAuthConfig) activeLoaders.authSchema = authSchemaLoader;
  if (!needsProviderSelection && needsConfig) activeLoaders.configSchema = configSchemaLoader;

  let innerContent =
    Object.keys(activeLoaders).length > 0
      ? renderWithLoader(activeLoaders, {
          spaceTop: 48,
          spaceBottom: 48,
          error: (err: Error) => (
            <Flex direction="column" align="center" gap={16} style={{ padding: '24px 0' }}>
              <Error>{err.message}</Error>
              <Button onClick={() => window.location.reload()} variant="outline" size="2">
                Try Again
              </Button>
            </Flex>
          )
        })(renderContent)
      : renderContent();

  let isCompleted = currentResolvedStep === 'completed';

  if (flowSession.uiMode === 'metorial_elements') {
    if (layoutVariant === 'side') {
      return (
        <SetupLayout
          main={{
            title: flowSession.name ?? 'Setup Session',
            description: flowSession.description ?? undefined
          }}
          brand={brand}
          providerName={flowProvider?.name}
          providerImageUrl={flowProvider?.imageUrl}
        >
          <DashboardEmbeddableLayout
            currentStep={currentStepIndex}
            totalSteps={stepLabels.length}
            stepLabels={stepLabels}
          >
            {innerContent}
          </DashboardEmbeddableLayout>
        </SetupLayout>
      );
    }

    return (
      <MetorialElementsLayout
        brand={brand}
        providerName={flowProvider?.name}
        providerImageUrl={flowProvider?.imageUrl}
        hideHeader={isCompleted}
        currentStep={currentStepIndex}
        stepLabels={stepLabels}
        variant={layoutVariant === 'light' ? 'light' : 'box'}
      >
        {innerContent}
      </MetorialElementsLayout>
    );
  }

  return (
    <DashboardEmbeddableLayout
      currentStep={currentStepIndex}
      totalSteps={stepLabels.length}
      stepLabels={stepLabels}
    >
      {innerContent}
    </DashboardEmbeddableLayout>
  );
};
