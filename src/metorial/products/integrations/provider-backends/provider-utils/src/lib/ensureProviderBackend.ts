import { dbPrimary, getId, type BackendType } from '@metorial-subspace/db';

export let ensureProviderBackend = async (d: {
  type: BackendType;
  name: string;
  identifier: string;
}) => {
  await dbPrimary.backend.createMany({
    data: { ...getId('backend'), ...d },
    skipDuplicates: true
  });

  return await dbPrimary.backend.findUniqueOrThrow({ where: { type: d.type } });
};
