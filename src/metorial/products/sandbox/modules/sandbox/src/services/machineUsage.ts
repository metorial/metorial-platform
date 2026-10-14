import {
  badRequestError,
  createError,
  isServiceError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, type Instance } from '@metorial/db';
import type { GenesisInternalClient } from '@metorial/genesis-client';
import { getRegional, sandboxTenantInclude } from '../lib/regional';

let usageUnavailableError = createError({
  status: 503,
  code: 'usage_unavailable',
  message: 'Usage history is not available right now.'
});

export type SandboxUsageInterval = NonNullable<
  Parameters<GenesisInternalClient['usage']['timeline']>[0]['interval']
>;

export type SandboxMachineUsageFilter = {
  instance: Instance;
  machineId: string;
  from: Date;
  to: Date;
  instanceIds?: string[];
  groupBy?: 'machine_instance';
  maxSeries?: number;
};

class SandboxMachineUsageServiceImpl {
  private async prepare(d: SandboxMachineUsageFilter) {
    if (
      !Number.isFinite(d.from.getTime()) ||
      !Number.isFinite(d.to.getTime()) ||
      d.to <= d.from
    ) {
      throw new ServiceError(badRequestError({ message: '`to` must be after `from`.' }));
    }

    if (d.to.getTime() > Date.now()) {
      throw new ServiceError(badRequestError({ message: '`to` cannot be in the future.' }));
    }

    let machine = await db.sandboxMachine.findFirst({
      where: { id: d.machineId, instanceOid: d.instance.oid },
      include: { tenant: { include: sandboxTenantInclude } }
    });
    if (!machine) throw new ServiceError(notFoundError('sandbox_machine', d.machineId));

    let { genesis, tenantId } = getRegional(machine.tenant);
    let groupBy: 'machine_instance'[] = d.groupBy ? [d.groupBy] : [];
    let input = {
      tenantId,
      machineIds: [machine.id],
      instanceIds: d.instanceIds ?? [],
      specIds: [],
      from: d.from,
      to: d.to,
      groupBy: d.groupBy ? ['instance' as const] : [],
      maxSeries: d.maxSeries ?? 50
    };

    return { genesis, input, machineId: machine.id, groupBy };
  }

  private async query<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isServiceError(error) && error.data.status >= 400 && error.data.status < 500) {
        throw error;
      }

      throw new ServiceError(usageUnavailableError);
    }
  }

  async timeline(d: SandboxMachineUsageFilter & { interval?: SandboxUsageInterval }) {
    let { genesis, input, machineId, groupBy } = await this.prepare(d);
    let timeline = await this.query(() =>
      genesis.usage.timeline({ ...input, interval: d.interval })
    );

    return { machineId, groupBy, timeline };
  }

  async summary(d: SandboxMachineUsageFilter) {
    let { genesis, input, machineId, groupBy } = await this.prepare(d);
    let summary = await this.query(() => genesis.usage.summary(input));

    return { machineId, groupBy, summary };
  }
}

export let sandboxMachineUsageService = Service.create(
  'sandboxMachineUsageService',
  () => new SandboxMachineUsageServiceImpl()
).build();
