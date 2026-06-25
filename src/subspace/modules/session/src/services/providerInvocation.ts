import { Service } from '@lowerdeck/service';
import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import {
  parseProviderInvocationId,
  type ProviderInvocation
} from '@metorial-subspace/provider-utils';

let mergeInvocation = (
  map: Map<string, ProviderInvocation>,
  invocation: ProviderInvocation
) => {
  let existing = map.get(invocation.id);
  if (!existing) {
    map.set(invocation.id, invocation);
    return;
  }

  existing.providerRunIds = Array.from(
    new Set([...existing.providerRunIds, ...invocation.providerRunIds])
  );
  existing.sessionMessageIds = Array.from(
    new Set([...existing.sessionMessageIds, ...invocation.sessionMessageIds])
  );
  existing.authConfigEventIds = Array.from(
    new Set([...existing.authConfigEventIds, ...invocation.authConfigEventIds])
  );
  existing.providerOAuthSetupIds = Array.from(
    new Set([...existing.providerOAuthSetupIds, ...invocation.providerOAuthSetupIds])
  );
};

class providerInvocationServiceImpl {
  async listProviderInvocations(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    inputs: {
      providerRunIds?: string[];
      sessionMessageIds?: string[];
      callbackEventSourceIds?: string[];
      authConfigEventIds?: string[];
    };
  }) {
    let buckets = new Map<
      bigint,
      {
        providerRunIds: string[];
        sessionMessageIds: string[];
        callbackEventSourceIds: string[];
        authConfigEventIds: string[];
      }
    >();

    let ensureBucket = (backendOid: bigint) => {
      let bucket = buckets.get(backendOid);
      if (!bucket) {
        bucket = {
          providerRunIds: [],
          sessionMessageIds: [],
          callbackEventSourceIds: [],
          authConfigEventIds: []
        };
        buckets.set(backendOid, bucket);
      }

      return bucket;
    };

    if (d.inputs.providerRunIds?.length) {
      let providerRuns = await db.providerRun.findMany({
        where: {
          id: { in: d.inputs.providerRunIds },
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        include: {
          providerVersion: true
        }
      });

      for (let providerRun of providerRuns) {
        ensureBucket(providerRun.providerVersion.backendOid).providerRunIds.push(
          providerRun.id
        );
      }
    }

    if (d.inputs.sessionMessageIds?.length) {
      let sessionMessages = await db.sessionMessage.findMany({
        where: {
          id: { in: d.inputs.sessionMessageIds },
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          providerRunOid: { not: null }
        },
        include: {
          providerRun: {
            include: {
              providerVersion: true
            }
          }
        }
      });

      for (let sessionMessage of sessionMessages) {
        if (!sessionMessage.providerRun) continue;

        ensureBucket(
          sessionMessage.providerRun.providerVersion.backendOid
        ).sessionMessageIds.push(sessionMessage.id);
      }
    }

    if (d.inputs.callbackEventSourceIds?.length) {
      let backend = await db.backend.findFirst({
        where: {
          type: 'slates'
        }
      });

      if (backend) {
        ensureBucket(backend.oid).callbackEventSourceIds.push(
          ...d.inputs.callbackEventSourceIds
        );
      }
    }

    if (d.inputs.authConfigEventIds?.length) {
      let authConfigEvents = await db.providerAuthConfigEvent.findMany({
        where: {
          id: { in: d.inputs.authConfigEventIds },
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        include: {
          authConfig: true,
          authCredentials: true
        }
      });

      for (let authConfigEvent of authConfigEvents) {
        let backendOid =
          authConfigEvent.authConfig?.backendOid ??
          authConfigEvent.authCredentials?.backendOid;
        if (!backendOid) continue;

        ensureBucket(backendOid).authConfigEventIds.push(authConfigEvent.id);
      }
    }

    let invocations = new Map<string, ProviderInvocation>();

    for (let [backendOid, bucket] of buckets) {
      let backend = await getBackend({ entity: { backendOid } });
      let res = await backend.providerInvocation.listProviderInvocations({
        tenant: d.tenant,
        inputs: {
          providerRunIds: bucket.providerRunIds,
          sessionMessageIds: bucket.sessionMessageIds,
          callbackEventSourceIds: bucket.callbackEventSourceIds,
          authConfigEventIds: bucket.authConfigEventIds
        }
      });

      for (let invocation of res.items) {
        mergeInvocation(invocations, invocation);
      }
    }

    return Array.from(invocations.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
  }

  async getProviderInvocation(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerInvocationId: string;
  }) {
    let parsedId = parseProviderInvocationId(d.providerInvocationId);
    if (!parsedId) {
      throw new Error('Invalid provider invocation ID');
    }

    let backendRecord = await db.backend.findFirstOrThrow({
      where: {
        type: parsedId.backendType
      }
    });

    let backend = await getBackend({ entity: { backendOid: backendRecord.oid } });
    let invocation = await backend.providerInvocation.getProviderInvocation({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      input: {
        providerInvocationId: d.providerInvocationId,
        sourceType: parsedId.sourceType,
        sourceId: parsedId.sourceId
      }
    });

    if (!invocation) {
      throw new Error('Provider invocation not found');
    }

    return invocation;
  }
}

export let providerInvocationService = Service.create(
  'providerInvocation',
  () => new providerInvocationServiceImpl()
).build();
