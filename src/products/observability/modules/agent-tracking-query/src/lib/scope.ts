import type { Instance, Organization, Project } from '@metorial/db';
import { requireAgentTracking, withInstanceScope } from '@metorial/module-agent-tracking-sync';
import { cached, cacheKey } from './cache';
import { fromService, queryCallOptions, readCallOptions } from './service';

export type ReadScope = {
  organization: Pick<Organization, 'oid' | 'id' | 'name'>;
  project: Pick<Project, 'oid' | 'id' | 'name'>;
  instance: Pick<Instance, 'oid' | 'id' | 'name'>;
};

export let runUsageQuery = (
  scope: Pick<ReadScope, 'organization'>,
  instanceId: string,
  query: Record<string, unknown>
) =>
  requireAgentTracking().query.run(
    { organizationId: scope.organization.id, scope: { instanceIds: [instanceId] }, query },
    queryCallOptions
  );

export let cachedRead = async <T>(d: {
  scope: ReadScope;
  read: string;
  input?: unknown;
  ttlSeconds?: number;
  load: (serviceInstanceId: string) => Promise<T>;
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
