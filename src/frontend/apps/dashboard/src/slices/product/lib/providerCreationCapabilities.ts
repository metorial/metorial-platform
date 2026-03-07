import {
  useProvider,
  useProviderAuthMethods,
  useProviderConfigSchema,
  useProviderConfigVaults,
  useProviderDeployment
} from '@metorial/state';
import { getJsonSchemaObject, hasJsonSchemaProperties } from './jsonSchema';

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
  let hasExplicitEmptySchema = Boolean(
    schemaObject &&
      !hasSchemaFields &&
      schemaObject.additionalProperties === false
  );
  let canCreateConfig = !hasExplicitEmptySchema && (hasSchemaFields || d.hasVaults);
  let canCreateConfigVault = hasSchemaFields;
  let isLoading = !!d.isLoading;
  let configDisabledReason = isLoading
    ? 'Loading configuration options...'
    : hasExplicitEmptySchema
      ? 'This deployment has no configurable values. Its default config is created automatically.'
      : canCreateConfig
        ? null
        : 'No configuration schema or config vault is available for this deployment.';
  let configVaultDisabledReason = isLoading
    ? 'Loading configuration options...'
    : hasExplicitEmptySchema
      ? 'This deployment has no configurable values, so config vaults are not needed.'
      : canCreateConfigVault
        ? null
        : 'No editable configuration schema is available for this deployment.';

  return {
    schemaObject,
    hasSchemaObject,
    hasSchemaFields,
    hasExplicitEmptySchema,
    hasVaults: d.hasVaults,
    isLoading,
    canCreateConfig,
    canCreateConfigVault,
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
  let configSchema = useProviderConfigSchema(scopedInstanceId, providerDeploymentId);
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
  let scopedInstanceId = instanceId && providerDeploymentId ? instanceId : null;
  let deployment = useProviderDeployment(scopedInstanceId, providerDeploymentId);
  let resolvedProviderId = providerId ?? deployment.data?.providerId ?? null;
  let provider = useProvider(scopedInstanceId, resolvedProviderId);
  let effectiveVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id ?? null;
  let authMethods = useProviderAuthMethods(scopedInstanceId, effectiveVersionId);
  let authMethodItems = authMethods.data?.items ?? [];
  let oauthAutoRegistrationEnabled =
    provider.data?.oauth?.autoRegistration?.status === 'enabled';
  let hasAuthMethods = authMethodItems.length > 0;
  let hasOAuthMethod = authMethodItems.some(method => method.type === 'oauth');
  let hasManualAuthConfigMethod = authMethodItems.some(method => {
    if (method.type !== 'oauth') return true;
    return getAuthMethodHasSchema(method.inputSchema);
  });
  let isLoading =
    deployment.isLoading ||
    (!deployment.data?.lockedVersion?.id && provider.isLoading) ||
    (effectiveVersionId ? authMethods.isLoading : false);

  let baseDisabledReason = isLoading
    ? 'Loading authentication options...'
    : !effectiveVersionId
      ? 'No provider version is available yet, so authentication cannot be configured.'
      : !hasAuthMethods
        ? 'This deployment does not have any authentication methods.'
        : null;

  let authConfigDisabledReason =
    baseDisabledReason ??
    (!hasManualAuthConfigMethod && !hasOAuthMethod
      ? 'No supported authentication creation flow is available for this deployment.'
      : null);
  let authCredentialsDisabledReason =
    baseDisabledReason ??
    (!hasOAuthMethod
      ? 'This deployment does not have any OAuth authentication methods.'
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
