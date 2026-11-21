export type {
  Capabilities as ModelCapabilities,
  Catalog,
  Endpoint as CatalogEndpoint,
  Model as CatalogModel,
  Name as CatalogName,
  Offering as CatalogOffering,
  OfferingVariant,
  Organization as CatalogOrganization,
  Pointer as CatalogPointer,
  Vendor as CatalogVendor
} from '@metorial/model-catalog/src/types';

export let metorialProviderSlug = 'metorial';

export type CatalogSyncCounts = {
  labs: number;
  providers: number;
  models: number;
  offerings: number;
  aliases: number;
};
