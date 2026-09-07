import type { Prisma } from '@metorial-subspace/db';

export let callbackInclude = {
  integration: true,
  integrationProvider: true,
  provider: { include: { type: true } }
} as const;

export type CallbackWithRelations = Prisma.CallbackGetPayload<{
  include: typeof callbackInclude;
}>;

export let callbackInstanceInclude = {
  callback: { include: callbackInclude },
  integrationInstance: true,
  integrationInstanceProvider: true
} as const;

export type CallbackInstanceWithRelations = Prisma.CallbackInstanceGetPayload<{
  include: typeof callbackInstanceInclude;
}>;

export let callbackEventInclude = {
  callback: { include: callbackInclude },
  callbackInstance: true
} as const;

export type CallbackEventWithRelations = Prisma.CallbackEventGetPayload<{
  include: typeof callbackEventInclude;
}>;

export let reconcileIntegrationProviderInclude = {
  integration: true,
  provider: { include: { type: true, defaultVariant: true } },
  tenant: true
} as const;

export type ReconcileIntegrationProvider = Prisma.IntegrationProviderGetPayload<{
  include: typeof reconcileIntegrationProviderInclude;
}>;

export let reconcileIntegrationInstanceProviderInclude = {
  tenant: true,
  currentVersion: {
    include: {
      config: { include: { currentVersion: true } },
      authConfig: { include: { currentVersion: true } }
    }
  }
} as const;

export type ReconcileIntegrationInstanceProvider =
  Prisma.IntegrationInstanceProviderGetPayload<{
    include: typeof reconcileIntegrationInstanceProviderInclude;
  }>;
