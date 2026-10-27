import {
  type Provider,
  type ProviderAuthMethod,
  ProviderAuthMethodType
} from '@metorial-subspace/db';
import { getProviderVersionSource } from '@metorial-subspace/module-provider-internal/src/lib/providerVersionSource';

export type MatchableProviderAuthMethod = Pick<
  ProviderAuthMethod,
  | 'id'
  | 'globalOid'
  | 'specId'
  | 'specUniqueIdentifier'
  | 'key'
  | 'callableId'
  | 'type'
  | 'isDefault'
  | 'createdAt'
>;

type SpecificationAuthMethodsVersion<AuthMethod> = {
  specification: { providerAuthMethods: AuthMethod[] } | null;
} | null;

export type EffectiveProviderAuthMethodDeployment<AuthMethod> = {
  currentVersion: {
    lockedVersionOid: bigint | null;
    lockedVersion: SpecificationAuthMethodsVersion<AuthMethod>;
  } | null;
  provider: Pick<Provider, 'defaultVariantOid' | 'hasEnvironments'> & {
    defaultVariant: { currentVersion: SpecificationAuthMethodsVersion<AuthMethod> } | null;
  };
};

export type EffectiveProviderAuthMethodResolution<AuthMethod> =
  { type: 'unresolved' } | { type: 'resolved'; authMethod: AuthMethod | null };

let byAuthMethodPreference = (
  a: MatchableProviderAuthMethod,
  b: MatchableProviderAuthMethod
) =>
  Number(b.isDefault) - Number(a.isDefault) || a.createdAt.getTime() - b.createdAt.getTime();

// Shared with the auth config gate; keep the match order stable.
export let matchProviderAuthMethodInSpecification = <
  AuthMethod extends MatchableProviderAuthMethod
>(d: {
  authMethodId: string;
  specificationAuthMethods: AuthMethod[];
  previousAuthMethod: MatchableProviderAuthMethod | null;
}): AuthMethod | null => {
  let candidates = [...d.specificationAuthMethods].sort(byAuthMethodPreference);
  let authMethodId = d.authMethodId;
  let isTypeId = !!ProviderAuthMethodType[authMethodId as keyof typeof ProviderAuthMethodType];

  let requested = candidates.find(
    authMethod =>
      authMethod.id === authMethodId ||
      authMethod.specId === authMethodId ||
      authMethod.specUniqueIdentifier === authMethodId ||
      authMethod.key === authMethodId ||
      authMethod.callableId === authMethodId ||
      (isTypeId && authMethod.type === authMethodId)
  );
  if (requested) return requested;

  let previous = d.previousAuthMethod;
  if (!previous) return null;

  return (
    candidates.find(authMethod => authMethod.globalOid === previous.globalOid) ??
    candidates.find(
      authMethod =>
        authMethod.specId === previous.specId ||
        authMethod.specUniqueIdentifier === previous.specUniqueIdentifier ||
        authMethod.key === previous.key ||
        authMethod.callableId === previous.callableId
    ) ??
    candidates.find(authMethod => authMethod.type === previous.type) ??
    null
  );
};

// Resolves, from preloaded data, the auth method the auth config gate
// (providerAuthConfigInternal.getVersionAndAuthMethod) would use for a pinned auth method.
// Per-environment provider versions cannot be preloaded, so they stay unresolved.
export let resolveEffectiveProviderAuthMethod = <
  AuthMethod extends MatchableProviderAuthMethod
>(d: {
  authMethod: MatchableProviderAuthMethod;
  deployment: EffectiveProviderAuthMethodDeployment<AuthMethod>;
}): EffectiveProviderAuthMethodResolution<AuthMethod> => {
  let source = getProviderVersionSource({
    provider: d.deployment.provider,
    deployment: d.deployment
  });

  if (source.type === 'none') return { type: 'resolved', authMethod: null };
  if (source.type === 'environment') return { type: 'unresolved' };

  let version =
    source.type === 'locked'
      ? d.deployment.currentVersion?.lockedVersion
      : d.deployment.provider.defaultVariant?.currentVersion;
  if (!version) return { type: 'resolved', authMethod: null };
  if (!version.specification) return { type: 'unresolved' };

  return {
    type: 'resolved',
    authMethod: matchProviderAuthMethodInSpecification({
      authMethodId: d.authMethod.id,
      specificationAuthMethods: version.specification.providerAuthMethods,
      previousAuthMethod: d.authMethod
    })
  };
};
