import {
  useProvider,
  useProviderAuthMethods,
  useProviderConfigVaults,
  useProviderDeployment,
  useProviderDeploymentConfigSchema
} from '@metorial/state';
import {
  areJsonSchemaRequiredFieldsDefaulted,
  getJsonSchemaDefaultObject,
  getJsonSchemaObject,
  hasJsonSchemaProperties,
  hasRequiredJsonSchemaFields
} from './jsonSchema';
import { getProviderOAuthAutoRegistrationEnabled } from './providerOAuthAutoRegistration';

let getAuthMethodOrderRank = (type: string | null | undefined) => {
  switch (type) {
    case 'oauth':
      return 0;
    case 'token':
      return 1;
    case 'custom':
      return 2;
    default:
      return 100;
  }
};

export let orderProviderAuthMethods = <T extends { type?: string | null }>(methods: T[]) =>
  methods
    .map((method, index) => ({
      method,
      index
    }))
    .sort((a, b) => {
      let rankDifference =
        getAuthMethodOrderRank(a.method.type) - getAuthMethodOrderRank(b.method.type);
      if (rankDifference !== 0) return rankDifference;
      return a.index - b.index;
    })
    .map(({ method }) => method);

let getAuthMethodHasSchema = (inputSchema: unknown) => {
  let schemaObj = getJsonSchemaObject(
    inputSchema as Record<string, unknown> | null | undefined
  );

  return !!(
    schemaObj &&
    typeof schemaObj === 'object' &&
    schemaObj.type === 'object' &&
    schemaObj.properties &&
    Object.keys(schemaObj.properties).length > 0
  );
};

export let getProviderConfigSchemaCapabilities = (d: {
  schemaValue: Record<string, unknown> | null | undefined;
  hasVaults: boolean;
  isLoading?: boolean;
}) => {
  let schemaObject = getJsonSchemaObject(d.schemaValue);
  let hasSchemaObject = !!schemaObject;
  let hasSchemaFields = hasJsonSchemaProperties(d.schemaValue);
  let hasRequiredFields = hasRequiredJsonSchemaFields(d.schemaValue);
  let requiredFieldsHaveDefaults = areJsonSchemaRequiredFieldsDefaulted(d.schemaValue);
  let defaultConfigValue = getJsonSchemaDefaultObject(d.schemaValue);
  let hasExplicitEmptySchema = Boolean(
    schemaObject && !hasSchemaFields && schemaObject.additionalProperties === false
  );
  let canCreateConfig = hasSchemaFields || hasExplicitEmptySchema || d.hasVaults;
  let canCreateConfigVault = hasSchemaFields || hasExplicitEmptySchema;
  let canAutoCreateEmptyConfig = !hasRequiredFields || requiredFieldsHaveDefaults;
  let isLoading = !!d.isLoading;
  let configDisabledReason = isLoading
    ? 'Loading configuration options...'
    : canCreateConfig
      ? null
      : 'No configuration schema or config vault is available for this deployment.';
  let configVaultDisabledReason = isLoading
    ? 'Loading configuration options...'
    : canCreateConfigVault
      ? null
      : 'No editable configuration schema is available for this deployment.';

  return {
    schemaObject,
    hasSchemaObject,
    hasSchemaFields,
    hasRequiredFields,
    requiredFieldsHaveDefaults,
    defaultConfigValue,
    hasExplicitEmptySchema,
    hasVaults: d.hasVaults,
    isLoading,
    canCreateConfig,
    canCreateConfigVault,
    canAutoCreateEmptyConfig,
    configDisabledReason,
    configVaultDisabledReason,
    disabledReason: configDisabledReason
  };
};

export let useProviderConfigCreationCapabilities = (
  instanceId: string | null | undefined,
  providerDeploymentId: string | null | undefined
) => {
  let scopedInstanceId = instanceId && providerDeploymentId ? instanceId : null;
  let configSchema = useProviderDeploymentConfigSchema(scopedInstanceId, providerDeploymentId);
  let vaults = useProviderConfigVaults(
    scopedInstanceId,
    providerDeploymentId ? { providerDeploymentId } : undefined
  );

  let hasVaults = (vaults.data?.items?.length ?? 0) > 0;
  let isLoading = configSchema.isLoading || vaults.isLoading;

  return getProviderConfigSchemaCapabilities({
    schemaValue: configSchema.data?.schema,
    hasVaults,
    isLoading
  });
};

export let useProviderAuthCreationCapabilities = (
  instanceId: string | null | undefined,
  providerDeploymentId: string | null | undefined,
  providerId?: string | null | undefined
) => {
  let scopedDeploymentInstanceId = instanceId && providerDeploymentId ? instanceId : null;
  let scopedProviderInstanceId =
    instanceId && (providerId || providerDeploymentId) ? instanceId : null;
  let deployment = useProviderDeployment(scopedDeploymentInstanceId, providerDeploymentId);
  let resolvedProviderId = providerId ?? deployment.data?.providerId ?? null;
  let provider = useProvider(scopedProviderInstanceId, resolvedProviderId);
  let effectiveVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id ?? null;
  let authMethods = useProviderAuthMethods(
    scopedProviderInstanceId,
    effectiveVersionId ? { providerVersionId: effectiveVersionId ?? undefined } : null
  );
  let authMethodItems = orderProviderAuthMethods(authMethods.data?.items ?? []);
  let oauthAutoRegistrationEnabled = getProviderOAuthAutoRegistrationEnabled(provider.data);
  let hasAuthMethods = authMethodItems.length > 0;
  let hasOAuthMethod = authMethodItems.some(method => method.type === 'oauth');
  let hasManualAuthConfigMethod = authMethodItems.some(method => {
    if (method.type !== 'oauth') return true;
    return getAuthMethodHasSchema(method.inputSchema);
  });
  let isLoading =
    (!!providerDeploymentId && deployment.isLoading) ||
    (!deployment.data?.lockedVersion?.id && provider.isLoading) ||
    (effectiveVersionId ? authMethods.isLoading : false);

  let baseDisabledReason = isLoading
    ? 'Loading authentication options...'
    : !effectiveVersionId
      ? 'No provider version is available yet, so authentication cannot be configured.'
      : !hasAuthMethods
        ? providerDeploymentId
          ? 'This deployment does not have any authentication methods.'
          : 'This provider does not have any authentication methods.'
        : null;

  let authConfigDisabledReason =
    baseDisabledReason ??
    (!hasManualAuthConfigMethod && !hasOAuthMethod
      ? providerDeploymentId
        ? 'No supported authentication creation flow is available for this deployment.'
        : 'No supported authentication creation flow is available for this provider.'
      : null);
  let authCredentialsDisabledReason =
    baseDisabledReason ??
    (!hasOAuthMethod
      ? providerDeploymentId
        ? 'This deployment does not have any OAuth authentication methods.'
        : 'This provider does not have any OAuth authentication methods.'
      : oauthAutoRegistrationEnabled
        ? 'This provider uses OAuth auto-registration, so manual app credentials are not supported.'
        : null);

  return {
    deployment,
    provider,
    authMethods,
    effectiveVersionId,
    authMethodItems,
    oauthAutoRegistrationEnabled,
    hasAuthMethods,
    hasOAuthMethod,
    hasManualAuthConfigMethod,
    hasSetupAuthFlow: hasOAuthMethod,
    isLoading,
    canCreateAuthConfig: !authConfigDisabledReason,
    canCreateAuthCredentials: !authCredentialsDisabledReason,
    authConfigDisabledReason,
    authCredentialsDisabledReason
  };
};
