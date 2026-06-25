import { federationDB } from '@metorial-enterprise/federation-data';
import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { User } from '../../db';

export let syncUserToDeploymentQueue = createQueue<{
  user: User;
}>({
  name: 'global/sync/to-deployment/user'
});

export let syncUserToDeploymentQueueProcessor = syncUserToDeploymentQueue.process(
  async data => {
    let currentUser = await db.user.findUnique({
      where: { id: data.user.id }
    });
    if (!currentUser) return;

    if (currentUser.updatedAt > data.user.updatedAt) return;

    let inner = {
      name: currentUser.name,
      firstName: currentUser.firstName ?? currentUser.name,
      lastName: currentUser.lastName ?? '',
      email: currentUser.email,
      image: currentUser.image
    };

    await db.user.updateMany({
      where: { id: data.user.id },
      data: inner
    });

    await federationDB.enterpriseUser.updateMany({
      where: { id: data.user.id },
      data: inner
    });
  }
);
