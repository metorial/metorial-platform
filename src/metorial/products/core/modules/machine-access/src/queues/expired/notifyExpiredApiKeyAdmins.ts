import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { sendExpiredApiKeyEmailQueue } from './sendExpiredApiKeyEmail';

export let notifyExpiredApiKeyAdminsQueue = createQueue<{
  apiKeyId: string;
  organizationId: string;
}>({
  name: 'macc/apiKey/notifyExpiredAdmins'
});

export let notifyExpiredApiKeyAdminsQueueProcessor = notifyExpiredApiKeyAdminsQueue.process(
  async data => {
    let apiKey = await db.apiKey.findUnique({
      where: { id: data.apiKeyId },
      include: {
        machineAccess: true
      }
    });
    if (!apiKey) throw new QueueRetryError();

    let organization = await db.organization.findUnique({
      where: { id: data.organizationId }
    });
    if (!organization) throw new QueueRetryError();

    if (apiKey.status != 'expired' || apiKey.machineAccess.organizationOid != organization.oid)
      return;

    let members = await db.organizationMember.findMany({
      where: {
        organizationOid: organization.oid,
        role: 'admin',
        status: 'active',
        user: {
          status: 'active',
          type: 'user'
        }
      },
      select: {
        id: true
      }
    });

    if (members.length === 0) return;

    await sendExpiredApiKeyEmailQueue.addMany(
      members.map(member => ({
        apiKeyId: apiKey.id,
        organizationId: organization.id,
        memberId: member.id
      }))
    );
  }
);
