import { createCron } from '@metorial/cron';
import { createOrganizationActorAuditScope } from '@metorial/audit-scope';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { organizationActorService } from '@metorial/module-organization/src/services/organizationActor';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@metorial/queue';
import { notifyExpiredApiKeyAdminsQueue } from '../queues/expired/notifyExpiredApiKeyAdmins';

let expireCron = createCron(
  {
    name: 'macc/apiKey/expire',
    cron: '* * * * *'
  },
  async () => {
    let keysToExpires = await db.apiKey.findMany({
      where: {
        expiresAt: {
          lte: new Date()
        },
        status: 'active'
      }
    });
    if (keysToExpires.length === 0) return;

    await expireSingleQueue.addMany(
      keysToExpires.map(key => ({
        apiKeyId: key.id
      }))
    );
  }
);

let expireSingleQueue = createQueue<{ apiKeyId: string }>({
  name: 'macc/apiKey/expireSingle',
  workerOpts: {
    concurrency: 5
  }
});

let expireSingleQueueProcessor = expireSingleQueue.process(async data => {
  let apiKey = await db.apiKey.findUnique({
    where: {
      id: data.apiKeyId,
      status: 'active'
    },
    include: {
      machineAccess: true
    }
  });
  if (!apiKey) throw new QueueRetryError();

  let organization = apiKey.machineAccess.organizationOid
    ? await db.organization.findUniqueOrThrow({
        where: { oid: apiKey.machineAccess.organizationOid }
      })
    : null;
  let systemActor = organization
    ? await organizationActorService.getSystemActor({ organization })
    : null;

  let auditScope =
    organization && systemActor
      ? createOrganizationActorAuditScope({
          organization,
          organizationActor: systemActor,
          context: { ip: '0.0.0.0', ua: 'Metorial System' }
        })
      : null;

  if (organization && auditScope) {
    await Fabric.fire('machine_access.api_key.expired:before', {
      apiKey,
      organization,
      auditScope,
      machineAccess: apiKey.machineAccess
    });
  }

  let updatedApiKey = await db.apiKey.update({
    where: {
      id: data.apiKeyId
    },
    data: {
      status: 'expired'
    }
  });

  if (organization && auditScope) {
    await Fabric.fire('machine_access.api_key.expired:after', {
      organization,
      apiKey: updatedApiKey,
      previousApiKey: apiKey,
      auditScope,
      machineAccess: apiKey.machineAccess
    });

    await notifyExpiredApiKeyAdminsQueue.add({
      apiKeyId: updatedApiKey.id,
      organizationId: organization.id
    });
  }
});

export let expiresApiKeysProcessors = combineQueueProcessors([
  expireCron,
  expireSingleQueueProcessor
]);
