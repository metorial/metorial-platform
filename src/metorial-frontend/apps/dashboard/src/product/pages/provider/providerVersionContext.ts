import type { DashboardInstanceProvidersVersionsListOutput } from '@metorial/dashboard-sdk';
import { createContext, useContext } from 'react';

export type ProviderVersion = DashboardInstanceProvidersVersionsListOutput['items'][number];
export type ProviderVersionId = ProviderVersion['id'];

export type ProviderVersionContextValue = {
  selectedVersionId: ProviderVersionId | undefined;
  setSelectedVersionId: (id: ProviderVersionId | undefined) => void;
  currentVersionId: ProviderVersionId | undefined;
  selectedVersion: ProviderVersion | undefined;
  allVersions: ProviderVersion[];
  isDefaultVersion: boolean;
  resetToDefault: () => void;
};

export let ProviderVersionContext = createContext<ProviderVersionContextValue | null>(null);

export let useProviderVersionContext = () => {
  let ctx = useContext(ProviderVersionContext);
  if (!ctx) throw new Error('useProviderVersionContext must be used within ProviderLayout');
  return ctx;
};
