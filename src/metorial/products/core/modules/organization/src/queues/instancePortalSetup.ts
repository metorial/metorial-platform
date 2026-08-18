import { Context } from '@metorial/context';
import { db } from '@metorial/db';
import { portalService } from '@metorial/module-portal';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let instancePortalSetupQueue = createQueue<{ instance: string; context: Context }>({
  name: 'org/instancePortalSetup'
});

export let instancePortalSetupQueueProcessor = instancePortalSetupQueue.process(async data => {
  let instance = await db.instance.findUnique({
    where: { id: data.instance },
    include: { organization: true, project: true }
  });
  if (!instance) throw new QueueRetryError();

  await portalService.createPortal({
    organization: instance.organization,
    instance: instance,
    context: data.context,
    isDefaultPortal: true,
    input: {
      name:
        instance.type === 'development'
          ? `${instance.project.name} - ${instance.name}`
          : instance.project.name
    }
  });
});
