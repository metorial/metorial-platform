export type ManagedOAuthScopes = NonNullable<PrismaJson.ProviderAuthMethodValue['scopes']>;

export let getManagedOAuthScopeIds = (value: ManagedOAuthScopes): string[] => {
  return value.map(scope => scope.id);
};
