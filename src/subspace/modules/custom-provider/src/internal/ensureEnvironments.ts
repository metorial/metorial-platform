import { type CustomProvider, getId, withTransaction } from '@metorial-subspace/db';

export let ensureEnvironments = async (
  d: { customProvider: CustomProvider } | { customProviderOid: bigint }
) => {
  return await withTransaction(async db => {
    let oid = 'customProvider' in d ? d.customProvider.oid : d.customProviderOid;
    let customProvider = await db.customProvider.findUniqueOrThrow({
      where: { oid }
    });

    let environments = await db.environment.findMany({
      where: { tenantOid: customProvider.tenantOid }
    });
    await db.customProviderEnvironment.createMany({
      skipDuplicates: true,
      data: environments.map(env => ({
        ...getId('customProviderEnvironment'),
        tenantOid: customProvider.tenantOid,
        solutionOid: customProvider.solutionOid,
        environmentOid: env.oid,
        customProviderOid: customProvider.oid
      }))
    });

    return await db.customProviderEnvironment.findMany({
      where: { customProviderOid: customProvider.oid },
      include: { environment: true }
    });
  });
};
