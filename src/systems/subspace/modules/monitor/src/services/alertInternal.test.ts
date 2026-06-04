import { beforeEach, describe, expect, it, vi } from 'vitest';

let protoGuardAlertFindUniqueOrThrow = vi.fn();
let monitorAlertFindUnique = vi.fn();
let monitorAlertCreate = vi.fn();
let monitorAlertFindUniqueOrThrow = vi.fn();
let monitorAlertEventCreate = vi.fn();
let monitorUpdateMany = vi.fn();
let upsertProtoGuardFilterMonitor = vi.fn();

let txDb = {
  monitorAlert: {
    findUnique: monitorAlertFindUnique,
    create: monitorAlertCreate,
    findUniqueOrThrow: monitorAlertFindUniqueOrThrow
  },
  monitorAlertEvent: {
    create: monitorAlertEventCreate
  },
  monitor: {
    updateMany: monitorUpdateMany
  }
};

vi.mock('@metorial-subspace/db', () => ({
  db: {
    protoGuardAlert: {
      findUniqueOrThrow: protoGuardAlertFindUniqueOrThrow
    }
  },
  getId: (model: string) => ({ oid: BigInt(100), id: `${model}_id` }),
  withTransaction: async (fn: (db: typeof txDb) => Promise<unknown>) => await fn(txDb)
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({
      build: factory
    })
  }
}));

vi.mock('./monitorInternal', () => ({
  monitorInternalService: {
    upsertProtoGuardFilterMonitor
  }
}));

let createdAt = new Date('2026-01-02T03:04:05.000Z');

let protoGuardAlert = {
  oid: BigInt(10),
  id: 'protoguard_alert_1',
  tenantOid: BigInt(1),
  environmentOid: BigInt(2),
  solutionOid: BigInt(3),
  createdAt,
  tenant: { oid: BigInt(1), id: 'tenant_1' },
  environment: { oid: BigInt(2), id: 'environment_1' },
  solution: { oid: BigInt(3), id: 'solution_1' },
  instances: [
    {
      filterOid: BigInt(20),
      filter: { oid: BigInt(20), key: 'instruction_override', name: 'Instruction override' },
      severity: 'medium',
      confidence: 0.8
    }
  ]
};

let monitor = {
  oid: BigInt(30),
  id: 'monitor_1',
  firstAlertAt: new Date('2026-01-01T00:00:00.000Z'),
  lastAlertAt: new Date('2026-01-03T00:00:00.000Z')
};

describe('alertInternalService', () => {
  beforeEach(() => {
    vi.resetModules();

    protoGuardAlertFindUniqueOrThrow.mockReset();
    monitorAlertFindUnique.mockReset();
    monitorAlertCreate.mockReset();
    monitorAlertFindUniqueOrThrow.mockReset();
    monitorAlertEventCreate.mockReset();
    monitorUpdateMany.mockReset();
    upsertProtoGuardFilterMonitor.mockReset();

    protoGuardAlertFindUniqueOrThrow.mockResolvedValue(protoGuardAlert);
    upsertProtoGuardFilterMonitor.mockResolvedValue(monitor);
    monitorAlertFindUnique.mockResolvedValue(null);
    monitorAlertCreate.mockResolvedValue({ oid: BigInt(40) });
    monitorAlertFindUniqueOrThrow.mockResolvedValue({
      oid: BigInt(40),
      monitorAlertEvents: []
    });
  });

  it('updates the monitor alert window with conditional timestamp bounds', async () => {
    let { alertInternalService } = await import('./alertInternal');

    await alertInternalService.createFromProtoGuardAlert({
      protoGuardAlertId: protoGuardAlert.id
    });

    expect(monitorUpdateMany).toHaveBeenNthCalledWith(1, {
      where: {
        oid: monitor.oid,
        OR: [{ firstAlertAt: null }, { firstAlertAt: { gt: createdAt } }]
      },
      data: { firstAlertAt: createdAt }
    });
    expect(monitorUpdateMany).toHaveBeenNthCalledWith(2, {
      where: {
        oid: monitor.oid,
        OR: [{ lastAlertAt: null }, { lastAlertAt: { lt: createdAt } }]
      },
      data: { lastAlertAt: createdAt }
    });
  });

  it('still refreshes the monitor alert window when the alert already exists', async () => {
    let existing = { oid: BigInt(41), monitorAlertEvents: [] };
    monitorAlertFindUnique.mockResolvedValue(existing);

    let { alertInternalService } = await import('./alertInternal');

    let alerts = await alertInternalService.createFromProtoGuardAlert({
      protoGuardAlertId: protoGuardAlert.id
    });

    expect(alerts).toEqual([existing]);
    expect(monitorAlertCreate).not.toHaveBeenCalled();
    expect(monitorUpdateMany).toHaveBeenCalledTimes(2);
  });
});
