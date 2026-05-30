import { generatePlainId } from '@lowerdeck/id';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../db';
import { encryption } from '../encryption';
import { env } from '../env';
import { ID, snowflake } from '../id';
import { getProvider } from '../providers';
import { storage } from '../storage';

export let enclaveOverrideCloneQueue = createQueue<{
  enclaveId: string;
  functionId: string;
  sourceFunctionVersionId: string;
}>({
  name: 'fbay/enclave/override/clone',
  redisUrl: env.service.REDIS_URL
});

export let enqueueEnclaveOverrideClone = async (data: {
  enclaveId: string;
  functionId: string;
  sourceFunctionVersionId: string;
}) => {
  await enclaveOverrideCloneQueue.add(data, {
    id: `${data.enclaveId}__${data.functionId}__${data.sourceFunctionVersionId}`
  });
};

export let processEnclaveOverrideClone = async (data: {
  enclaveId: string;
  functionId: string;
  sourceFunctionVersionId: string;
}) => {
  let existingOverride = await db.enclaveFunctionOverride.findFirst({
    where: {
      enclave: { id: data.enclaveId },
      sourceFunction: { id: data.functionId },
      sourceFunctionVersion: { id: data.sourceFunctionVersionId }
    }
  });
  if (existingOverride) return;

  let enclave = await db.enclave.findFirst({
    where: { id: data.enclaveId },
    include: { tenant: true }
  });
  if (!enclave) throw new QueueRetryError();

  let func = await db.function.findFirst({
    where: { id: data.functionId },
    include: { tenant: true }
  });
  if (!func) throw new QueueRetryError();

  let sourceVersion = await db.functionVersion.findFirst({
    where: {
      id: data.sourceFunctionVersionId,
      functionOid: func.oid
    },
    include: {
      runtime: true,
      functionBundle: true
    }
  });
  if (!sourceVersion) throw new QueueRetryError();

  if (
    sourceVersion.functionBundle.status !== 'available' ||
    !sourceVersion.functionBundle.bucket ||
    !sourceVersion.functionBundle.storageKey
  ) {
    throw new QueueRetryError();
  }

  let previousOverride = await db.enclaveFunctionOverride.findFirst({
    where: {
      enclaveOid: enclave.oid,
      sourceFunctionOid: func.oid
    },
    include: {
      overrideFunction: true
    },
    orderBy: { oid: 'desc' }
  });

  let cloneFunction =
    previousOverride?.overrideFunction ??
    (await db.function.upsert({
      where: {
        identifier_tenantOid: {
          identifier: `${func.identifier}--enclave-${enclave.id}`,
          tenantOid: enclave.tenantOid
        }
      },
      update: {
        name: func.name,
        status: 'active',
        runtimeOid: sourceVersion.runtimeOid,
        cloneOfFunctionOid: func.oid
      },
      create: {
        oid: snowflake.nextId(),
        id: await ID.generateId('function'),
        status: 'active',
        identifier: `${func.identifier}--enclave-${enclave.id}`,
        name: func.name,
        tenantOid: enclave.tenantOid,
        runtimeOid: sourceVersion.runtimeOid,
        cloneOfFunctionOid: func.oid
      }
    }));

  let cloneVersionId = await ID.generateId('functionVersion');
  let envVars = JSON.parse(
    await encryption.decrypt({
      entityId: sourceVersion.id,
      encrypted: sourceVersion.encryptedEnvironmentVariables
    })
  );
  let bundle = await storage.getObject(
    sourceVersion.functionBundle.bucket,
    sourceVersion.functionBundle.storageKey
  );

  let provider = getProvider(sourceVersion.runtime.providerOid);
  let manifest = sourceVersion.manifest;
  let runtimeConfig = manifest.runtime ?? {
    ...sourceVersion.runtime.configuration,
    handler: manifest.entrypoint ?? 'index.handler'
  };

  let res = await provider.cloneFunctionVersion({
    functionVersion: { id: cloneVersionId },
    sourceFunctionVersion: sourceVersion,
    function: cloneFunction,
    runtimeConfig,
    runtime: sourceVersion.runtime,
    env: envVars,
    zipFile: bundle.data
  });

  let encryptedEnvironmentVariables = await encryption.encrypt({
    entityId: cloneVersionId,
    secret: JSON.stringify(envVars)
  });

  let cloneVersion = await db.functionVersion.create({
    data: {
      oid: snowflake.nextId(),
      id: cloneVersionId,
      identifier: generatePlainId(12),
      name: sourceVersion.name,
      status: 'active',
      supportsV2Proxy: sourceVersion.supportsV2Proxy,
      functionOid: cloneFunction.oid,
      runtimeOid: sourceVersion.runtimeOid,
      functionBundleOid: sourceVersion.functionBundleOid,
      cloneOfFunctionVersionOid: sourceVersion.oid,
      encryptedEnvironmentVariables,
      configuration: sourceVersion.configuration,
      providerData: res.providerData,
      manifest: sourceVersion.manifest
    }
  });

  await db.function.update({
    where: { oid: cloneFunction.oid },
    data: { currentVersionOid: cloneVersion.oid }
  });

  await db.enclaveFunctionOverride.upsert({
    where: {
      enclaveOid_sourceFunctionOid_sourceFunctionVersionOid: {
        enclaveOid: enclave.oid,
        sourceFunctionOid: func.oid,
        sourceFunctionVersionOid: sourceVersion.oid
      }
    },
    update: {},
    create: {
      oid: snowflake.nextId(),
      enclaveOid: enclave.oid,
      sourceFunctionOid: func.oid,
      sourceFunctionVersionOid: sourceVersion.oid,
      overrideFunctionOid: cloneFunction.oid,
      overrideFunctionVersionOid: cloneVersion.oid
    }
  });
};

export let enclaveOverrideCloneQueueProcessor = enclaveOverrideCloneQueue.process(
  processEnclaveOverrideClone
);
