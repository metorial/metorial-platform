import { verify } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSigningKey } from '../../lib/egressGrant';
import { echoSystemMarker, type SystemMarker } from '../_lib/buildScript';

let mocks = vi.hoisted(() => ({
  ctx: null as any,
  admit: vi.fn()
}));

vi.mock('@lowerdeck/queue', async importOriginal => ({
  ...(await importOriginal<typeof import('@lowerdeck/queue')>()),
  createQueue: (opts: { name: string }) => {
    let queue: any = {
      name: opts.name,
      add: vi.fn(async () => ({})),
      process: vi.fn((handler: any) => {
        queue.handler = handler;
        return {};
      })
    };
    return queue;
  },
  combineQueueProcessors: () => ({})
}));

vi.mock('../../env', () => ({
  env: {
    service: { REDIS_URL: 'redis://localhost:6379' },
    provider: { DEFAULT_PROVIDER: 'kubernetes' },
    storage: { ARTIFACT_BUCKET_NAME: 'artifacts', LOG_BUCKET_NAME: 'logs' },
    clusterManager: {},
    kubernetes: {}
  },
  buildNpmRegistryUrl: undefined
}));

vi.mock('../_lib/buildContext', () => ({ BuildContext: { of: async () => mocks.ctx } }));
vi.mock('./admission', () => ({ admitKubernetesBuild: mocks.admit }));

let { KubernetesBuildAdapter } = await import('./index');

let vectors = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../../../packages/egress/testdata/vectors.json'),
    'utf-8'
  )
);
let signingKey = loadSigningKey(vectors.keys.find((k: any) => k.name === 'forge').seed);

let stepOids: Record<string, bigint> = {
  fwos_setup: 1n,
  fwos_build: 2n,
  fwos_up: 3n,
  fwos_teardown: 4n
};

let marker = (m: SystemMarker) => echoSystemMarker(m).slice('echo '.length).slice(1, -1);

let line = (message: string, ts = new Date('2026-11-13T10:00:00Z')) => ({ ts, line: message });

let serviceError = (status: number, code: string) =>
  ServiceError.fromResponse({ status, code, message: code } as any);

let createCtx = () => ({
  run: { id: 'fwor_1', oid: 10n, status: 'pending' },
  startRun: vi.fn(async () => {}),
  startStep: vi.fn(async (d: { stepId: string }) => ({ oid: stepOids[d.stepId]! })),
  completeStep: vi.fn(async (d: { stepId: string }) => ({ oid: stepOids[d.stepId]! })),
  getStepById: vi.fn(async (stepId: string) => ({
    id: stepId,
    step: { type: 'upload_artifact', artifactToUploadName: 'output.zip' }
  })),
  completeArtifactUpload: vi.fn(async () => {}),
  storeTempOutput: vi.fn(async () => {}),
  setPendingReason: vi.fn(async () => {}),
  completeBuild: vi.fn(async () => {}),
  getTenant: vi.fn(async () => ({ id: 'fins_1' })),
  getArtifactUploadTarget: vi.fn(async (stepId: string) => ({
    bucket: 'artifacts',
    storageKey: `fwor_1/${stepId}`
  }))
});

let createRun = (ctx: ReturnType<typeof createCtx>) => ({
  ctx,
  artifacts: [
    { id: 'fwoa_in', oid: 7n, name: 'input.zip', bucket: 'artifacts', storageKey: 'fwor_1/in' }
  ],
  runtimeEnv: { NODE_ENV: 'production', WORKFLOW_RUN_ID: 'fwor_1' },
  setupStep: { id: 'fwos_setup', oid: 1n },
  teardownStep: { id: 'fwos_teardown', oid: 4n },
  initSteps: [],
  actionSteps: [
    { id: 'fwos_build', step: { type: 'script', actionScript: ['npm run build'] } },
    {
      id: 'fwos_up',
      step: {
        type: 'upload_artifact',
        artifactToUploadName: 'output.zip',
        artifactToUploadPath: './output.zip'
      }
    }
  ],
  cleanupSteps: []
});

let build = (status: string, extra: Record<string, any> = {}) => ({
  runId: 'fwor_1',
  name: 'build-fwor-1',
  status,
  exitCode: null,
  failureReason: null,
  pendingReason: null,
  uploadedSteps: [],
  startedAt: null,
  finishedAt: null,
  ...extra
});

let setup = () => {
  let client = {
    build: {
      start: vi.fn(async (_input: { runId: string }) => build('pending')),
      get: vi.fn(),
      logs: vi.fn(),
      delete: vi.fn(async () => {})
    }
  };
  let adapter = new KubernetesBuildAdapter({
    client: client as any,
    signingKey,
    egressPolicy: { entries: [], hosts: [{ pattern: 'registry.npmjs.org', ports: [443] }] },
    timeoutSeconds: 600,
    schedulingTimeoutSeconds: 900,
    maxInFlight: 1
  });
  let ctx = createCtx();
  mocks.ctx = ctx;
  vi.spyOn(adapter as any, 'resolveBuildRun').mockResolvedValue(createRun(ctx));

  let queues = adapter as any;
  return {
    client,
    adapter,
    ctx,
    startQueue: queues.startBuildQueue,
    monitorQueue: queues.monitorBuildQueue,
    endQueue: queues.buildEndedQueue
  };
};

describe('KubernetesBuildAdapter', () => {
  beforeEach(() => {
    mocks.admit.mockReset();
    mocks.admit.mockImplementation(async () => ({
      status: 'admitted',
      deadline: Date.now() + 900_000
    }));
  });

  it('starts a build with the rendered script, artifact spec and a build grant', async () => {
    let { adapter, client, monitorQueue } = setup();
    let before = Math.floor(Date.now() / 1000);

    await adapter.startBuild('fwor_1');

    let input = (client.build.start.mock.calls[0] as any)[0];
    expect(input).toMatchObject({
      runId: 'fwor_1',
      image: 'build-ubuntu',
      env: { NODE_ENV: 'production', WORKFLOW_RUN_ID: 'fwor_1' },
      downloads: [{ artifactId: 'fwoa_in', bucket: 'artifacts', key: 'fwor_1/in' }],
      uploads: [{ stepId: 'fwos_up', bucket: 'artifacts', key: 'fwor_1/fwos_up' }],
      timeoutSeconds: 600,
      schedulingTimeoutSeconds: 900
    });
    expect(input.script).toContain("metorial_upload_artifact 'fwos_up' './output.zip'");
    expect(input.script).toContain('npm run build\nmetorial_check $?');

    let [header, claims, signature] = input.egressGrant.split('.');
    expect(
      verify(
        null,
        Buffer.from(`${header}.${claims}`),
        {
          key: { kty: 'OKP', crv: 'Ed25519', x: signingKey.publicKey.toString('base64url') },
          format: 'jwk'
        },
        Buffer.from(signature, 'base64url')
      )
    ).toBe(true);

    let decoded = JSON.parse(Buffer.from(claims, 'base64url').toString());
    expect(decoded).toMatchObject({
      iss: 'forge',
      aud: 'metorial-egress',
      jti: 'fwor_1',
      tenantId: 'fins_1',
      buildRunId: 'fwor_1',
      source: 'build',
      policy: { entries: [], hosts: [{ pattern: 'registry.npmjs.org', ports: [443] }] }
    });
    expect(decoded.iat).toBeGreaterThanOrEqual(before);
    expect(decoded.exp - decoded.iat).toBe(900 + 600 + 300);
    expect(decoded).not.toHaveProperty('allowAll');

    expect(monitorQueue.add).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'fwor_1',
        setupStepOid: 1n,
        artifactData: { fwos_up: { bucket: 'artifacts', storageKey: 'fwor_1/fwos_up' } }
      }),
      expect.objectContaining({ id: 'fwor_1-0', delay: 1000 })
    );
  });

  it('monitors paged logs, completes the build with its artifacts and deletes the job', async () => {
    let { adapter, client, ctx, monitorQueue, endQueue } = setup();
    await adapter.startBuild('fwor_1');
    let first = monitorQueue.add.mock.calls[0][0];

    client.build.get.mockResolvedValueOnce(build('running'));
    client.build.logs.mockResolvedValueOnce({
      lines: [
        line(marker({ type: 'build.start' })),
        line(marker({ type: 'step.start', stepId: 'fwos_setup' })),
        ...Array.from({ length: 998 }, (_, i) => line(`setup output ${i}`))
      ],
      nextCursor: 'cursor-1'
    });

    await monitorQueue.handler(first);

    expect(client.build.logs).toHaveBeenLastCalledWith(
      { runId: 'fwor_1', cursor: undefined, limit: 1000 },
      { timeoutMs: 10000 }
    );
    expect(ctx.startRun).toHaveBeenCalled();
    let second = monitorQueue.add.mock.calls[1];
    expect(second[1]).toEqual({ id: 'fwor_1-1', delay: 500 });
    expect(second[0]).toMatchObject({
      cursor: 'cursor-1',
      buildStarted: true,
      currentStepOid: 1n
    });

    client.build.get.mockResolvedValueOnce(build('succeeded', { exitCode: 0 }));
    client.build.logs.mockResolvedValueOnce({
      lines: [
        line(marker({ type: 'step.end', stepId: 'fwos_setup' })),
        line(marker({ type: 'step.start', stepId: 'fwos_build' })),
        line('compiled'),
        line(marker({ type: 'step.end', stepId: 'fwos_build' })),
        line(marker({ type: 'step.start', stepId: 'fwos_up' })),
        line(marker({ type: 'upload-artifact.register', stepId: 'fwos_up' })),
        line(marker({ type: 'step.end', stepId: 'fwos_up' })),
        line(marker({ type: 'build.end' }))
      ],
      nextCursor: 'cursor-2'
    });

    await monitorQueue.handler(second[0]);

    expect(client.build.logs).toHaveBeenLastCalledWith(
      { runId: 'fwor_1', cursor: 'cursor-1', limit: 1000 },
      { timeoutMs: 10000 }
    );
    expect(ctx.completeArtifactUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactData: { bucket: 'artifacts', storageKey: 'fwor_1/fwos_up' }
      })
    );
    expect(ctx.storeTempOutput).toHaveBeenCalledWith({
      stepOid: 2n,
      message: `${JSON.stringify([new Date('2026-11-13T10:00:00Z').getTime(), 'compiled'])}\n`
    });
    expect(monitorQueue.add).toHaveBeenCalledTimes(2);
    let ended = endQueue.add.mock.calls[0][0];
    expect(ended).toMatchObject({ runId: 'fwor_1', build: { status: 'succeeded' } });

    client.build.get.mockResolvedValueOnce(build('succeeded', { exitCode: 0 }));
    await endQueue.handler(ended);

    expect(ctx.completeBuild).toHaveBeenCalledWith({
      status: 'succeeded',
      failure: undefined,
      stepArtifacts: [{ stepId: 'fwos_up', bucket: 'artifacts', storageKey: 'fwor_1/fwos_up' }]
    });
    expect(client.build.delete).toHaveBeenCalledWith({ runId: 'fwor_1' });
    expect(ctx.completeBuild.mock.invocationCallOrder[0]!).toBeLessThan(
      client.build.delete.mock.invocationCallOrder[0]!
    );
  });

  it('keeps polling a running build and keeps the cursor when no lines arrive', async () => {
    let { adapter, client, monitorQueue, endQueue } = setup();
    await adapter.startBuild('fwor_1');
    let first = { ...monitorQueue.add.mock.calls[0][0], cursor: 'cursor-1' };

    client.build.get.mockResolvedValueOnce(build('running'));
    client.build.logs.mockResolvedValueOnce({ lines: [], nextCursor: '' });

    await monitorQueue.handler(first);

    expect(monitorQueue.add.mock.calls[1]).toEqual([
      expect.objectContaining({ cursor: 'cursor-1' }),
      { id: 'fwor_1-1', delay: 2500 }
    ]);
    expect(endQueue.add).not.toHaveBeenCalled();
  });

  it('records and logs why a pending build has not started, once per reason', async () => {
    let { adapter, client, ctx, monitorQueue } = setup();
    await adapter.startBuild('fwor_1');
    let reason = 'Unschedulable: 0/1 nodes are available: 1 Insufficient memory.';

    client.build.get.mockResolvedValue(
      build('pending', { pendingReason: reason, pendingCode: 'capacity' })
    );
    client.build.logs.mockResolvedValue({ lines: [], nextCursor: '' });

    await monitorQueue.handler(monitorQueue.add.mock.calls[0][0]);
    await monitorQueue.handler(monitorQueue.add.mock.calls[1][0]);

    expect(ctx.setPendingReason).toHaveBeenCalledTimes(1);
    expect(ctx.setPendingReason).toHaveBeenCalledWith({
      pendingReason: `Waiting for build capacity: ${reason}`
    });
    expect(ctx.storeTempOutput).toHaveBeenCalledTimes(1);
    expect(ctx.storeTempOutput).toHaveBeenCalledWith({
      stepOid: 1n,
      message: expect.stringContaining(`Waiting for build capacity: ${reason}`)
    });
    expect(monitorQueue.add.mock.calls[2][0]).toMatchObject({ pendingReason: reason });
  });

  it('clears the pending reason once the build runs', async () => {
    let { adapter, client, ctx, monitorQueue } = setup();
    await adapter.startBuild('fwor_1');
    let payload = { ...monitorQueue.add.mock.calls[0][0], pendingReason: 'Unschedulable: x' };

    client.build.get.mockResolvedValueOnce(build('running'));
    client.build.logs.mockResolvedValueOnce({ lines: [], nextCursor: '' });

    await monitorQueue.handler(payload);

    expect(ctx.setPendingReason).toHaveBeenCalledWith({ pendingReason: null });
    expect(ctx.storeTempOutput).not.toHaveBeenCalled();
  });

  it('explains a failure of a build that never started', async () => {
    let { client, ctx, endQueue } = setup();
    client.build.get.mockResolvedValueOnce(
      build('failed', {
        failureReason: 'DeadlineExceeded: Job was active longer than specified'
      })
    );

    await endQueue.handler({
      runId: 'fwor_1',
      artifactData: {},
      logStepOid: 1n,
      pendingReason: 'Unschedulable: 0/1 nodes are available: 1 Insufficient memory.'
    });

    expect(ctx.storeTempOutput).toHaveBeenCalledWith({
      stepOid: 1n,
      message: expect.stringContaining(
        'the build never started: Unschedulable: 0/1 nodes are available: 1 Insufficient memory.'
      )
    });
  });

  it('fails the build with the failure reason in the current step', async () => {
    let { client, ctx, endQueue } = setup();

    client.build.get.mockResolvedValueOnce(
      build('failed', { exitCode: 137, failureReason: 'OOMKilled' })
    );
    client.build.delete.mockRejectedValueOnce(serviceError(404, 'build_not_found'));

    await endQueue.handler({ runId: 'fwor_1', artifactData: {}, logStepOid: 2n });

    expect(ctx.storeTempOutput).toHaveBeenCalledWith({
      stepOid: 2n,
      message: expect.stringContaining('Build failed: OOMKilled')
    });
    expect(ctx.completeBuild).toHaveBeenCalledWith({
      status: 'failed',
      failure: expect.objectContaining({ message: 'OOMKilled (exit code 137)' }),
      stepArtifacts: []
    });
  });

  it('reports the exit code when the cluster gives no reason', async () => {
    let { client, ctx, endQueue } = setup();
    client.build.get.mockResolvedValueOnce(build('failed', { exitCode: 2 }));

    await endQueue.handler({ runId: 'fwor_1', artifactData: {}, logStepOid: 1n });

    expect(ctx.storeTempOutput).toHaveBeenCalledWith({
      stepOid: 1n,
      message: expect.stringContaining('Build exited with code 2')
    });
  });

  it('times out a build that outlives its deadline', async () => {
    let { adapter, client, ctx, monitorQueue, endQueue } = setup();
    await adapter.startBuild('fwor_1');
    let payload = {
      ...monitorQueue.add.mock.calls[0][0],
      deadlineAt: Date.now() - 1,
      currentStepOid: 2n
    };

    client.build.get.mockResolvedValueOnce(build('running'));
    client.build.logs.mockResolvedValueOnce({ lines: [], nextCursor: 'c' });

    await monitorQueue.handler(payload);

    let ended = endQueue.add.mock.calls[0][0];
    expect(ended).toMatchObject({
      failure: { code: 'build_runtime_timeout' },
      logStepOid: 2n
    });
    expect(monitorQueue.add).toHaveBeenCalledTimes(1);

    client.build.get.mockResolvedValueOnce(build('running'));
    await endQueue.handler(ended);

    expect(ctx.storeTempOutput).toHaveBeenCalledWith({
      stepOid: 2n,
      message: expect.stringContaining('Build timed out after 600 seconds')
    });
    expect(ctx.completeBuild).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
    expect(client.build.delete).toHaveBeenCalledWith({ runId: 'fwor_1' });
  });

  it('ends the build when the job disappeared', async () => {
    let { adapter, client, ctx, monitorQueue, endQueue } = setup();
    await adapter.startBuild('fwor_1');

    client.build.get.mockRejectedValue(serviceError(404, 'build_not_found'));
    await monitorQueue.handler(monitorQueue.add.mock.calls[0][0]);

    expect(client.build.logs).not.toHaveBeenCalled();
    await endQueue.handler(endQueue.add.mock.calls[0][0]);

    expect(ctx.storeTempOutput).toHaveBeenCalledWith({
      stepOid: 1n,
      message: expect.stringContaining('no longer exists')
    });
    expect(ctx.completeBuild).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
  });

  it('fails immediately on a permanent rejection', async () => {
    let { adapter, client, ctx, startQueue, endQueue } = setup();
    client.build.start.mockRejectedValueOnce(serviceError(422, 'build_admission_rejected'));

    await adapter.startBuild('fwor_1');
    await endQueue.handler(endQueue.add.mock.calls[0][0]);

    expect(ctx.completeBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        failure: { code: 'build_admission_rejected', message: 'build_admission_rejected' }
      })
    );
    expect(startQueue.add).not.toHaveBeenCalled();
  });

  it('paces transient starts and adopts the same run after a lost create response', async () => {
    let { adapter, client, ctx, startQueue, monitorQueue } = setup();
    client.build.start.mockRejectedValueOnce(serviceError(503, 'service_unavailable'));

    await adapter.startBuild('fwor_1');

    let [retry, options] = startQueue.add.mock.calls[0];
    expect(retry).toMatchObject({
      runId: 'fwor_1',
      attempt: 1,
      pendingCode: 'infrastructure'
    });
    expect(options.delay).toBeGreaterThanOrEqual(2500);
    expect(monitorQueue.add).not.toHaveBeenCalled();

    await startQueue.handler(retry);

    expect(client.build.start).toHaveBeenCalledTimes(2);
    expect(client.build.start.mock.calls.map(([input]) => input.runId)).toEqual([
      'fwor_1',
      'fwor_1'
    ]);
    expect(monitorQueue.add).toHaveBeenCalledTimes(1);
    expect(ctx.completeBuild).not.toHaveBeenCalled();
  });

  it('queues quota exhaustion within the scheduling budget', async () => {
    let { adapter, client, ctx, startQueue } = setup();
    let reason = 'exceeded quota: builds';
    client.build.start.mockRejectedValueOnce(
      ServiceError.fromResponse({
        status: 503,
        code: 'build_quota_exceeded',
        message: 'Build namespace quota is exhausted.',
        reason
      })
    );

    await adapter.startBuild('fwor_1');

    expect(ctx.setPendingReason).toHaveBeenCalledWith({
      pendingReason: `Waiting for build capacity: ${reason}`
    });
    expect(startQueue.add.mock.calls[0][0]).toMatchObject({ pendingCode: 'quota' });
  });

  it('expires an admission wait without creating a Job', async () => {
    let { adapter, client, startQueue, endQueue } = setup();
    mocks.admit
      .mockResolvedValueOnce({ status: 'waiting', deadline: Date.now() + 900_000 })
      .mockResolvedValueOnce({ status: 'expired', deadline: Date.now() });

    await adapter.startBuild('fwor_1');
    let [retry] = startQueue.add.mock.calls[0];
    await startQueue.handler(retry);

    expect(client.build.start).not.toHaveBeenCalled();
    expect(endQueue.add.mock.calls[0][0]).toMatchObject({
      failure: { code: 'build_capacity_timeout' },
      skipCleanup: true
    });
  });

  it('lets the existing Pod use the full execution budget after a CPU wait', async () => {
    let { adapter, client, monitorQueue, endQueue } = setup();
    let now = Date.now();
    mocks.admit.mockResolvedValue({ status: 'admitted', deadline: now + 10_000 });
    await adapter.startBuild('fwor_1');

    let reason = 'Unschedulable: 0/1 nodes are available: 1 Insufficient cpu.';
    client.build.get.mockResolvedValueOnce(
      build('pending', { pendingReason: reason, pendingCode: 'capacity' })
    );
    await monitorQueue.handler(monitorQueue.add.mock.calls[0][0]);

    let clock = vi.spyOn(Date, 'now').mockReturnValue(now + 20_000);
    try {
      client.build.get.mockResolvedValueOnce(
        build('running', { startedAt: new Date(now + 50) })
      );
      client.build.logs.mockResolvedValue({ lines: [], nextCursor: '' });
      await monitorQueue.handler(monitorQueue.add.mock.calls[1][0]);
    } finally {
      clock.mockRestore();
    }

    expect(endQueue.add).not.toHaveBeenCalled();
    expect(client.build.start).toHaveBeenCalledTimes(1);
    expect(client.build.delete).not.toHaveBeenCalled();
    expect(monitorQueue.add.mock.calls[2][0]).toMatchObject({ containerStartedAt: now + 50 });
  });

  it('reports the last scheduler reason when CPU never frees up', async () => {
    let { adapter, client, ctx, monitorQueue, endQueue } = setup();
    await adapter.startBuild('fwor_1');

    let reason = 'Unschedulable: 0/1 nodes are available: 1 Insufficient cpu.';
    client.build.get.mockResolvedValue(
      build('pending', { pendingReason: reason, pendingCode: 'capacity' })
    );
    await monitorQueue.handler({
      ...monitorQueue.add.mock.calls[0][0],
      schedulingDeadlineAt: Date.now() - 1
    });
    await endQueue.handler(endQueue.add.mock.calls[0][0]);

    expect(ctx.completeBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        failure: { code: 'build_capacity_timeout', message: expect.stringContaining(reason) }
      })
    );
    expect(client.build.start).toHaveBeenCalledTimes(1);
    expect(client.build.delete).toHaveBeenCalledTimes(1);
  });

  it('recognizes execution timeout after the Job has already exited', async () => {
    let { adapter, client, monitorQueue, endQueue } = setup();
    await adapter.startBuild('fwor_1');

    let now = Date.now();
    client.build.get.mockResolvedValue(
      build('failed', {
        exitCode: 124,
        startedAt: new Date(now - 601_000),
        finishedAt: new Date(now)
      })
    );
    client.build.logs.mockResolvedValue({ lines: [], nextCursor: '' });
    await monitorQueue.handler(monitorQueue.add.mock.calls[0][0]);

    expect(endQueue.add.mock.calls[0][0]).toMatchObject({
      failure: { code: 'build_runtime_timeout' }
    });
  });

  it('keeps startup stderr when the launcher fails before the first build marker', async () => {
    let { adapter, client, ctx, monitorQueue, endQueue } = setup();
    await adapter.startBuild('fwor_1');

    client.build.get.mockResolvedValue(
      build('failed', { exitCode: 1, failureReason: 'BackoffLimitExceeded: failed' })
    );
    client.build.logs.mockResolvedValue({
      lines: [line('policy gate: NetworkPolicy is not in force')],
      nextCursor: 'logs'
    });
    await monitorQueue.handler(monitorQueue.add.mock.calls[0][0]);
    await endQueue.handler(endQueue.add.mock.calls[0][0]);

    expect(ctx.storeTempOutput).toHaveBeenCalledWith({
      stepOid: 1n,
      message: expect.stringContaining('policy gate: NetworkPolicy is not in force')
    });
    expect(ctx.completeBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        failure: { code: 'build_startup_failed', message: 'Build exited with code 1' }
      })
    );
  });
});
