export type ManagedOAuthScopes = NonNullable<PrismaJson.ProviderAuthMethodValue['scopes']>;

let getManagedOAuthScopeId = (scope: unknown): string | null => {
  if (typeof scope === 'string') {
    return scope;
  }

  if (!scope || typeof scope !== 'object') {
    return null;
  }

  if ('id' in scope && typeof scope.id === 'string') {
    return scope.id;
  }

  if ('scope' in scope && typeof scope.scope === 'string') {
    return scope.scope;
  }

  return null;
};

export let normalizeManagedOAuthScopeIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  let seen = new Set<string>();
  let scopeIds: string[] = [];

  for (let scope of value) {
    let scopeId = getManagedOAuthScopeId(scope);
    if (!scopeId || seen.has(scopeId)) {
      continue;
    }

    seen.add(scopeId);
    scopeIds.push(scopeId);
  }

  return scopeIds;
};

export let getManagedOAuthScopeIds = (value: ManagedOAuthScopes): string[] => {
  return normalizeManagedOAuthScopeIds(value);
};
