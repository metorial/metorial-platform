import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type ProviderRun,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { mergeRetentionWithDateFilter } from '@metorial-subspace/list-utils';
import { getBackend } from '@metorial-subspace/provider';

export type ProviderRunLog = {
  timestamp: number;
  message: string;
  toolCallId: string;
  slateSessionId: string;
};

class providerRunLogsServiceImpl {
  async getProviderRunLogs(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerRun: ProviderRun;
    inputs: {
      sessionMessageIds?: string[];
    };
  }) {
    let fullProviderRun = await db.providerRun.findFirst({
      where: {
        oid: d.providerRun.oid,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...mergeRetentionWithDateFilter(d.tenant)
      },
      include: { providerVersion: true }
    });
    if (!fullProviderRun) {
      throw new ServiceError(notFoundError('provider_run', d.providerRun.id));
    }

    let backend = await getBackend({ entity: fullProviderRun.providerVersion });

    let allLogs = await backend.providerRun.getProviderRunLogs({
      providerRun: fullProviderRun,
      tenant: d.tenant,
      sessionMessageIds: d.inputs.sessionMessageIds
    });

    return {
      object: 'provider_run.logs',
      providerRunId: d.providerRun.id,
      logs: allLogs.logs.map((l, i) => ({
        ...l,
        object: 'provider_run.log'
      }))
    };
  }
}

export let providerRunLogsService = Service.create(
  'providerRunLogs',
  () => new providerRunLogsServiceImpl()
).build();
