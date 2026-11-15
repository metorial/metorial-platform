import { verify } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSigningKey } from '../../lib/egressGrant';
import { echoSystemMarker, type SystemMarker } from '../_lib/buildScript';

let mocks = vi.hoisted(() => ({ ctx: null as any }));

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
  }
}));

vi.mock('../_lib/buildContext', () => ({ BuildContext: { of: async () => mocks.ctx } }));

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
  run: { id: 'fwor_1', oid: 10n },
  startRun: vi.fn(async () => {}),
  startStep: vi.fn(async (d: { stepId: string }) => ({ oid: stepOids[d.stepId]! })),
  completeStep: vi.fn(async (d: { stepId: string }) => ({ oid: stepOids[d.stepId]! })),
  getStepById: vi.fn(async (stepId: string) => ({
    id: stepId,
    step: { type: 'upload_artifact', artifactToUploadName: 'output.zip' }
  })),
  completeArtifactUpload: vi.fn(async () => {}),
  storeTempOutput: vi.fn(async () => {}),
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
  uploadedSteps: [],
  startedAt: null,
  finishedAt: null,
  ...extra
});

let setup = () => {
  let client = {
    build: {
      start: vi.fn(async () => build('pending')),
      get: vi.fn(),
      logs: vi.fn(),
      delete: vi.fn(async () => {})
    }
  };
  let adapter = new KubernetesBuildAdapter({
    client: client as any,
    signingKey,
    egressPolicy: { entries: [], hosts: [{ pattern: 'registry.npmjs.org', ports: [443] }] },
    timeoutSeconds: 600
  });
  let ctx = createCtx();
  mocks.ctx = ctx;
  vi.spyOn(adapter as any, 'resolveBuildRun').mockResolvedValue(createRun(ctx));

  let queues = adapter as any;
  return {
    client,
    adapter,
    ctx,
    monitorQueue: queues.monitorBuildQueue,
    endQueue: queues.buildEndedQueue
  };
};

describe('KubernetesBuildAdapter', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
      timeoutSeconds: 600
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
    expect(decoded.exp - decoded.iat).toBe(600 + 300);
    expect(decoded).not.toHaveProperty('allowAll');

    expect(monitorQueue.add).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'fwor_1',
        setupStepOid: 1n,
        artifactData: { fwos_up: { bucket: 'artifacts', storageKey: 'fwor_1/fwos_up' } }
      }),
      { delay: 1000 }
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

    expect(client.build.logs).toHaveBeenLastCalledWith({
      runId: 'fwor_1',
      cursor: undefined,
      limit: 1000
    });
    expect(ctx.startRun).toHaveBeenCalled();
    let second = monitorQueue.add.mock.calls[1];
    expect(second[1]).toEqual({ delay: 500 });
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

    expect(client.build.logs).toHaveBeenLastCalledWith({
      runId: 'fwor_1',
      cursor: 'cursor-1',
      limit: 1000
    });
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
    expect(ended).toMatchObject({ runId: 'fwor_1', timedOut: undefined });

    client.build.get.mockResolvedValueOnce(build('succeeded', { exitCode: 0 }));
    await endQueue.handler(ended);

    expect(ctx.completeBuild).toHaveBeenCalledWith({
      status: 'succeeded',
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

    client.build.get.mockResolvedValueOnce(build('pending'));
    client.build.logs.mockResolvedValueOnce({ lines: [], nextCursor: '' });

    await monitorQueue.handler(first);

    expect(monitorQueue.add.mock.calls[1]).toEqual([
      expect.objectContaining({ cursor: 'cursor-1' }),
      { delay: 2500 }
    ]);
    expect(endQueue.add).not.toHaveBeenCalled();
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
    expect(ctx.completeBuild).toHaveBeenCalledWith({ status: 'failed', stepArtifacts: [] });
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
    expect(ended).toMatchObject({ timedOut: true, logStepOid: 2n });
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

  it('fails the run when the cluster-manager rejects the build', async () => {
    let { adapter, client, ctx, monitorQueue } = setup();
    client.build.start.mockRejectedValueOnce(serviceError(400, 'invalid_data'));

    await adapter.startBuild('fwor_1');

    expect(ctx.startStep).toHaveBeenCalledWith({ stepId: 'fwos_setup' });
    expect(ctx.storeTempOutput).toHaveBeenCalledWith({
      stepOid: 1n,
      message: expect.stringContaining('Build failed:')
    });
    expect(ctx.completeBuild).toHaveBeenCalledWith({ status: 'failed' });
    expect(monitorQueue.add).not.toHaveBeenCalled();
  });

  it('retries the start job on transient cluster-manager errors', async () => {
    let { adapter, client, ctx, monitorQueue } = setup();
    client.build.start.mockRejectedValueOnce(serviceError(503, 'service_unavailable'));

    await expect(adapter.startBuild('fwor_1')).rejects.toThrow();

    expect(ctx.completeBuild).not.toHaveBeenCalled();
    expect(monitorQueue.add).not.toHaveBeenCalled();
  });
});
