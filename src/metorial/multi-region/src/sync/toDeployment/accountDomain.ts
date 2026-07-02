import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import {
  AccountDomain,
  AccountDomainVerification,
  AccountDomainVerificationStatusChange
} from '../../db';

type AccountDomainWithVerificationData = AccountDomain & {
  verifications: (AccountDomainVerification & {
    statusChanges: AccountDomainVerificationStatusChange[];
  })[];
  statusChanges: AccountDomainVerificationStatusChange[];
};

export let syncAccountDomainToDeploymentQueue = createQueue<{
  accountDomain: AccountDomainWithVerificationData;
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

    let verificationIds = accountDomain.verifications.map(verification => verification.id);
    let statusChangeIds = accountDomain.verifications.flatMap(verification =>
      verification.statusChanges.map(statusChange => statusChange.id)
    );

    await db.$transaction(async tx => {
      await tx.accountDomain.upsert({
        where: { id: accountDomain.id },
        update: {
          oid: accountDomain.oid,
          domain: accountDomain.domain,
          status: accountDomain.status,
          verificationStatus: accountDomain.verificationStatus,
          isFixedToVerified: accountDomain.isFixedToVerified,
          accountOid: localAccount.oid,
          lastCheckedAt: accountDomain.lastCheckedAt,
          lastManualCheckAt: accountDomain.lastManualCheckAt,
          createdAt: accountDomain.createdAt,
          updatedAt: accountDomain.updatedAt
        },
        create: {
          oid: accountDomain.oid,
          id: accountDomain.id,
          domain: accountDomain.domain,
          status: accountDomain.status,
          verificationStatus: accountDomain.verificationStatus,
          isFixedToVerified: accountDomain.isFixedToVerified,
          accountOid: localAccount.oid,
          lastCheckedAt: accountDomain.lastCheckedAt,
          lastManualCheckAt: accountDomain.lastManualCheckAt,
          createdAt: accountDomain.createdAt,
          updatedAt: accountDomain.updatedAt
        }
      });
    });
  });
