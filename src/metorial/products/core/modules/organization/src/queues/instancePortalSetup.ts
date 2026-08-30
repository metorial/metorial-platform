import { createSystemAuditScope } from '@metorial/audit-scope';
import { Context } from '@metorial/context';
import { db } from '@metorial/db';
import { portalService } from '@metorial/module-portal';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let instancePortalSetupQueue = createQueue<{ instanceId: string; context: Context }>({
  name: 'org/instancePortalSetup'
});

export let instancePortalSetupQueueProcessor = instancePortalSetupQueue.process(async data => {
  let instance = await db.instance.findUnique({
    where: { id: data.instanceId },
    include: { organization: true, project: true }
  });
  if (!instance) throw new QueueRetryError();

  let existingPortal = await db.portal.findFirst({
    where: { instanceOid: instance.oid }
  });
  if (existingPortal) return;

  await portalService.createPortal({
    organization: instance.organization,
    instance: instance,
    context: data.context,
    auditScope: createSystemAuditScope({
      organization: instance.organization,
      instance,
      job: 'organization/instancePortalSetup',
      context: data.context
    }),
    isDefaultPortal: true,
    input: {
      name:
        instance.type === 'development'
          ? `${instance.project.name} - ${instance.name}`
          : instance.project.name
    }
  });
});
