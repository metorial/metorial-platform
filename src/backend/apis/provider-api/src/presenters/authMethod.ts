export type AuthMethodScopeData = {
  id: string;
  scope: string;
  name: string;
  description: string | null;
};

export type AuthMethodData = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  inputSchema: unknown;
  scopes: AuthMethodScopeData[] | null;
  providerId: string;
  providerSpecificationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let authMethodPresenter = (authMethod: AuthMethodData) => ({
  object: 'provider.auth_method' as const,
  id: authMethod.id,
  type: authMethod.type,
  name: authMethod.name,
  description: authMethod.description,
  inputSchema: authMethod.inputSchema,
  scopes: authMethod.scopes?.map(s => ({
    object: 'provider.auth_method.scope' as const,
    id: s.id,
    scope: s.scope,
    name: s.name,
    description: s.description
  })) ?? null,
  providerId: authMethod.providerId,
  providerSpecificationId: authMethod.providerSpecificationId,
  createdAt: authMethod.createdAt,
  updatedAt: authMethod.updatedAt
});
