import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { AccountDomain } from '../../db';

export let syncAccountDomainToDeploymentQueue = createQueue<{
  accountDomain: AccountDomain;
}>({
  name: 'global/sync/to-deployment/account-domain'
});

export let syncAccountDomainToDeploymentQueueProcessor =
  syncAccountDomainToDeploymentQueue.process(async data => {
    let accountDomain = data.accountDomain;

    let localAccount = await db.account.findUnique({
      where: { id: accountDomain.accountId }
    });
    if (!localAccount) return;

    await db.$transaction(async tx => {
      await tx.accountDomain.upsert({
        where: { id: accountDomain.id },
        update: {
          oid: accountDomain.oid,
          domain: accountDomain.domain,
          status: accountDomain.status,
          verificationStatus: accountDomain.verificationStatus,
          isFixedToVerified: false,
          accountOid: localAccount.oid,
          lastCheckedAt: null,
          lastManualCheckAt: null,
          createdAt: accountDomain.createdAt,
          updatedAt: accountDomain.updatedAt
        },
        create: {
          oid: accountDomain.oid,
          id: accountDomain.id,
          domain: accountDomain.domain,
          status: accountDomain.status,
          verificationStatus: accountDomain.verificationStatus,
          isFixedToVerified: false,
          accountOid: localAccount.oid,
          lastCheckedAt: null,
          lastManualCheckAt: null,
          createdAt: accountDomain.createdAt,
          updatedAt: accountDomain.updatedAt
        }
      });
    });
  });
