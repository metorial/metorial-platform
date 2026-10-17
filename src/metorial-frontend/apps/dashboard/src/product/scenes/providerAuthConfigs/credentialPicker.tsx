import {
  type DashboardInstanceProviderDeploymentsAuthCredentialsListOutput,
  useProviderAuthCredentials
} from '@metorial/state';
import { Badge, Flex, SelectList, type SelectListItem } from '@metorial/ui';
import { sortBy } from 'lodash';
import { type ReactNode, useEffect, useState } from 'react';

export type ProviderAuthCredential =
  DashboardInstanceProviderDeploymentsAuthCredentialsListOutput['items'][number];

export let NEW_CREDENTIALS_ID = '__new_credentials__';
export let CREDENTIALS_PAGE_SIZE = 25;
export let CREDENTIALS_SEARCH_THRESHOLD = 10;

export let getProviderAuthCredentialsQuery = (p: {
  providerId: string;
  providerAuthMethodId: string;
  search?: string;
}) => ({
  origin: ['custom' as const, 'managed' as const],
  providerId: p.providerId,
  providerAuthMethodId: p.providerAuthMethodId,
  limit: CREDENTIALS_PAGE_SIZE,
  ...(p.search ? { search: p.search } : {})
});

export let sortProviderAuthCredentials = (credentials: ProviderAuthCredential[]) =>
  sortBy(credentials, [
    credential => Number(!credential.isManaged),
    credential => Number(!credential.isDefault),
    credential => credential.name ?? credential.id
  ]);

export let getPreferredProviderAuthCredential = (credentials: ProviderAuthCredential[]) =>
  sortProviderAuthCredentials(credentials)[0] ?? null;

let hashIds = (ids: string[]) => {
  let hash = 5381;
  for (let char of [...ids].sort().join(',')) hash = (hash * 33) ^ char.charCodeAt(0);
  return (hash >>> 0).toString(36);
};

let getRememberedChoiceKey = (credentials: ProviderAuthCredential[]) =>
  `metorial:auth-credentials-choice:${hashIds(credentials.map(credential => credential.id))}`;

export let getRememberedProviderAuthCredentialId = (credentials: ProviderAuthCredential[]) => {
  if (credentials.length < 2) return null;

  try {
    let id = localStorage.getItem(getRememberedChoiceKey(credentials));
    return id && credentials.some(credential => credential.id == id) ? id : null;
  } catch {
    return null;
  }
};

export let rememberProviderAuthCredentialChoice = (
  credentials: ProviderAuthCredential[],
  credentialId: string | null
) => {
  if (credentials.length < 2) return;

  try {
    let key = getRememberedChoiceKey(credentials);
    if (credentialId) localStorage.setItem(key, credentialId);
    else localStorage.removeItem(key);
  } catch {}
};

let toItem = (credential: ProviderAuthCredential): SelectListItem => ({
  id: credential.id,
  label: credential.name || credential.id,
  description:
    credential.description?.trim() ||
    (credential.isManaged ? 'Use the Metorial OAuth app, great for quick testing.' : undefined),
  badge:
    credential.isManaged || credential.isDefault ? (
      <Flex gap={6}>
        {credential.isManaged && <Badge color="gray">Metorial Managed</Badge>}
        {credential.isDefault && <Badge color="blue">Default</Badge>}
      </Flex>
    ) : undefined
});

export let ProviderAuthCredentialPicker = (p: {
  instanceId: string;
  providerId: string;
  providerAuthMethodId: string;
  searchable: boolean;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  children?: ReactNode;
}) => {
  let [search, setSearch] = useState('');
  let credentials = useProviderAuthCredentials(
    p.instanceId,
    getProviderAuthCredentialsQuery({
      providerId: p.providerId,
      providerAuthMethodId: p.providerAuthMethodId,
      search
    })
  );

  let [visibleCredentials, setVisibleCredentials] = useState(
    () => credentials.data?.items ?? []
  );
  useEffect(() => {
    if (!credentials.isLoading && credentials.data) setVisibleCredentials(credentials.data.items);
  }, [credentials.isLoading, credentials.data]);

  let items: SelectListItem[] = [
    ...(search ? visibleCredentials : sortProviderAuthCredentials(visibleCredentials)).map(toItem),
    {
      id: NEW_CREDENTIALS_ID,
      label: 'Add New Credentials',
      description: 'Use your own OAuth app with a client ID and secret.'
    }
  ];

  return (
    <SelectList
      label="Credentials"
      description="Choose the OAuth app to authenticate with."
      items={items}
      value={p.value}
      onChange={p.onChange}
      disabled={p.disabled}
      searchable={p.searchable}
      searchPlaceholder="Search credentials"
      onSearchChange={setSearch}
      isLoading={credentials.isLoading}
      empty="No matching credentials found."
      maxHeight={p.searchable ? 360 : undefined}
      pagination={{
        hasPrevious: !!credentials.data?.pagination.hasMoreBefore,
        hasNext: !!credentials.data?.pagination.hasMoreAfter,
        onPrevious: credentials.previous,
        onNext: credentials.next
      }}
      collapseOn={[NEW_CREDENTIALS_ID]}
      backLabel="Back"
    >
      {p.children}
    </SelectList>
  );
};
