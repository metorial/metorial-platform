import { Service } from '@lowerdeck/service';
import {
  getConsumerProviderCatalogEntry,
  listConsumerCatalogEntries,
  listFeaturedConsumerCatalogEntries
} from './providerFlow/catalog';
import { hydrateConsumerProviders } from './providerFlow/hydration';
import {
  createConsumerProviderSetupSession,
  deployConsumerProvider,
  getConsumerProviderSetupSession
} from './providerFlow/provisioning';

export type {
  ConsumerProviderCatalogEntry,
  ConsumerProviderTemplateCatalogEntry
} from './providerFlow/types';

export let consumerProviderFlowService = Service.create('consumerProviderFlowService', () => ({
  listConsumerCatalogEntries,
  listFeaturedConsumerCatalogEntries,
  getConsumerProviderCatalogEntry,
  hydrateConsumerProviders,
  createConsumerProviderSetupSession,
  getConsumerProviderSetupSession,
  deployConsumerProvider
})).build();
