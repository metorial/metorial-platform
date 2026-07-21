import type {
  DashboardInstanceSkillsSyncsGetOutput,
  DashboardInstanceSkillsSyncsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { useEffect, useRef } from 'react';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type SkillSync = DashboardInstanceSkillsSyncsGetOutput;

let toArrayIfString = <T extends string>(value: T | T[] | undefined) =>
  typeof value === 'string' ? [value] : value;

let normalizeSkillSyncsListQuery = (
  query: DashboardInstanceSkillsSyncsListQuery
): DashboardInstanceSkillsSyncsListQuery => ({
  ...query,
  id: toArrayIfString(query.id),
  skillMarketplaceId: toArrayIfString(query.skillMarketplaceId),
  skillPluginId: toArrayIfString(query.skillPluginId),
  status: toArrayIfString(query.status as any) as any
});

export let skillSyncsLoader = createLoader({
  name: 'skillSyncs',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSkillsSyncsListQuery) =>
    withAuth(sdk => sdk.skillSyncs.list(i.instanceId, normalizeSkillSyncsListQuery(i))),
  mutators: {}
});

export let useSkillSyncs = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSkillsSyncsListQuery | null
) => {
  let data = usePaginator(
    pagination =>
      skillSyncsLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    instanceId ? `${instanceId}:skillSyncs:${JSON.stringify(query ?? {})}` : null
  );

  let hasActiveSyncs = data.data?.items.some(sync =>
    ['pending', 'processing', 'waiting_for_review'].includes(sync.status)
  );
  let refetchRef = useRef(data.refetch);
  refetchRef.current = data.refetch;
  useEffect(() => {
    if (!hasActiveSyncs) return;
    let id = setInterval(() => refetchRef.current(), 3000);
    return () => clearInterval(id);
  }, [hasActiveSyncs]);

  return data;
};

export let skillSyncLoader = createLoader({
  name: 'skillSync',
  parents: [skillSyncsLoader],
  fetch: (i: { instanceId: string; skillSyncId: string }) =>
    withAuth(sdk => sdk.skillSyncs.get(i.instanceId, i.skillSyncId)),
  mutators: {}
});

export let useSkillSync = (
  instanceId: string | null | undefined,
  skillSyncId: string | null | undefined
) => {
  let data = skillSyncLoader.use(
    instanceId && skillSyncId ? { instanceId, skillSyncId } : null
  );

  let isActive = data.data?.status
    ? ['pending', 'processing', 'waiting_for_review'].includes(data.data.status)
    : false;
  let refetchRef = useRef(data.refetch);
  refetchRef.current = data.refetch;
  useEffect(() => {
    if (!isActive) return;
    let id = setInterval(() => refetchRef.current(), 3000);
    return () => clearInterval(id);
  }, [isActive]);

  return data;
};

export let skillSyncRepositoryChecksLoader = createLoader({
  name: 'skillSyncRepositoryChecks',
  parents: [skillSyncLoader],
  fetch: (i: { instanceId: string; skillSyncId: string }) =>
    withAuth(sdk => sdk.skillSyncs.repositoryChecks(i.instanceId, i.skillSyncId)),
  mutators: {}
});

export let useSkillSyncRepositoryChecks = (
  instanceId: string | null | undefined,
  skillSyncId: string | null | undefined
) =>
  skillSyncRepositoryChecksLoader.use(
    instanceId && skillSyncId ? { instanceId, skillSyncId } : null
  );
