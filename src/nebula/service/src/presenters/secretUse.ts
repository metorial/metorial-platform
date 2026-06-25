import type { SecretUse } from '../../prisma/generated/client';

export let secretUseRecordPresenter = (use: SecretUse) => ({
  object: 'nebula#secret_use_record',
  note: use.note,
  ts: use.ts
});
