import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-sandbox', () => ({
  sandboxFailureCodes: ['internal_error'],
  sandboxBuildFailureCodes: ['internal_error'],
  mapSandboxFailure: vi.fn(),
  resolveSandboxImageRef: vi.fn(),
  resolveSandboxSpecId: vi.fn()
}));

import { resolveSandboxImageRef, resolveSandboxSpecId } from '@metorial/module-sandbox';
import {
  getSandboxUpcomingEvents,
  sandboxMachineOperationKinds,
  v1SandboxMachinePresenter
} from './machine';
import { v1SandboxMachineOperationPresenter } from './machineOperation';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

describe('getSandboxUpcomingEvents', () => {
  let now = new Date('2026-01-01T12:00:00Z');
  let at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

  it('lists events within the next hour, soonest first', () => {
    let events = getSandboxUpcomingEvents(
      {
        pauseAt: at(30),
        hibernateAt: at(90),
        restartAt: at(10),
        instanceExpiresAt: at(45)
      },
      now
    );

    expect(events).toEqual([
      { type: 'restart', occurs_at: at(10) },
      { type: 'pause', occurs_at: at(30) },
      { type: 'reprovision', occurs_at: at(45) }
    ]);
  });

  it('omits unscheduled events', () => {
    expect(
      getSandboxUpcomingEvents(
        { pauseAt: null, hibernateAt: null, restartAt: null, instanceExpiresAt: null },
        now
      )
    ).toEqual([]);
  });

  it('keeps overdue events that have not fired yet', () => {
    expect(
      getSandboxUpcomingEvents(
        { pauseAt: at(-5), hibernateAt: null, restartAt: null, instanceExpiresAt: null },
        now
      )
    ).toEqual([{ type: 'pause', occurs_at: at(-5) }]);
  });
});

let localMachine = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'sbm_1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    tenant: { region: { oid: 7n, identifier: 'us-east-1' } },
    image: { id: 'img_1' },
    firewallLinks: [{ firewall: { id: 'fwl_1' } }],
    remote: null,
    ...overrides
  }) as any;

let remoteMachine = (overrides: Record<string, unknown> = {}) => ({
  status: 'running',
  name: 'api',
  slug: 'api-1',
  image: { imageId: 'gen_img', versionId: 'gen_ver' },
  spec: { id: 'gen_spec', identifier: 'standard-2', memoryMiB: 2048, vcpus: 2 },
  physicalSpec: { id: 'gen_physical', identifier: 'm1024-c1000', memoryMiB: 1024, vcpus: 1 },
  rootFs: {
    current: { diskId: 'sbd_root', diskSizeBytes: '1024' },
    desired: { diskId: 'sbd_root', diskSizeBytes: '2048' }
  },
  disks: [
    { diskId: 'sbd_root', purpose: 'root_fs', mountPath: '/', state: 'mounted' },
    { diskId: 'sbd_data', purpose: 'mount', mountPath: '/data', state: 'mounted' }
  ],
  publicPorts: [8080],
  lifecyclePolicy: {
    pauseAfterIdleSeconds: 60,
    hibernateAfterPausedSeconds: null,
    connectionIdleSeconds: 30
  },
  runtime: null,
  lifecycleHooks: [],
  ignoreImageHooks: false,
  entrypointWaitSeconds: null,
  operation: null,
  currentInstance: {
    id: 'run_1',
    generation: 2,
    status: 'running',
    phase: 'running',
    stale: false
  },
  schedule: { lastActivityAt: null, pauseAt: null, hibernateAt: null, restartAt: null },
  failure: null,
  createdAt: new Date('2026-01-01T00:00:01Z'),
  runningAt: new Date('2026-01-01T00:01:00Z'),
  pausedAt: null,
  hibernatedAt: null,
  terminatedAt: null,
  ...overrides
});

describe('v1SandboxMachinePresenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports a restart as required when the instance is stale', async () => {
    vi.mocked(resolveSandboxImageRef).mockResolvedValue({
      imageId: 'img_1',
      versionId: 'imv_1'
    } as any);
    vi.mocked(resolveSandboxSpecId).mockResolvedValue('spc_1');

    let stale = await v1SandboxMachinePresenter
      .present(
        {
          machine: localMachine({
            remote: remoteMachine({
              currentInstance: {
                id: 'run_1',
                generation: 2,
                status: 'running',
                phase: 'running',
                stale: true
              }
            })
          })
        },
        context
      )
      .run();

    let fresh = await v1SandboxMachinePresenter
      .present({ machine: localMachine({ remote: remoteMachine() }) }, context)
      .run();

    expect(stale.restart_required).toBe(true);
    expect(fresh.restart_required).toBe(false);
    expect(fresh.public_ports).toEqual([8080]);
    expect(fresh.mounts).toEqual([
      { disk_id: 'sbd_data', mount_path: '/data', state: 'mounted' }
    ]);
  });

  it('does not require a restart when there is no instance', async () => {
    let result = await v1SandboxMachinePresenter
      .present(
        { machine: localMachine({ remote: remoteMachine({ currentInstance: null }) }) },
        context
      )
      .run();

    expect(result.restart_required).toBe(false);
    expect(result.current_instance).toBeNull();
  });

  it('reports maximum boost from the backing size rather than the requested size', async () => {
    let result = await v1SandboxMachinePresenter
      .present(
        {
          machine: localMachine({
            remote: remoteMachine({
              spec: { id: 'gen_spec', identifier: 'm3072-c3000', memoryMiB: 3072, vcpus: 3 },
              physicalSpec: {
                id: 'gen_physical',
                identifier: 'm4096-c2000',
                memoryMiB: 4096,
                vcpus: 2
              }
            })
          })
        },
        context
      )
      .run();

    expect(result.spec).toMatchObject({ memory_gib: 3, cpus: 3 });
    expect(result.max_boost).toEqual({ memory_gib: 16, cpus: 8 });
  });

  it('falls back to the local record when the remote machine is gone', async () => {
    let deletedAt = new Date('2026-02-01T00:00:00Z');

    let result = await v1SandboxMachinePresenter
      .present({ machine: localMachine({ deletedAt }) }, context)
      .run();

    expect(result).toMatchObject({
      object: 'sandbox.machine',
      id: 'sbm_1',
      status: 'terminated',
      name: null,
      slug: null,
      region: 'us-east-1',
      image: { id: 'img_1', version_id: null },
      spec: null,
      max_boost: null,
      root_disk: null,
      mounts: [],
      firewall_ids: ['fwl_1'],
      public_ports: [],
      operation: null,
      current_instance: null,
      restart_required: false,
      upcoming_events: [],
      failure: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      terminated_at: deletedAt
    });
    expect(resolveSandboxSpecId).not.toHaveBeenCalled();
    expect(resolveSandboxImageRef).not.toHaveBeenCalled();
  });
});

describe('v1SandboxMachineOperationPresenter', () => {
  let operation = (kind: string) =>
    ({
      id: 'sbo_1',
      machineId: 'sbm_1',
      kind,
      trigger: 'api',
      outcome: 'succeeded',
      failure: null,
      fromInstanceId: null,
      supersededById: null,
      instanceOperations: [],
      requestedAt: new Date('2026-01-01T00:00:00Z'),
      completedAt: null
    }) as any;

  it('lists update and upgrade among the operation kinds', () => {
    expect(sandboxMachineOperationKinds).toEqual(
      expect.arrayContaining(['update', 'upgrade'])
    );

    let schema = JSON.stringify(v1SandboxMachineOperationPresenter.introspect().object);
    expect(schema).toContain('"update"');
    expect(schema).toContain('"upgrade"');
  });

  it.each(['update', 'upgrade'])('presents %s operations', async kind => {
    let result = await v1SandboxMachineOperationPresenter
      .present({ operation: operation(kind) }, context)
      .run();

    expect(result.kind).toBe(kind);
  });
});

it('returns local metadata even when the remote is missing', async () => {
  let result = await v1SandboxMachinePresenter
    .present(
      { machine: localMachine({ metadata: { app: 'test', nested: { enabled: true } } }) },
      context
    )
    .run();

  expect(result.metadata).toEqual({ app: 'test', nested: { enabled: true } });
});
