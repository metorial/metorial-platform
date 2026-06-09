import type { ProviderTool } from '@metorial-subspace/db';

export type ToolScopeCarrier = Pick<ProviderTool, 'value'>;

type ScopeRecord = {
  scopes?: PrismaJson.ProviderAuthScopes | null;
  needsScopeSync?: boolean | null;
};

export type ScopeSource = {
  authConfig?: ScopeRecord | null;
  authCredentials?: ScopeRecord | null;
};

let intersectArrays = (arr1: string[], arr2: string[]): string[] => {
  let set2 = new Set(arr2);
  return arr1.filter(item => set2.has(item));
};

let resolveScopeSet = (source: ScopeRecord | null | undefined) => {
  if (!Array.isArray(source?.scopes)) return null;
  if (source.scopes.length > 0) return source.scopes;
  if (source.needsScopeSync === false) return source.scopes;

  return null;
};

export let resolveGrantedScopes = (source: ScopeSource): string[] | null => {
  let configScopes = resolveScopeSet(source.authConfig);
  let credentialScopes = resolveScopeSet(source.authCredentials);

  if (configScopes !== null && credentialScopes !== null) {
    return intersectArrays(configScopes, credentialScopes);
  }

  if (credentialScopes !== null) return credentialScopes;
  if (configScopes !== null) return configScopes;

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
