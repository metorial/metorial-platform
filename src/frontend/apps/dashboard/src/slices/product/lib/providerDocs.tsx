import { theme } from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';

export type ProviderDocReference = {
  type?: string | null;
  name: string;
  url: string;
};

type ProviderListingDocs = {
  provider?: ProviderDocReference[] | null;
  config?: ProviderDocReference[] | null;
  auth_methods?:
    | {
        key?: string | null;
        name?: string | null;
        type?: string | null;
        docs?: ProviderDocReference[] | null;
      }[]
    | null;
};

type AuthMethodDocTarget = {
  key?: string | null;
  name?: string | null;
  type?: string | null;
};

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

let getFirstDoc = (docs: ProviderDocReference[] | null | undefined) =>
  (docs ?? []).find(doc => !!doc?.url) ?? null;

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

export let getProviderDoc = (providerListing: unknown) =>
  getFirstDoc(getDocs(providerListing)?.provider);

export let getConfigDoc = (providerListing: unknown) =>
  getFirstDoc(getDocs(providerListing)?.config);

export let getAuthMethodDoc = (
  providerListing: unknown,
  authMethod?: AuthMethodDocTarget | null
) => {
  let docs = getDocs(providerListing);
  let authMethodDocs = docs?.auth_methods ?? [];
  let exactMatch = authMethodDocs.find(docMethod => matchesAuthMethod(docMethod, authMethod));

  return (
    getFirstDoc(exactMatch?.docs) ?? getFirstDoc(authMethodDocs.flatMap(m => m.docs ?? []))
  );
};

export let getScopeDoc = (providerListing: unknown, authMethod?: AuthMethodDocTarget | null) =>
  getAuthMethodDoc(providerListing, authMethod) ?? getProviderDoc(providerListing);

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
