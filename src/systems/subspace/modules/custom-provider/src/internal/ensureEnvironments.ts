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

    if (customProvider.providerOid && customProvider.providerVariantOid) {
      let customProviderEnvironments = await db.customProviderEnvironment.findMany({
        where: { customProviderOid: customProvider.oid }
      });
      let newProviderEnvironments = await db.providerEnvironment.createManyAndReturn({
        skipDuplicates: true,
        data: customProviderEnvironments.map(env => ({
          ...getId('providerEnvironment'),
          tenantOid: customProvider.tenantOid,
          solutionOid: customProvider.solutionOid,
          environmentOid: env.environmentOid,
          providerOid: customProvider.providerOid!,
          providerVariantOid: customProvider.providerVariantOid!
        }))
      });

      for (let env of newProviderEnvironments) {
        let matchingCustomEnv = customProviderEnvironments.find(
          e => e.environmentOid === env.environmentOid
        );
        if (!matchingCustomEnv) continue;

        await db.customProviderEnvironment.updateMany({
          where: { oid: matchingCustomEnv.oid },
          data: { providerEnvironmentOid: env.oid }
        });
      }
    }

    return await db.customProviderEnvironment.findMany({
      where: { customProviderOid: customProvider.oid },
      include: { environment: true }
    });
  });
};
