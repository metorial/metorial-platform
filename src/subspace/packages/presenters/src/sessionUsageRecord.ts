import type { Session, SessionUsageRecord, Tenant } from '@metorial-subspace/db';

export let sessionUsageRecordPresenter = (
  sessionUsageRecord: SessionUsageRecord & {
    session: Session;
    tenant: Tenant;
  }
) => ({
  object: 'session_usage_record',

  id: sessionUsageRecord.id,

  session: {
    id: sessionUsageRecord.session.id
  },

  tenant: {
    id: sessionUsageRecord.tenant.id
  },

  clientMessageIncrement: sessionUsageRecord.clientMessageIncrement,
  providerMessageIncrement: sessionUsageRecord.providerMessageIncrement,

  createdAt: sessionUsageRecord.createdAt
});
