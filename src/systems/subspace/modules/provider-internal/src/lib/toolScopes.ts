import type { ProviderTool } from '@metorial-subspace/db';

export type ToolScopeCarrier = Pick<ProviderTool, 'value'>;

export type ScopeSource = {
  authConfig?: { scopes?: PrismaJson.ProviderAuthScopes | null } | null;
  authCredentials?: { scopes?: PrismaJson.ProviderAuthScopes | null } | null;
};

/**
 * Resolve the list of granted scopes from an auth config / credentials pair.
 * Credentials take precedence over the auth config because they represent the
 * tenant-specific grant and may be narrower than the auth config's scopes.
 *
 * Returns `null` when no scope information is available. Callers should treat
 * `null` as "do not filter" to avoid accidentally blocking tools when no
 * authentication context is attached.
 */
export let resolveGrantedScopes = (source: ScopeSource): string[] | null => {
  let credentialScopes = source.authCredentials?.scopes;
  if (credentialScopes) return credentialScopes;

  let configScopes = source.authConfig?.scopes;
  if (configScopes) return configScopes;

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

export let filterToolsByScopes = <T extends ToolScopeCarrier>(
  tools: T[],
  grantedScopes: string[] | null | undefined
): T[] => {
  if (grantedScopes === null || grantedScopes === undefined) return tools;
  return tools.filter(tool => checkToolScopesSatisfied(tool, grantedScopes).allowed);
};
