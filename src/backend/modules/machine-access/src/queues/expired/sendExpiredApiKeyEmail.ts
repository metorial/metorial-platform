import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { apiKeyExpiredEmail } from '../../email/apiKeyExpired';

export let sendExpiredApiKeyEmailQueue = createQueue<{
  apiKeyId: string;
  organizationId: string;
  memberId: string;
}>({
  name: 'macc/apiKey/sendExpiredEmail',
  workerOpts: {
    concurrency: 10
  }
});

export let sendExpiredApiKeyEmailQueueProcessor = sendExpiredApiKeyEmailQueue.process(
  async data => {
    let [apiKey, organization, member] = await Promise.all([
      db.apiKey.findUnique({
        where: { id: data.apiKeyId }
      }),
      db.organization.findUnique({
        where: { id: data.organizationId }
      }),
      db.organizationMember.findFirst({
        where: {
          id: data.memberId,
          status: 'active',
          organization: {
            id: data.organizationId
          }
        },
        include: {
          user: true
        }
      })
    ]);

    if (!apiKey || !organization) throw new QueueRetryError();

    if (!member) return;
    if (apiKey.status != 'expired' || apiKey.machineAccessOid == null) return;
    if (member.role != 'admin' || member.user.status != 'active') return;

    let existingSend = await db.apiKeyExpiredEmailSend.findFirst({
      where: {
        apiKeyOid: apiKey.oid,
        memberOid: member.oid
      }
    });
    if (existingSend) return;

    await apiKeyExpiredEmail.send({
      to: [member.user.email],
      data: {
        apiKey,
        organization,
        user: member.user
      }
    });

    await db.apiKeyExpiredEmailSend.create({
      data: {
        apiKeyOid: apiKey.oid,
        organizationOid: organization.oid,
        memberOid: member.oid,
        userOid: member.user.oid,
        email: member.user.email
      }
    });
  }
);
