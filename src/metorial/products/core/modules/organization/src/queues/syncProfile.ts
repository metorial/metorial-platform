import { db } from '@metorial/db';
import { profileService } from '@metorial/module-community';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let syncProfileQueue = createQueue<{ organizationId: string }>({
  name: 'org/sncProf'
});

export let syncProfileQueueProcessor = syncProfileQueue.process(async data => {
  let org = await db.organization.findUnique({
    where: { id: data.organizationId }
  });
  if (!org) throw new QueueRetryError();

  await profileService.syncProfile({
    for: {
      type: 'organization',
      organization: org
    }
  });
});
