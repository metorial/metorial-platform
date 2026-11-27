import { db, type SecurityReview, type SecurityReviewRevision } from '@metorial-subspace/db';

export let usageBaseRevisionStatuses = ['completed', 'completed_with_gaps'] as const;

export let subjectKeyForProviderUsage = (d: { instanceId: string; providerId: string }) =>
  `usage:${d.instanceId}:${d.providerId}`;

export let resolveUsageBaseRevision = async (d: {
  review: Pick<SecurityReview, 'tenantOid' | 'providerOid'>;
}): Promise<SecurityReviewRevision | null> => {
  if (!d.review.providerOid) return null;

  let base = await db.securityReview.findFirst({
    where: {
      providerOid: d.review.providerOid,
      subjectType: { in: ['custom_provider_version', 'slate_version'] },
      status: { in: ['active', 'outdated'] },
      OR: [{ scope: 'global' }, { scope: 'tenant', tenantOid: d.review.tenantOid }],
      currentRevision: {
        is: { mode: 'ai', status: { in: [...usageBaseRevisionStatuses] } }
      }
    },
    orderBy: { updatedAt: 'desc' },
    include: { currentRevision: true }
  });

  return base?.currentRevision?.report ? base.currentRevision : null;
};
