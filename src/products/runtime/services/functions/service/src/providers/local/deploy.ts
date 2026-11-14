import { encryption } from '../../encryption';
import { env } from '../../env';
import { storage } from '../../storage';

let ensureLocalProviderEnabled = () => {
  if (env.provider.DEFAULT_PROVIDER !== 'local') {
    throw new Error('Local Function Bay provider is disabled');
  }
};

export let deployFunction = async (d: {
  functionVersion: { id: string };
  function: { id: string };
  runtime: { identifier: string };
  runtimeConfig: { handler: string };
  env: Record<string, string>;
  zipFileUrl: string;
}) => {
  ensureLocalProviderEnabled();

  let zipFile = Buffer.from(await (await fetch(d.zipFileUrl)).arrayBuffer());
  let bucket = env.storage.BUNDLE_BUCKET_NAME;
  let storageKey = `local/provider/${d.functionVersion.id}.zip`;

  await storage.putObject(bucket, storageKey, zipFile, 'application/zip');

  return {
    providerData: {
      bucket,
      storageKey,
      handler: d.runtimeConfig.handler,
      runtimeIdentifier: d.runtime.identifier,
      encryptedEnvironmentVariables: await encryption.encrypt({
        entityId: d.functionVersion.id,
        secret: JSON.stringify(d.env)
      })
    }
  };
};

export let cloneFunctionVersion = async (d: {
  functionVersion: { id: string };
  function: { id: string };
  sourceFunctionVersion: any;
  runtime: { identifier: string };
  runtimeConfig: { handler: string };
  env: Record<string, string>;
}) => {
  ensureLocalProviderEnabled();

  return {
    providerData: {
      bucket: d.sourceFunctionVersion.functionBundle.bucket,
      storageKey: d.sourceFunctionVersion.functionBundle.storageKey,
      handler: d.runtimeConfig.handler,
      runtimeIdentifier: d.runtime.identifier,
      encryptedEnvironmentVariables: await encryption.encrypt({
        entityId: d.functionVersion.id,
        secret: JSON.stringify(d.env)
      })
    }
  };
};
