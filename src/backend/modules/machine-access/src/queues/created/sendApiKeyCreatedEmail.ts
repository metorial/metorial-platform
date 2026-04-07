import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { sendApiKeyCreatedEmailToMemberQueue } from './sendApiKeyCreatedEmailToMember';

export let sendApiKeyCreatedEmailQueue = createQueue<{
  apiKeyId: string;
  organizationId: string;
  performedByActorId: string;
}>({
  name: 'macc/apiKey/sendCreatedEmail'
});

export let sendApiKeyCreatedEmailQueueProcessor = sendApiKeyCreatedEmailQueue.process(
  async data => {
    let apiKey = await db.apiKey.findUnique({
      where: { id: data.apiKeyId },
      include: {
        machineAccess: true
      }
    });
    if (!apiKey) throw new QueueRetryError();

    if (apiKey.kind == 'system_internal') return;

    let organization = await db.organization.findUnique({
      where: { id: data.organizationId }
    });
    if (!organization) throw new QueueRetryError();

    if (apiKey.machineAccess.organizationOid != organization.oid) return;

    let [adminMembers, creatorMember] = await Promise.all([
      db.organizationMember.findMany({
        where: {
          organizationOid: organization.oid,
          role: 'admin',
          status: 'active',
          user: {
            status: 'active'
          }
        },
        select: {
          id: true
        }
      }),
      db.organizationMember.findFirst({
        where: {
          organizationOid: organization.oid,
          status: 'active',
          actor: {
            id: data.performedByActorId
          },
          user: {
            status: 'active'
          }
        },
        select: {
          id: true
        }
      })
    ]);

    let uniqueMemberIds = new Set(adminMembers.map(member => member.id));

    if (creatorMember) {
      uniqueMemberIds.add(creatorMember.id);
    }

    if (uniqueMemberIds.size === 0) return;

    await sendApiKeyCreatedEmailToMemberQueue.addMany(
      Array.from(uniqueMemberIds).map(memberId => ({
        apiKeyId: apiKey.id,
        organizationId: organization.id,
        memberId,
        performedByActorId: data.performedByActorId
      }))
    );
  }
);
