import { beforeEach, describe, expect, it, vi } from 'vitest';

let { recordEvent, addAfterTransactionHook } = vi.hoisted(() => ({
  recordEvent: vi.fn(),
  addAfterTransactionHook: vi.fn(async (hook: () => Promise<void>) => await hook())
}));

vi.mock('@metorial/module-audit-tracker', () => ({
  auditTrackerService: { recordEvent }
}));

vi.mock('@metorial/db', () => ({ addAfterTransactionHook }));

vi.mock('@metorial/fabric', () => ({
  Fabric: { listen: vi.fn() }
}));

import {
  recordSandboxDiskCreated,
  recordSandboxDiskResized,
  recordSandboxImageBuildCancelled,
  recordSandboxImageUpdated,
  recordSandboxMachineAccessCreated,
  recordSandboxMachineExec,
  recordSandboxMachineLifecycle,
  recordSandboxMachineUpdated
} from './sandbox';

let auditScope = {
  organizationOid: 1n,
  instanceOid: 3n,
  organizationActorOid: 4n,
  actor: { type: 'org_actor' as const, id: 'oac_1' },
  context: { ip: '127.0.0.1' }
};

let machine = {
  id: 'mach_1',
  name: 'dev',
  imageId: 'img_1',
  regionIdentifier: 'eu-1',
  specMemoryMiB: 1024,
  specVcpus: 1
};

let disk = {
  id: 'dsk_1',
  name: 'data',
  type: 'standard',
  sizeBytes: 100,
  regionIdentifier: 'eu-1'
};

describe('sandbox audit listeners', () => {
  beforeEach(() => {
    recordEvent.mockClear();
  });

  it('records machine updates with the previous state', async () => {
    let previousMachine = { ...machine, name: 'old' };
    await recordSandboxMachineUpdated({ auditScope, machine, previousMachine });

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'sandbox_machine',
      'update',
      expect.objectContaining({
        payload: expect.objectContaining({ id: 'mach_1', name: 'dev' }),
        previousPayload: expect.objectContaining({ name: 'old' })
      })
    );
  });

  it('records lifecycle actions under the action name', async () => {
    await recordSandboxMachineLifecycle({ auditScope, machine, action: 'hibernate' });

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'sandbox_machine',
      'hibernate',
      expect.anything()
    );
  });

  it('records machine access without any token material', async () => {
    await recordSandboxMachineAccessCreated({
      auditScope,
      machine,
      kind: 'port',
      ports: [8080],
      ttlSeconds: 60
    });

    let payload = recordEvent.mock.calls[0]![3].payload;
    expect(payload).toEqual({
      machineId: 'mach_1',
      machineName: 'dev',
      kind: 'port',
      ports: [8080],
      ttlSeconds: 60
    });
  });

  it('records a command run without the command or its output', async () => {
    await recordSandboxMachineExec({
      auditScope,
      machine,
      commandByteSize: 7,
      outcome: 'exited',
      exitCode: 0,
      timedOut: false,
      durationMs: 120
    });

    expect(recordEvent).toHaveBeenCalledWith(auditScope, 'sandbox_machine_exec', 'run', {
      payload: {
        machineId: 'mach_1',
        machineName: 'dev',
        commandByteSize: 7,
        outcome: 'exited',
        exitCode: 0,
        timedOut: false,
        durationMs: 120
      },
      recordedAt: expect.any(Date)
    });
  });

  it('records a command run that never exited', async () => {
    await recordSandboxMachineExec({
      auditScope,
      machine,
      commandByteSize: 7,
      outcome: 'deadline',
      exitCode: null,
      timedOut: false,
      durationMs: 420_000
    });

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'sandbox_machine_exec',
      'run',
      expect.objectContaining({
        payload: expect.objectContaining({ outcome: 'deadline', exitCode: null })
      })
    );
  });

  it('records disk creation with its source', async () => {
    await recordSandboxDiskCreated({
      auditScope,
      disk,
      sourceDiskId: 'dsk_0',
      sourceImageId: null
    });

    expect(recordEvent.mock.calls[0]![3].payload).toMatchObject({
      id: 'dsk_1',
      sourceDiskId: 'dsk_0',
      sourceImageId: null
    });
  });

  it('records disk resize retries as retry', async () => {
    await recordSandboxDiskResized({
      auditScope,
      disk,
      resizeId: 'rsz_1',
      sizeBytes: null,
      retry: true
    });

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'sandbox_disk_resize',
      'retry',
      expect.anything()
    );
  });

  it('records image updates and build cancellations', async () => {
    await recordSandboxImageUpdated({
      auditScope,
      image: { id: 'img_1', name: 'b' },
      previousImage: { id: 'img_1', name: 'a' }
    });
    await recordSandboxImageBuildCancelled({
      auditScope,
      build: { id: 'bld_1', imageId: 'img_1', status: 'cancelled' }
    });

    expect(recordEvent).toHaveBeenCalledTimes(2);
    expect(recordEvent.mock.calls[1]![2]).toBe('cancel');
  });
});
