import type { Tenant } from '../../prisma/generated/client';

export let tenantPresenter = (tenant: Tenant) => ({
  object: 'groundstation#tenant',

  id: tenant.id,
  ref: tenant.ref,

  skewBoundSeconds: tenant.skewBoundSeconds,
  backfillMaxAgeDays: tenant.backfillMaxAgeDays,
  hashKeyVersion: tenant.hashKeyVersion,

  recordRetentionDays: tenant.recordRetentionDays,
  contentRetentionDays: tenant.contentRetentionDays,

  createdAt: tenant.createdAt,
  updatedAt: tenant.updatedAt
});
