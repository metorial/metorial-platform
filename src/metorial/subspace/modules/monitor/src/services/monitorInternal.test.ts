import { beforeEach, describe, expect, it, vi } from 'vitest';

let monitorUpsert = vi.fn();

vi.mock('@metorial-subspace/db', () => ({
  db: {
    monitor: {
      upsert: monitorUpsert
    }
  },
  getId: (model: string) => ({ oid: BigInt(100), id: `${model}_id` })
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({
      build: factory
    })
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: async () => ({ oid: BigInt(3), id: 'solution_1' })
}));

describe('monitorInternalService', () => {
  beforeEach(() => {
    vi.resetModules();
    monitorUpsert.mockReset();
    monitorUpsert.mockResolvedValue({ id: 'monitor_1' });
  });

  it('does not overwrite existing ProtoGuard monitor alert timestamps during upsert', async () => {
    let timestamp = new Date('2026-01-02T03:04:05.000Z');
    let { monitorInternalService } = await import('./monitorInternal');

    await monitorInternalService.upsertProtoGuardFilterMonitor({
      tenant: { oid: BigInt(1), id: 'tenant_1' },
      environment: { oid: BigInt(2), id: 'environment_1' },
      solution: { oid: BigInt(3), id: 'solution_1' },
      filter: {
        oid: BigInt(4),
        key: 'instruction_override',
        name: 'Instruction override',
        description: 'Detects instruction override attempts.'
      },
      timestamp
    } as any);

    expect(monitorUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { status: 'active' },
        create: expect.objectContaining({
          firstAlertAt: timestamp,
          lastAlertAt: timestamp
        })
      })
    );
  });
});
