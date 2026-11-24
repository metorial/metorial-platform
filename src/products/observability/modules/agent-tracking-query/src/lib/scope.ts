import type { Instance, Organization, Project } from '@metorial/db';
import { requireAgentTracking, withInstanceScope } from '@metorial/module-agent-tracking-sync';
import { cached, cacheKey } from './cache';
import { fromService, queryCallOptions, readCallOptions } from './service';
import type { Cells } from './spend';

// The service runs at most 4 queries per organization at once; one read leaves room for others.
let readQueryConcurrency = 3;

export type ReadScope = {
  organization: Pick<Organization, 'oid' | 'id' | 'name'>;
  project: Pick<Project, 'oid' | 'id' | 'name'>;
  instance: Pick<Instance, 'oid' | 'id' | 'name'>;
};

export type UsageResult = {
  rows: Cells[];
  totals?: Cells | null;
  labels?: Record<string, unknown>;
  meta?: { truncated?: boolean; warnings?: { code?: string }[] };
};

export let warned = (result: UsageResult | null, code: string) =>
  (result?.meta?.warnings ?? []).some(warning => warning.code == code);

export let runUsageQuery = (
  scope: Pick<ReadScope, 'organization' | 'instance'>,
  query: Record<string, unknown>
) =>
  requireAgentTracking().query.run(
    {
      organizationId: scope.organization.id,
      scope: { instanceIds: [scope.instance.id] },
      query
    },
    queryCallOptions
  );

export let runUsageQueries = async (
  scope: Pick<ReadScope, 'organization' | 'instance'>,
  queries: (Record<string, unknown> | null)[]
) => {
  let results: (UsageResult | null)[] = queries.map(() => null);
  let planned = queries.flatMap((query, index) => (query ? [index] : []));
  let errors: unknown[] = [];
  let next = 0;

  let worker = async () => {
    while (!errors.length && next < planned.length) {
      let index = planned[next++]!;
      try {
        results[index] = await fromService(() => runUsageQuery(scope, queries[index]!));
      } catch (error) {
        errors.push(error);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(readQueryConcurrency, planned.length) }, worker)
  );
  if (errors.length) throw errors[0];

  return results;
};

export let cachedRead = async <T>(d: {
  scope: ReadScope;
  read: string;
  input?: unknown;
  ttlSeconds?: number;
  load: () => Promise<T>;
}) => {
  let key = await cacheKey({
    organizationId: d.scope.organization.id,
    instanceId: d.scope.instance.id,
    read: d.read,
    input: d.input
  });

  return await fromService(() =>
    cached({
      key,
      ttlSeconds: d.ttlSeconds,
      load: () =>
        withInstanceScope(
          {
            organization: d.scope.organization,
            project: d.scope.project,
            instance: d.scope.instance,
            callOpts: readCallOptions
          },
          d.load
        )
    })
  );
};
