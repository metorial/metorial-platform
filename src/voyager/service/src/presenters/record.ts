import type { Record } from '../../prisma/generated/client';

export let recordPresenter = (record: Record) => ({
  object: 'voyager#record',

  id: record.id,

  documentId: record.documentId,
  fields: record.fields,
  body: record.body,
  metadata: record.metadata,

  hash: record.hash,

  isTenantSpecific: record.isTenantSpecific,

  createdAt: record.createdAt
});
