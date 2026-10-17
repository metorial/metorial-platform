import { useMutation } from '@metorial/data-hooks';
import {
  createToolSelection,
  setToolSelectionMode,
  toToolFilterPayload,
  type ToolAccessMode,
  type ToolSelection
} from '@metorial/tool-selection';
import { useEffect, useMemo, useRef, useState } from 'react';
import { hasSchemaFields } from '../../lib/jsonSchema';
import { getIntegrationsClient } from '../../state/client';
import {
  useAuthConfigSchema,
  useConfigSchema,
  useSetupSessionTools
} from '../../state/loaders';
import type { OAuthSetup, Provider, Session } from '../../state/types';

export type Step =
  | 'provider'
  | 'config'
  | 'auth_config'
  | 'oauth_loading'
  | 'oauth_redirect'
  | 'completed';

type Stage = 'provider' | 'config' | 'auth';

let stageLabels: Record<Stage, string> = {
  provider: 'Provider',
  config: 'Configuration',
  auth: 'Authentication'
};

let stepStages: Record<Step, Stage | null> = {
  provider: 'provider',
  config: 'config',
  auth_config: 'auth',
  oauth_loading: 'auth',
  oauth_redirect: 'auth',
  completed: null
};

export let useSetupFlow = ({
  session,
  provider,
  clientSecret
}: {
  session: Session;
  provider: Provider | null;
  clientSecret: string;
}) => {
  let client = useMemo(() => getIntegrationsClient(clientSecret), [clientSecret]);

  let [flowSession, setFlowSession] = useState(session);
  let [flowProvider, setFlowProvider] = useState(provider);
  let [explicitStep, setExplicitStep] = useState<Step | null>(null);
  let [includesProviderStage] = useState(() => !session.providerId);

  let [configSubmitted, setConfigSubmitted] = useState(false);
  let [hasSeenConfigFields, setHasSeenConfigFields] = useState(false);
  let [toolAccessCompleted, setToolAccessCompleted] = useState(false);
  let [toolSelection, setToolSelection] = useState<ToolSelection>(() =>
    createToolSelection('all')
  );

  let [oauthSetup, setOauthSetup] = useState<OAuthSetup | null>(null);
  let [oauthError, setOauthError] = useState<string | null>(null);
  let oauthStarted = useRef(false);

  let sessionType = flowSession.typeConcrete ?? flowSession.type;
  let isOAuth = flowSession.authMethod?.type === 'oauth';
  let toolFiltersEnabled = !!flowSession.configuration?.toolFilters?.enabled;

  let needsProviderSelection = !flowSession.providerId;
  let needsAuthConfig = sessionType !== 'config_only' && !flowSession.authConfig;
  let needsConfig = sessionType !== 'auth_only' && !flowSession.config && !configSubmitted;

  let sessionCredentials = useMemo(
    () => ({ sessionId: flowSession.id, clientSecret }),
    [flowSession.id, clientSecret]
  );
  let providerCredentials = needsProviderSelection ? null : sessionCredentials;

  let authSchemaLoader = useAuthConfigSchema(needsAuthConfig ? providerCredentials : null);
  let configSchemaLoader = useConfigSchema(needsConfig ? providerCredentials : null);
  let tools = useSetupSessionTools(toolFiltersEnabled ? providerCredentials : null);

  let authConfigSchema = authSchemaLoader.data?.schema ?? null;
  let configSchema = configSchemaLoader.data?.schema ?? null;
  let hasAuthFields = hasSchemaFields(authConfigSchema);
  let hasConfigFields = hasSchemaFields(configSchema);

  let toolItems = useMemo(() => tools.data?.items ?? [], [tools.data]);
  let toolCategories = useMemo(() => tools.data?.toolCategories ?? [], [tools.data]);

  let toolFilters = useMemo(
    () =>
      toolFiltersEnabled
        ? (toToolFilterPayload(toolSelection, { emptySelection: 'all' }) ?? undefined)
        : undefined,
    [toolSelection, toolFiltersEnabled]
  );

  let showConfigStep =
    (needsConfig && hasConfigFields) || (toolFiltersEnabled && !toolAccessCompleted);

  let shouldStartOAuth =
    !needsProviderSelection &&
    !showConfigStep &&
    needsAuthConfig &&
    isOAuth &&
    !!authSchemaLoader.data &&
    !hasAuthFields;

  let resolveNextStep = (): Step => {
    if (needsProviderSelection) return 'provider';
    if (showConfigStep) return 'config';
    if (needsAuthConfig && hasAuthFields) return 'auth_config';
    if (shouldStartOAuth) return 'oauth_loading';

    return 'completed';
  };

  let step = explicitStep ?? resolveNextStep();

  let isPreparing =
    (!!providerCredentials && needsAuthConfig && authSchemaLoader.isLoading) ||
    (!!providerCredentials && needsConfig && configSchemaLoader.isLoading) ||
    (step === 'config' && toolFiltersEnabled && tools.isLoading) ||
    (step === 'oauth_loading' && !oauthError);

  useEffect(() => {
    if (hasConfigFields) setHasSeenConfigFields(true);
  }, [hasConfigFields]);

  useEffect(() => {
    setToolSelection(current => {
      if (current.mode !== 'select') return current;

      let toolKeys = new Set(toolItems.map(tool => tool.key));
      let categoryKeys = new Set(toolItems.flatMap(tool => tool.toolCategoryKeys));

      return {
        ...current,
        toolKeys: current.toolKeys.filter(key => toolKeys.has(key)),
        categoryKeys: current.categoryKeys.filter(key => categoryKeys.has(key))
      };
    });
  }, [toolItems]);

  let sendAuthConfig = async (authConfigInput: Record<string, unknown>) => {
    await client.setupSession.setAuthConfig({
      ...sessionCredentials,
      authConfigInput,
      toolFilters
    });

    if (!isOAuth) return null;

    return await client.setupSession.getOauthSetup(sessionCredentials);
  };

  let showOAuthRedirect = (setup: OAuthSetup) => {
    if (flowSession.skipConfirmation && setup.url) {
      window.location.href = setup.url;
      return;
    }

    setOauthSetup(setup);
    setExplicitStep('oauth_redirect');
  };

  let completeAuthConfig = async (authConfigInput: Record<string, unknown>) => {
    let setup = await sendAuthConfig(authConfigInput);

    if (setup) showOAuthRedirect(setup);
    else setExplicitStep('completed');
  };

  useEffect(() => {
    if (!shouldStartOAuth || oauthStarted.current) return;
    oauthStarted.current = true;

    sendAuthConfig({})
      .then(setup => {
        if (setup) showOAuthRedirect(setup);
        else setOauthError('Failed to get OAuth URL. Please try again with a new session.');
      })
      .catch((err: unknown) => {
        setOauthError((err as { message?: string })?.message ?? 'Failed to initiate OAuth');
      });
  }, [shouldStartOAuth]);

  let selectProvider = useMutation(async (providerId: string) => {
    let result = await client.setupSession.selectProvider({
      ...sessionCredentials,
      providerId
    });

    setFlowSession(result.session);
    setFlowProvider(result.provider);
    setToolAccessCompleted(false);
    setExplicitStep(null);
  });

  let submitConfig = useMutation(async (configInput: Record<string, unknown>) => {
    if (needsConfig) {
      await client.setupSession.setConfig({ ...sessionCredentials, configInput, toolFilters });
      setConfigSubmitted(true);
    }

    if (toolFiltersEnabled && !needsConfig && !needsAuthConfig) {
      await client.setupSession.setConfig({
        ...sessionCredentials,
        configInput: {},
        toolFilters
      });
    }

    if (toolFiltersEnabled) setToolAccessCompleted(true);

    if (!needsConfig && needsAuthConfig && !hasAuthFields) {
      await completeAuthConfig({});
      return;
    }

    setExplicitStep(null);
  });

  let submitAuthConfig = useMutation(completeAuthConfig);

  let stages = useMemo(() => {
    let hasConfigStage =
      toolFiltersEnabled ||
      hasSeenConfigFields ||
      hasConfigFields ||
      !!flowSession.config ||
      configSubmitted;

    let result: Stage[] = [];
    if (includesProviderStage) result.push('provider');
    if (hasConfigStage) result.push('config');
    if (sessionType !== 'config_only') result.push('auth');

    return result;
  }, [
    includesProviderStage,
    toolFiltersEnabled,
    hasSeenConfigFields,
    hasConfigFields,
    flowSession.config,
    configSubmitted,
    sessionType
  ]);

  let currentStage = stepStages[step];
  let stageIndex = currentStage ? stages.indexOf(currentStage) : -1;

  return {
    session: flowSession,
    provider: flowProvider,
    sessionCredentials,

    step,
    isPreparing,
    stageLabels: stages.map(stage => stageLabels[stage]),
    stageIndex: stageIndex >= 0 ? stageIndex : stages.length,

    needsAuthConfig,
    authConfigSchema,
    configSchema,
    schemaLoaders: {
      authSchema: !!providerCredentials && needsAuthConfig && authSchemaLoader,
      configSchema: !!providerCredentials && needsConfig && configSchemaLoader
    },

    oauthSetup,
    oauthError,

    toolAccess: toolFiltersEnabled
      ? {
          isLoading: tools.isLoading,
          tools: toolItems,
          categories: toolCategories,
          selection: toolSelection,
          onSelectionChange: setToolSelection,
          onModeChange: (mode: ToolAccessMode) => {
            if (mode !== 'none')
              setToolSelection(current => setToolSelectionMode(current, mode));
          }
        }
      : null,

    selectProvider,
    submitConfig,
    submitAuthConfig
  };
};

export type SetupFlow = ReturnType<typeof useSetupFlow>;
