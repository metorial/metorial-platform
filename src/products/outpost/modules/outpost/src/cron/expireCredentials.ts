import { createOrganizationActorAuditScope } from '@metorial/audit-scope';
import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { organizationActorService } from '@metorial/module-organization/src/services/organizationActor';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@metorial/queue';

let expireCron = createCron(
  { name: 'outp/credential/expire', cron: '* * * * *' },
  async () => {
    let credentialsToExpire = await db.outpostCredential.findMany({
      where: { expiresAt: { lte: new Date() }, status: 'active' }
    });
    if (credentialsToExpire.length === 0) return;

    await expireSingleQueue.addMany(
      credentialsToExpire.map(credential => ({ outpostCredentialId: credential.id }))
    );
  }
);

let expireSingleQueue = createQueue<{ outpostCredentialId: string }>({
  name: 'outp/credential/expireSingle',
  workerOpts: { concurrency: 5 }
});

let expireSingleQueueProcessor = expireSingleQueue.process(async data => {
  let credential = await db.outpostCredential.findUnique({
    where: { id: data.outpostCredentialId, status: 'active' },
    include: { outpost: true }
  });
  if (!credential) throw new QueueRetryError();

  let organization = await db.organization.findUniqueOrThrow({
    where: { oid: credential.outpost.organizationOid }
  });
  let systemActor = await organizationActorService.getSystemActor({ organization });
  let auditScope = createOrganizationActorAuditScope({
    organization,
    organizationActor: systemActor,
    context: { ip: '0.0.0.0', ua: 'Metorial System' }
  });

  await Fabric.fire('outpost_credential.expired:before', {
    credential,
    outpost: credential.outpost,
    organization,
    auditScope
  });

  let updatedCredential = await db.outpostCredential.update({
    where: { id: data.outpostCredentialId },
    data: { status: 'expired' }
  });

  await Fabric.fire('outpost_credential.expired:after', {
    credential: updatedCredential,
    previousCredential: credential,
    outpost: credential.outpost,
    organization,
    auditScope
  });
});

export let expireOutpostCredentialsProcessors = combineQueueProcessors([
  expireCron,
  expireSingleQueueProcessor
]);
