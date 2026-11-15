import { db } from '../../db';
import { encryption } from '../../encryption';
import { decryptFunctionVersionEnvironmentVariables } from '../../lib/decryptFunctionVersionEnvironmentVariables';
import { dropReservedEnv } from '../../lib/reservedEnv';
import { getRuntime } from './runtime';
import { createKnativeProviderData, entrypointFromHandler, importBundle } from './spec';

type LocalProviderData = {
  bucket: string;
  storageKey: string;
  handler: string;
  runtimeIdentifier: string;
  encryptedEnvironmentVariables: string;
};

let appendDeploymentLog = async (functionVersionOid: bigint, message: string) => {
  let step = await db.functionDeploymentStep.findFirst({
    where: { type: 'deploy', functionDeployment: { functionVersionOid } },
    orderBy: { oid: 'desc' }
  });
  if (!step) return;

  await db.functionDeploymentStep.update({
    where: { oid: step.oid },
    data: { output: `${step.output}\n${JSON.stringify([Date.now(), message])}` }
  });
};

export let rehomeLocalFunctionVersion = async (functionVersionId: string) => {
  let version = await db.functionVersion.findUnique({
    where: { id: functionVersionId },
    include: { runtime: { include: { provider: true } } }
  });
  if (!version || version.runtime.provider.identifier !== 'local') return;

  let localData = version.providerData as unknown as LocalProviderData;
  let { env, dropped } = dropReservedEnv(
    await decryptFunctionVersionEnvironmentVariables({
      functionVersion: version,
      encryptedEnvironmentVariables: localData.encryptedEnvironmentVariables
    })
  );

  let runtime = await getRuntime(version.runtime.configuration.runtime);
  let bundle = await importBundle({
    functionVersion: version,
    source: { bucket: localData.bucket, key: localData.storageKey }
  });
  let providerData = await createKnativeProviderData({
    functionVersion: version,
    bundle,
    entrypoint: entrypointFromHandler(localData.handler, 'enveloped'),
    runtime: runtime.runtime,
    env
  });

  if (dropped.length) {
    let message = `Warning: removed reserved environment variables while moving to Kubernetes: ${dropped.join(', ')}`;
    console.warn(message, { functionVersionId: version.id });
    await appendDeploymentLog(version.oid, message);
  }

  await db.functionVersion.update({
    where: { oid: version.oid },
    data: {
      runtimeOid: runtime.runtime.oid,
      providerData,
      ...(dropped.length
        ? {
            encryptedEnvironmentVariables: await encryption.encrypt({
              entityId: version.id,
              secret: JSON.stringify(env)
            })
          }
        : {})
    }
  });
};
