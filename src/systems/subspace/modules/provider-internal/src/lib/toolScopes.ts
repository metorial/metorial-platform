import type { ProviderTool } from '@metorial-subspace/db';

export type ToolScopeCarrier = Pick<ProviderTool, 'value'>;

export type ScopeSource = {
  authConfig?: { scopes?: PrismaJson.ProviderAuthScopes | null } | null;
  authCredentials?: { scopes?: PrismaJson.ProviderAuthScopes | null } | null;
};

let intersectArrays = (
  arr1: string[] | null | undefined,
  arr2: string[] | null | undefined
): string[] | null => {
  if (!arr1?.length) return arr2 ?? null;
  if (!arr2?.length) return arr1;

  let set2 = new Set(arr2);
  return arr1.filter(item => set2.has(item));
};

export let resolveGrantedScopes = (source: ScopeSource): string[] | null => {
  let configScopes = source.authConfig?.scopes;
  let credentialScopes = source.authCredentials?.scopes;

  if (configScopes?.length || credentialScopes?.length) {
    return intersectArrays(configScopes, credentialScopes);
  }

  return null;
};

export let checkToolScopesSatisfied = (
  tool: ToolScopeCarrier,
  grantedScopes: string[] | null | undefined
) => {
  let toolScopes = tool.value?.scopes;
  if (!toolScopes || !toolScopes.AND || toolScopes.AND.length === 0) {
    return { allowed: true as const };
  }

  let granted = new Set(grantedScopes ?? []);

  for (let andClause of toolScopes.AND) {
    let or = andClause?.OR ?? [];
    if (or.length === 0) continue;
    if (!or.some(scope => granted.has(scope))) {
      return { allowed: false as const };
    }
  }

  return { allowed: true as const };
};

export let checkToolScopesSatisfiedByAuthMethods = (
  tool: ToolScopeCarrier,
  authMethodScopes: (string[] | null | undefined)[]
) => {
  for (let scopes of authMethodScopes) {
    if (!checkToolScopesSatisfied(tool, scopes ?? []).allowed) {
      return { allowed: false as const };
    }
  }

  return { allowed: true as const };
};

export let filterToolsByScopes = <T extends ToolScopeCarrier>(
  tools: T[],
  grantedScopes: string[] | null | undefined
): T[] => {
  if (grantedScopes === null || grantedScopes === undefined) return tools;
  return tools.filter(tool => checkToolScopesSatisfied(tool, grantedScopes).allowed);
};
