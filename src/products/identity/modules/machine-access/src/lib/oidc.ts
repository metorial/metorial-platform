export let oidcScopes = ['openid', 'profile', 'email'] as const;

export type OidcScope = (typeof oidcScopes)[number];

let oidcScopeSet = new Set<string>(oidcScopes);

export let splitOAuthAndOidcScopes = (scopes: string[]) => {
  let accessScopes: string[] = [];
  let requestedOidcScopes: OidcScope[] = [];

  for (let scope of scopes) {
    if (oidcScopeSet.has(scope)) {
      requestedOidcScopes.push(scope as OidcScope);
      continue;
    }

    accessScopes.push(scope);
  }

  return {
    accessScopes,
    oidcScopes: [...new Set(requestedOidcScopes)]
  };
};

export let combineOAuthAndOidcScopes = (d: {
  accessScopes: string[];
  oidcScopes?: string[] | null;
}) => [...new Set([...d.accessScopes, ...(d.oidcScopes ?? [])])];

export let hasOidcScope = (scopes: string[] | null | undefined, scope: OidcScope) =>
  !!scopes?.includes(scope);
