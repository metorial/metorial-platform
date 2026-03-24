import type { ProviderRun, ProviderRunUsageRecord, Tenant } from '@metorial-subspace/db';

export let providerRunUsageRecordPresenter = (
  providerRunUsageRecord: ProviderRunUsageRecord & {
    providerRun: ProviderRun;
    tenant: Tenant;
  }
) => ({
  object: 'provider_run_usage_record',

  id: providerRunUsageRecord.id,

  providerRun: {
    id: providerRunUsageRecord.providerRun.id,
    oid: providerRunUsageRecord.providerRun.oid
  },

  tenant: {
    id: providerRunUsageRecord.tenant.id
  },

  createdAt: providerRunUsageRecord.createdAt
});
