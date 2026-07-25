import { ensureGlobalDatabaseReady, globalDB } from './db';
import { env } from './env';

export let deploymentIdentifier = env.service.METORIAL_REGION ?? 'default';

let getSecureRandomInt = () => {
  let array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] & 0x7fffffff;
};

export let cell = ensureGlobalDatabaseReady().then(
  async () =>
    await globalDB.cell.upsert({
      where: { identifier: deploymentIdentifier },
      create: {
        identifier: deploymentIdentifier,
        oid: getSecureRandomInt(),
        endpointUrl: env.service.EXTERNAL_MULTI_REGION_ENDPOINT
      },
      update: { endpointUrl: env.service.EXTERNAL_MULTI_REGION_ENDPOINT }
    })
);
