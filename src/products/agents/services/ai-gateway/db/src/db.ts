import { createDatabase } from '@lowerdeck/prisma-pg';
import type * as Spec from '@mtsrc/ai-gateway-spec';
import { PrismaClient } from '../prisma/generated/client';

export * from '../prisma/generated/client';

export let { db, withTransaction, addAfterTransactionHook } = createDatabase({
  name: 'ai-gateway',
  url: ['AI_GATEWAY_DATABASE_URL', 'DATABASE_URL'],
  createClient: adapter =>
    new PrismaClient({
      adapter,
      transactionOptions: {
        maxWait: 10000,
        timeout: 12000
      }
    }),
  afterHookDelayMs: 5000
});

declare global {
  namespace PrismaJson {
    type GatewayInstanceSettings = Spec.InstanceSettings;
    type GatewayLimits = Spec.GatewayLimit[];
    type PlatformLimits = Spec.PlatformLimit[];
    type GatewayTokenMetadata = Spec.GatewayTokenMetadata;
    type CatalogSyncCounts = Spec.CatalogSyncCounts;
    type ModelCapabilities = Spec.ModelCapabilities;
    type OfferingVariant = Spec.OfferingVariant;
    type Pricing = Spec.Pricing;
    type ProviderConnectionConfig = Spec.ProviderConnectionConfig;
    type ProviderFeatures = Spec.ProviderFeatures;
    type ConnectionPricingOverride = Spec.ConnectionPricingOverride;
    type VirtualModelDefinition = Spec.VirtualModelDefinition;
  }
}

export type TransactionDB = Parameters<Parameters<typeof db.$transaction>[0]>[0];
