type SlateAuthConfigScopeRecord = {
  grantedScopes?: string[] | null;
  oauthCredentials?: {
    scopes?: string[] | null;
  } | null;
};

export let resolveSlateAuthConfigScopes = (
  record: SlateAuthConfigScopeRecord
): string[] | null => {
  if (Array.isArray(record.grantedScopes) && record.grantedScopes.length > 0) {
    return record.grantedScopes;
  }

  if (Array.isArray(record.oauthCredentials?.scopes)) return record.oauthCredentials.scopes;
  if (Array.isArray(record.grantedScopes)) return record.grantedScopes;

  return null;
};
