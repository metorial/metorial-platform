import { db } from '../db';
import { env } from '../env';
import { localProvider } from '../providers/local';

export let ensureRehomed = async <V extends { id: string; runtime: { providerOid: bigint } }>(
  version: V
): Promise<V> => {
  if (
    env.provider.DEFAULT_PROVIDER !== 'knative' ||
    version.runtime.providerOid !== localProvider.provider.oid
  ) {
    return version;
  }

  let { rehomeLocalFunctionVersion } = await import('../providers/knative/rehome');
  await rehomeLocalFunctionVersion(version.id);

  let rehomed = await db.functionVersion.findUniqueOrThrow({
    where: { id: version.id },
    include: { runtime: true }
  });

  return { ...version, ...rehomed };
};
