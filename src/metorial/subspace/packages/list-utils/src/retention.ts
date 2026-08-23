import type { DateFilter } from './dateFilter';
import { normalizeDateFilter } from './dateFilter';

export type LogRetentionTenant = {
  logRetentionInDays: number;
  enforceSessionExpiry?: boolean;
};

export let getRetentionCutoffDate = (logRetentionInDays: number) => {
  let cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - Math.max(logRetentionInDays, 0));
  return cutoffDate;
};

export let mergeRetentionWithDateFilter = (
  tenant: Pick<LogRetentionTenant, 'logRetentionInDays'>,
  filter?: DateFilter
) => {
  let floor = getRetentionCutoffDate(tenant.logRetentionInDays);
  let normalized = normalizeDateFilter(filter);

  if (!normalized) {
    return { createdAt: { gte: floor } };
  }

  return {
    createdAt: {
      ...(normalized.lt ? { lt: normalized.lt } : {}),
      gte: normalized.gt && normalized.gt > floor ? normalized.gt : floor
    }
  };
};

export let getSessionRetentionFilter = (
  tenant: LogRetentionTenant,
  dateFilter?: DateFilter
) => {
  if (!tenant.enforceSessionExpiry) return undefined;

  return mergeRetentionWithDateFilter(tenant, dateFilter);
};

export let getConnectionRetentionWhere = (d: { cutoff: Date; beforeCutoff: boolean }) => {
  if (d.beforeCutoff) {
    return {
      OR: [
        { lastActiveAt: { lt: d.cutoff } },
        { lastActiveAt: null, createdAt: { lt: d.cutoff } }
      ]
    };
  }

  return {
    OR: [
      { lastActiveAt: { gte: d.cutoff } },
      { lastActiveAt: null, createdAt: { gte: d.cutoff } }
    ]
  };
};

export let getConnectionRetentionFilter = (tenant: Pick<LogRetentionTenant, 'logRetentionInDays'>) =>
  getConnectionRetentionWhere({
    cutoff: getRetentionCutoffDate(tenant.logRetentionInDays),
    beforeCutoff: false
  });
