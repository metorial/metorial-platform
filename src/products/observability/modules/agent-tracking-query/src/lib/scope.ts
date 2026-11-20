import { isServiceError } from '@lowerdeck/error';
import type { Instance, Organization, Project } from '@metorial/db';
import {
  agentTrackingSyncService,
  requireAgentTracking
} from '@metorial/module-agent-tracking-sync';
import { cached, cacheKey, scopeTtlSeconds } from './cache';
import { fromService, queryCallOptions, readCallOptions } from './service';

export type ReadScope = {
  organization: Pick<Organization, 'oid' | 'id' | 'name'>;
  project: Pick<Project, 'id' | 'name'>;
  instance: Pick<Instance, 'oid' | 'id' | 'name'>;
};

// Sessions are stored under the service's own instance id, not Metorial's. The scope is only
// created when the service does not know the instance yet, so a read does not write each time.
export let resolveServiceInstanceId = async (d: ReadScope) =>
  await cached({
    key: `scope:${d.organization.id}:${d.instance.id}`,
    ttlSeconds: scopeTtlSeconds,
    load: async () => {
      let agentTracking = requireAgentTracking();

      try {
        let remote = await agentTracking.instance.get(
          { organizationId: d.organization.id, instanceId: d.instance.id },
          readCallOptions
        );

        return remote.id;
      } catch (error) {
        if (!isServiceError(error) || error.data.status != 404) throw error;
      }

      let created = await agentTrackingSyncService.upsertInstanceScope({
        organization: d.organization,
        project: d.project,
        instance: d.instance,
        callOpts: readCallOptions
      });

      return created.id;
    }
  });

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
  load: () => Promise<T>;
}) => {
  let key = await cacheKey({
    organizationId: d.scope.organization.id,
    instanceId: d.scope.instance.id,
    read: d.read,
    input: d.input
  });

  return await fromService(() => cached({ key, ttlSeconds: d.ttlSeconds, load: d.load }));
};
