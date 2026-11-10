import { createSystemAuditScope } from '@metorial/audit-scope';
import { addAfterTransactionHook, db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue } from '@metorial/queue';
import { magicMcpTokenService } from '../../services/magicMcpToken';

let pageSize = 500;

export let consumerProfileDeletedMagicMcpTokensQueue = createQueue<{
  consumerProfileId: string;
  cursor?: string;
}>({
  name: 'mgc/lc/token/profile-deleted',
  workerOpts: { concurrency: 1 }
});

export let consumerProfileDeletedMagicMcpTokensQueueProcessor =
  consumerProfileDeletedMagicMcpTokensQueue.process(async data => {
    let profile = await db.consumerProfile.findUnique({
      where: { id: data.consumerProfileId },
      select: { oid: true, status: true, organizationOid: true, instanceOid: true }
    });
    if (!profile || profile.status != 'deleted') return;

    let tokens = await db.magicMcpToken.findMany({
      where: {
        status: 'active',
        AND: [
          { consumerTokens: { some: { consumerProfileOid: profile.oid } } },
          {
            consumerTokens: {
              none: {
                consumerProfileOid: { not: profile.oid },
                consumerProfile: { status: 'active' }
              }
            }
          }
        ],
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: pageSize
    });

    let auditScope = createSystemAuditScope({
      organization: { oid: profile.organizationOid },
      instance: { oid: profile.instanceOid },
      job: 'magicMcp/consumerProfileDeleted'
    });

    for (let token of tokens) {
      await magicMcpTokenService.deleteMagicMcpToken({ token, auditScope });
    }

    if (tokens.length == pageSize) {
      await consumerProfileDeletedMagicMcpTokensQueue.add(
        { ...data, cursor: tokens[tokens.length - 1]!.id },
        { delay: 1000 }
      );
    }
  });

Fabric.listen('consumer.profile.deleted:after', async event => {
  await addAfterTransactionHook(() =>
    consumerProfileDeletedMagicMcpTokensQueue.add({
      consumerProfileId: event.consumerProfile.id
    })
  );
});
