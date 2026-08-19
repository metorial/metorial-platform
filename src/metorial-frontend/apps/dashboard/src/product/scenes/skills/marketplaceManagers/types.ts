import type { DashboardInstancePortalsAccessListOutput } from '@metorial/dashboard-sdk';

export type MarketplaceManagerAccess =
  DashboardInstancePortalsAccessListOutput['items'][number];

export type MarketplacePluginOption = {
  id: string;
  name: string;
};

export type MarketplaceManagerScope =
  | { type: 'entire' }
  | { type: 'plugins'; plugins: MarketplacePluginOption[] };

export type MarketplaceManagerKind = 'group' | 'account';

export type MarketplaceManagerRow = {
  id: string;
  portalId: string;
  consumerGroupId: string;
  skillMarketplaceId: string;
  name: string;
  description: string | null;
  kind: MarketplaceManagerKind;
  accountId?: string;
  scope: MarketplaceManagerScope;
  marketplaceAccessId?: string;
  pluginAccesses: { pluginId: string; accessId: string }[];
};

export let MARKETPLACE_MANAGER_COPY =
  'Marketplace managers can update skills and plugins in the marketplace. You can assign managers to manage the entire marketplace or specific plugins.';

export type MarketplaceManagerSubjectMode = 'group' | 'account';
