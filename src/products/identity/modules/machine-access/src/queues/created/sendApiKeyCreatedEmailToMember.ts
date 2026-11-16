import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { apiKeyCreatedEmail } from '../../email/apiKeyCreated';

export let sendApiKeyCreatedEmailToMemberQueue = createQueue<{
  apiKeyId: string;
  organizationId: string;
  memberId: string;
  performedByActorId: string;
}>({
  name: 'macc/apiKey/sendCreatedEmailToMember',
  workerOpts: {
    concurrency: 10
  }
});

export let sendApiKeyCreatedEmailToMemberQueueProcessor =
  sendApiKeyCreatedEmailToMemberQueue.process(async data => {
    let [apiKey, organization, member, createdBy] = await Promise.all([
      db.apiKey.findUnique({
        where: { id: data.apiKeyId },
        include: {
          machineAccess: true
        }
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
          },
          user: {
            status: 'active'
          }
        },
        include: {
          user: true
        }
      }),
      db.organizationActor.findUnique({
        where: { id: data.performedByActorId }
      })
    ]);

    if (!apiKey || !organization || !createdBy) throw new QueueRetryError();

    if (!member) return;
    if (apiKey.machineAccess.organizationOid != organization.oid) return;
    if (
      member.role != 'admin' ||
      member.user.status != 'active' ||
      member.user.type === 'system'
    )
      return;

    let existingSend = await db.apiKeyCreatedEmailSend.findFirst({
      where: {
        apiKeyOid: apiKey.oid,
        memberOid: member.oid
      }
    });
    if (existingSend) return;

    await apiKeyCreatedEmail.send({
      to: [member.user.email],
      data: {
        apiKey,
        organization,
        user: member.user,
        createdBy
      }
    });

    await db.apiKeyCreatedEmailSend.create({
      data: {
        apiKeyOid: apiKey.oid,
        organizationOid: organization.oid,
        memberOid: member.oid,
        userOid: member.user.oid,
        email: member.user.email
      }
    });
  });
