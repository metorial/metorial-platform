import { db, getId, type BackendType } from '@metorial-subspace/db';

export let ensureProviderBackend = async (d: {
  type: BackendType;
  name: string;
  identifier: string;
}) => {
  await db.backend.createMany({
    data: { ...getId('backend'), ...d },
    skipDuplicates: true
  });

  return await db.backend.findUniqueOrThrow({ where: { type: d.type } });
};
