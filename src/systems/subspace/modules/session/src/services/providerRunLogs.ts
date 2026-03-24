import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type ProviderRun,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
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
  }) {
    let fullProviderRun = await db.providerRun.findFirstOrThrow({
      where: { oid: d.providerRun.oid },
      include: { providerVersion: true }
    });

    let backend = await getBackend({ entity: fullProviderRun.providerVersion });

    let allLogs = await backend.providerRun.getProviderRunLogs({
      providerRun: fullProviderRun,
      tenant: d.tenant
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
