import { badRequestError, createError, ServiceError } from '@lowerdeck/error';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let db = { sandboxMachine: { findFirst: vi.fn() } };

let genesis = { usage: { timeline: vi.fn(), summary: vi.fn() } };

vi.mock('@metorial/db', () => ({ db }));
vi.mock('../src/lib/regions', () => ({ getRegionClient: vi.fn(() => genesis) }));

let { sandboxMachineUsageService } = await import('../src/services/machineUsage');
let { getRegionClient } = await import('../src/lib/regions');

let instance = { oid: 7n } as any;

let machine = {
  id: 'sbm_1',
  instanceOid: 7n,
  status: 'deleted',
  tenant: { id: 'sbt_shared', region: { id: 'eu-west-1' } }
};

let filter = {
  instance,
  machineId: machine.id,
  from: new Date('2026-01-01T00:00:00Z'),
  to: new Date('2026-01-02T00:00:00Z')
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-03T00:00:00Z'));
  db.sandboxMachine.findFirst.mockResolvedValue(machine);
  vi.mocked(getRegionClient).mockReturnValue(genesis as any);
});

afterEach(() => vi.useRealTimers());

describe('sandboxMachineUsageService', () => {
  it('queries retained history for a terminated local machine without live hydration', async () => {
    let timeline = { from: 1000, to: 2000, interval: '1h', resolution: 'hour', series: [] };
    genesis.usage.timeline.mockResolvedValue(timeline);

    let result = await sandboxMachineUsageService.timeline(filter);

    expect(db.sandboxMachine.findFirst).toHaveBeenCalledWith({
      where: { id: 'sbm_1', instanceOid: 7n },
      include: { tenant: { include: { region: true } } }
    });
    expect(getRegionClient).toHaveBeenCalledWith('eu-west-1');
    expect(genesis.usage.timeline).toHaveBeenCalledWith({
      tenantId: 'sbt_shared',
      machineIds: ['sbm_1'],
      instanceIds: [],
      specIds: [],
      from: filter.from,
      to: filter.to,
      groupBy: [],
      maxSeries: 50,
      interval: undefined
    });
    expect(result).toEqual({ machineId: 'sbm_1', groupBy: [], timeline });
  });

  it.each(['timeline', 'summary'] as const)(
    'scopes %s to the authenticated instance even when the project tenant is shared',
    async method => {
      db.sandboxMachine.findFirst.mockImplementation(async ({ where }) =>
        where.instanceOid === machine.instanceOid ? machine : null
      );

      await expect(
        sandboxMachineUsageService[method]({ ...filter, instance: { oid: 8n } as any })
      ).rejects.toMatchObject({ data: { status: 404 } });
      expect(genesis.usage[method]).not.toHaveBeenCalled();
    }
  );

  it('rejects unknown machines before querying Genesis', async () => {
    db.sandboxMachine.findFirst.mockResolvedValue(null);

    await expect(sandboxMachineUsageService.summary(filter)).rejects.toMatchObject({
      data: { status: 404 }
    });
    expect(genesis.usage.summary).not.toHaveBeenCalled();
  });

  it.each(['timeline', 'summary'] as const)(
    'translates execution filters and grouping for %s',
    async method => {
      await sandboxMachineUsageService[method]({
        ...filter,
        instanceIds: ['run_1', 'run_2'],
        groupBy: 'machine_instance',
        maxSeries: 2
      });

      expect(genesis.usage[method]).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'sbt_shared',
          machineIds: ['sbm_1'],
          instanceIds: ['run_1', 'run_2'],
          specIds: [],
          groupBy: ['instance'],
          maxSeries: 2
        })
      );
    }
  );

  it('forwards an explicit interval without adjusting it', async () => {
    await sandboxMachineUsageService.timeline({ ...filter, interval: '15m' });

    expect(genesis.usage.timeline).toHaveBeenCalledWith(
      expect.objectContaining({ interval: '15m' })
    );
  });

  it.each([
    { to: filter.from },
    { to: new Date('2025-12-31T00:00:00Z') },
    { from: new Date(NaN) },
    { to: new Date(NaN) },
    { to: new Date('2026-01-03T00:00:01Z') }
  ])('rejects invalid or future ranges before calling Genesis: %o', async overrides => {
    await expect(
      sandboxMachineUsageService.timeline({ ...filter, ...overrides })
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(genesis.usage.timeline).not.toHaveBeenCalled();
  });

  it.each(['timeline', 'summary'] as const)(
    'preserves structured Genesis validation errors for %s',
    async method => {
      let error = new ServiceError(
        badRequestError({ message: 'Minute-level usage is kept for 7 days.' })
      );
      genesis.usage[method].mockRejectedValue(error);

      await expect(sandboxMachineUsageService[method](filter)).rejects.toBe(error);
    }
  );

  it.each(['timeline', 'summary'] as const)(
    'reports unavailable history as 503 for %s',
    async method => {
      for (let error of [
        new Error('Connection refused'),
        new ServiceError(
          createError({ status: 503, code: 'usage_unavailable', message: 'Unavailable' })
        )
      ]) {
        genesis.usage[method].mockRejectedValue(error);

        await expect(sandboxMachineUsageService[method](filter)).rejects.toMatchObject({
          data: { status: 503, code: 'usage_unavailable' }
        });
      }
    }
  );
});
