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

  it('mirrors the tenant project and the environment instance onto new monitors', async () => {
    let { monitorInternalService } = await import('./monitorInternal');

    await monitorInternalService.upsertProtoGuardFilterMonitor({
      tenant: { oid: BigInt(1), id: 'tenant_1', projectOid: BigInt(11) },
      environment: { oid: BigInt(2), id: 'environment_1', instanceOid: BigInt(22) },
      filter: {
        oid: BigInt(4),
        key: 'instruction_override',
        name: 'Instruction override',
        description: 'Detects instruction override attempts.'
      }
    } as any);

    expect(monitorUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantOid: BigInt(1),
          projectOid: BigInt(11),
          environmentOid: BigInt(2),
          instanceOid: BigInt(22)
        })
      })
    );
  });

  it('leaves the mirrored references null for an unlinked tenant and environment', async () => {
    let { monitorInternalService } = await import('./monitorInternal');

    await monitorInternalService.upsertProviderSpecChangeMonitor({
      tenant: { oid: BigInt(1), id: 'tenant_1', projectOid: null },
      environment: { oid: BigInt(2), id: 'environment_1', instanceOid: null },
      provider: { oid: BigInt(5), id: 'provider_1', name: 'Provider' }
    } as any);

    let create = monitorUpsert.mock.calls[0][0].create;

    expect(create.tenantOid).toBe(BigInt(1));
    expect(create.projectOid).toBeNull();
    expect(create.environmentOid).toBe(BigInt(2));
    expect(create.instanceOid).toBeNull();
  });
});
