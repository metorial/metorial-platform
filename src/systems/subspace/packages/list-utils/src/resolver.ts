import { startOfDay, subDays } from 'date-fns';
import type { TenantSelector, TenantSelectorOptional } from './tenant';

let getSelectors = (oids: bigint[]) => ({
  oids,
  in: { in: oids },
  oidIn: { oid: { in: oids } }
});

export let createResolver =
  <R extends { oid: bigint }>(
    cb: (d: {
      selector: TenantSelector;
      ts: { tenantOid: bigint; solutionOid: number; environmentOid: bigint };
      onlyLogsAfter: Date;
      ids: string[];
    }) => Promise<R[]>
  ) =>
  async (selector: TenantSelector, ids: string[] | undefined | null) => {
    if (!ids) return undefined;

    // Short circuit empty ids
    if (ids.length === 0) return getSelectors([]);

    let res = await cb({
      ids,
      selector,
      onlyLogsAfter: startOfDay(subDays(new Date(), selector.tenant.logRetentionInDays)),
      ts: {
        tenantOid: selector.tenant.oid,
        solutionOid: selector.solution.oid,
        environmentOid: selector.environment.oid
      }
    });

    return getSelectors(res.map(r => r.oid));
  };

export let createOptionalResolver =
  <R extends { oid: bigint }>(
    cb: (d: {
      selector: TenantSelectorOptional;
      ts: { solutionOid: number; tenantOid?: bigint; environmentOid?: bigint };
      ids: string[];
    }) => Promise<R[]>
  ) =>
  async (selector: TenantSelectorOptional, ids: string[] | undefined | null) => {
    if (!ids) return undefined;

    // Short circuit empty ids
    if (ids.length === 0) return getSelectors([]);

    let res = await cb({
      ids,
      selector,
      ts: {
        solutionOid: selector.solution.oid,
        tenantOid: selector.tenant?.oid,
        environmentOid: selector.environment?.oid
      }
    });

    return getSelectors(res.map(r => r.oid));
  };

export let createPublicResolver =
  <R extends { oid: bigint }>(cb: (d: { ids: string[] }) => Promise<R[]>) =>
  async (ids: string[] | undefined | null) => {
    if (!ids) return undefined;

    // Short circuit empty ids
    if (ids.length === 0) return getSelectors([]);

    let res = await cb({ ids });

    return getSelectors(res.map(r => r.oid));
  };
