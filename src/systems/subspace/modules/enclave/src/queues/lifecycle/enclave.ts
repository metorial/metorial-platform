import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, Prisma } from '@metorial-subspace/db';
import { providerTypeService } from '@metorial-subspace/module-catalog';
import { env } from '../../env';
import { functionBay, getTenantForFunctionBay } from '../../functionBay';

export let enclaveCreatedQueue = createQueue<{ enclaveId: string }>({
  name: 'sub/enc/lc/enclave/created',
  redisUrl: env.service.REDIS_URL
});

export let enclaveCreatedQueueProcessor = enclaveCreatedQueue.process(async data => {
  let enclave = await db.enclave.findFirst({
    where: { id: data.enclaveId },
    include: { providerDeployment: { include: { provider: true } }, tenant: true }
  });
  if (!enclave) throw new QueueRetryError();

  let type = await providerTypeService.getProviderTypeByOid({
    providerTypeOid: enclave.providerDeployment.provider.typeOid
  });

  if (type.attributes.backend === 'slates') {
    let fbTenant = await getTenantForFunctionBay(enclave.tenant);

    await functionBay.enclave.upsert({
      tenantId: fbTenant.id,
      identifier: enclave.id,
      name: enclave.name,
      id: enclave.id
    });
  }
});

export let enclaveUpdatedQueue = createQueue<{ enclaveId: string }>({
  name: 'sub/enc/lc/enclave/updated',
  redisUrl: env.service.REDIS_URL
});

export let enclaveUpdatedQueueProcessor = enclaveUpdatedQueue.process(async data => {
  await db.enclave.updateMany({
    where: { id: data.enclaveId },
    data: { compiledNetworkRules: Prisma.JsonNull }
  });
});
