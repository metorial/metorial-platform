import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { sendConsumerInviteEmail } from '../../email/invite';
import { portalService } from '../../services/portal';

let processInviteLifecycle = async (consumerInviteId: string) => {
  let consumerInvite = await db.consumerInvite.findUnique({
    where: {
      id: consumerInviteId
    },
    include: {
      consumerProfile: true,
      invitedBy: true,
      surface: {
        include: {
          portal: true
        }
      }
    }
  });
  if (!consumerInvite) throw new QueueRetryError();

  if (
    consumerInvite.status != 'pending' ||
    !consumerInvite.surface.portal ||
    consumerInvite.surface.portal.status != 'active'
  ) {
    return;
  }

  await sendConsumerInviteEmail.send({
    data: {
      portal: consumerInvite.surface.portal,
      portalUrl: await portalService.getPrimaryPortalUrl({
        portal: consumerInvite.surface.portal
      }),
      invite: consumerInvite,
      consumerProfile: consumerInvite.consumerProfile,
      invitedBy: consumerInvite.invitedBy
    },
    to: [consumerInvite.consumerProfile.email]
  });
};

export let consumerInviteCreatedQueue = createQueue<{ consumerInviteId: string }>({
  name: 'cons/lc/invite/created'
});

export let consumerInviteCreatedQueueProcessor = consumerInviteCreatedQueue.process(
  async data => {
    await processInviteLifecycle(data.consumerInviteId);
  }
);

export let consumerInviteUpdatedQueue = createQueue<{ consumerInviteId: string }>({
  name: 'cons/lc/invite/updated'
});

export let consumerInviteUpdatedQueueProcessor = consumerInviteUpdatedQueue.process(
  async data => {
    await processInviteLifecycle(data.consumerInviteId);
  }
);
