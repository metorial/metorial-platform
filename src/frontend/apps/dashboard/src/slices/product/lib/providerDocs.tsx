import { ProviderListingsGetOutput } from '@metorial/dashboard-sdk';
import { theme } from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';

type ProviderListingDocs = ProviderListingsGetOutput['docs'];

export type ProviderDocReference =
  NonNullable<ProviderListingDocs>['authMethods'][number]['docs'][number];

type AuthMethodDocTarget = {
  key?: string | null;
  name?: string | null;
  type?: string | null;
};

export let AUTH_METHOD_DOC_TYPES = {
  oauth: 'docs.auth.oauth',
  oauthScopes: 'docs.auth.oauth_scopes'
} as const;

let DocsLink = styled.a`
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  color: ${theme.colors.gray600};
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;

  &:hover {
    color: ${theme.colors.gray900};
  }
`;

let getDocs = (providerListing: unknown): ProviderListingDocs | null => {
  let docs = (providerListing as any)?.docs;
  if (!docs || typeof docs !== 'object') return null;
  return docs as ProviderListingDocs;
};

let matchesAuthMethod = (
  docMethod: AuthMethodDocTarget,
  authMethod?: AuthMethodDocTarget | null
) => {
  if (!authMethod) return false;

  if (docMethod.key && authMethod.key && docMethod.key === authMethod.key) return true;
  if (docMethod.name && authMethod.name && docMethod.name === authMethod.name) return true;
  if (docMethod.type && authMethod.type && docMethod.type === authMethod.type) return true;

  return false;
};

let findAuthMethodDocs = (
  providerListing: unknown,
  authMethod?: AuthMethodDocTarget | null
): ProviderDocReference[] => {
  let docs = getDocs(providerListing);
  if (!docs || !authMethod) return [];

  let authMethodEntry = (docs.authMethods ?? []).find(entry =>
    matchesAuthMethod(entry, authMethod)
  );

  return authMethodEntry?.docs ?? [];
};

let findAuthMethodDocByType = (
  providerListing: unknown,
  authMethod: AuthMethodDocTarget | null | undefined,
  type: string
) =>
  findAuthMethodDocs(providerListing, authMethod).find(
    doc => doc.type === type && !!doc.url
  ) ?? null;

export let getAuthMethodOAuthDoc = (
  providerListing: unknown,
  authMethod?: AuthMethodDocTarget | null
) => findAuthMethodDocByType(providerListing, authMethod, AUTH_METHOD_DOC_TYPES.oauth);

export let getAuthMethodOAuthScopesDoc = (
  providerListing: unknown,
  authMethod?: AuthMethodDocTarget | null
) => findAuthMethodDocByType(providerListing, authMethod, AUTH_METHOD_DOC_TYPES.oauthScopes);

export let ProviderDocsLink = ({
  doc,
  children
}: {
  doc?: ProviderDocReference | null;
  children?: React.ReactNode;
}) => {
  if (!doc?.url) return null;

  return (
    <DocsLink href={doc.url} target="_blank" rel="noopener noreferrer">
      {children ?? doc.name}
    </DocsLink>
  );
};
