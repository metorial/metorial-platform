import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  send: vi.fn(),
  getPublicURL: vi.fn()
}));

vi.mock('@lowerdeck/queue', async importOriginal => ({
  ...(await importOriginal<typeof import('@lowerdeck/queue')>()),
  createQueue: (opts: { name: string }) => ({
    name: opts.name,
    add: vi.fn(async () => ({})),
    addMany: vi.fn(async () => {}),
    process: vi.fn(() => ({}))
  }),
  combineQueueProcessors: () => ({})
}));

vi.mock('../../env', () => ({
  env: {
    service: { REDIS_URL: 'redis://localhost:6379' },
    provider: { DEFAULT_PROVIDER: 'aws.code-build' },
    codeBuild: {},
    storage: { ARTIFACT_BUCKET_NAME: 'artifacts', LOG_BUCKET_NAME: 'logs' }
  }
}));

vi.mock('../../storage', () => ({ storage: { getPublicURL: mocks.getPublicURL } }));

vi.mock('../_lib/buildContext', () => ({ BuildContext: { of: vi.fn() } }));

vi.mock('./codeBuild', () => ({ codebuild: { send: mocks.send }, logsClient: {} }));

vi.mock('./project', () => ({
  ensureProject: async () => ({ projectName: 'metorial-forge' })
}));

vi.mock('./access', () => ({ checkCodeBuildAccess: vi.fn() }));

let { AwsCodeBuildAdapter } = await import('./index');

let artifact = (oid: number, name: string) => ({
  oid: BigInt(oid),
  id: `wfa_${oid}`,
  name,
  bucket: 'artifacts',
  storageKey: `run_1/${name}`
});

let versionStep = (d: Record<string, any>) => ({
  initScript: [],
  actionScript: [],
  cleanupScript: [],
  artifactToDownload: null,
  artifactToDownloadPath: null,
  artifactToUploadPath: null,
  artifactToUploadName: null,
  ...d
});

let runStep = (id: string, type: string, step: Record<string, any> | null = null) => ({
  id,
  oid: BigInt(id.replace(/\D/g, '') || 0),
  type,
  step: step ? versionStep(step) : null
});

let createRun = (d: {
  artifacts?: ReturnType<typeof artifact>[];
  initSteps?: ReturnType<typeof runStep>[];
  actionSteps?: ReturnType<typeof runStep>[];
  cleanupSteps?: ReturnType<typeof runStep>[];
  envVars?: Record<string, string>;
}) => {
  let uploadNo = 0;

  return {
    ctx: {
      run: { id: 'wfr_1' },
      getArtifactUploadInfo: vi.fn(async () => {
        uploadNo++;
        return {
          bucket: 'artifacts',
          storageKey: `wfr_1/upload${uploadNo}`,
          uploadUrl: `https://storage.test/artifacts/wfr_1/upload${uploadNo}?X-Sig=it's`,
          uploadHeaders: { 'x-amz-meta-run': 'wfr_1', 'x-quote': "a'b" }
        };
      })
    },
    artifacts: d.artifacts ?? [],
    runtimeEnv: {
      ...d.envVars,
      WORKFLOW_RUN_ID: 'wfr_1',
      WORKFLOW_VERSION_ID: 'wfv_1',
      RUNTIME: 'metorial-forge@1.0.0'
    },
    setupStep: runStep('wfrs_setup0', 'setup'),
    teardownStep: runStep('wfrs_teardown99', 'teardown'),
    initSteps: d.initSteps ?? [],
    actionSteps: d.actionSteps ?? [],
    cleanupSteps: d.cleanupSteps ?? []
  };
};

let renderBuildspec = async (run: ReturnType<typeof createRun>) => {
  let adapter = new AwsCodeBuildAdapter();
  vi.spyOn(adapter as any, 'resolveBuildRun').mockResolvedValue(run);

  await adapter.startBuild('wfr_1');

  let command = mocks.send.mock.calls.at(-1)![0];
  return {
    buildspec: command.input.buildspecOverride as string,
    env: command.input.environmentVariablesOverride,
    queued: (adapter as any).waitForBuildQueue.add.mock.calls[0][0]
  };
};

describe('CodeBuild buildspec', () => {
  beforeEach(() => {
    mocks.send.mockReset();
    mocks.send.mockResolvedValue({ build: { id: 'build-1' } });
    mocks.getPublicURL.mockReset();
    mocks.getPublicURL.mockImplementation(async (bucket: string, key: string) => ({
      url: `https://storage.test/${bucket}/${key}?X-Sig=abc&x=1`,
      headers: {}
    }));
  });

  it('renders a minimal workflow', async () => {
    let result = await renderBuildspec(
      createRun({
        actionSteps: [
          runStep('wfrs_1', 'action', { type: 'script', actionScript: ['echo build'] })
        ]
      })
    );

    await expect(result.buildspec).toMatchFileSnapshot('__snapshots__/minimal.buildspec.yml');
    expect(result.queued).toEqual({
      runId: 'wfr_1',
      buildId: 'build-1',
      attemptNo: 1,
      artifactData: {}
    });
  });

  it('renders a workflow with every step type', async () => {
    let result = await renderBuildspec(
      createRun({
        envVars: { NODE_ENV: 'production', QUOTED: "it's" },
        artifacts: [artifact(11, 'input.zip'), artifact(12, 'extra.zip')],
        initSteps: [
          runStep('wfrs_2', 'init', { type: 'script', initScript: ['npm ci', "echo 'init'"] }),
          runStep('wfrs_3', 'init', null)
        ],
        actionSteps: [
          runStep('wfrs_4', 'action', {
            type: 'script',
            actionScript: ['bun run build', 'ls -la ./output']
          }),
          runStep('wfrs_5', 'action', {
            type: 'download_artifact',
            artifactToDownload: artifact(13, 'bundle.tar'),
            artifactToDownloadPath: "./vendor/it's bundle.tar"
          }),
          runStep('wfrs_6', 'action', {
            type: 'upload_artifact',
            artifactToUploadName: 'output.zip',
            artifactToUploadPath: './output/output.zip'
          }),
          runStep('wfrs_7', 'action', { type: 'script', actionScript: [] }),
          runStep('wfrs_8', 'action', null),
          runStep('wfrs_9', 'action', {
            type: 'upload_artifact',
            artifactToUploadName: 'second.zip',
            artifactToUploadPath: './output/second file.zip'
          })
        ],
        cleanupSteps: [
          runStep('wfrs_10', 'cleanup', { type: 'script', cleanupScript: ['rm -rf ./tmp'] }),
          runStep('wfrs_11', 'cleanup', null)
        ]
      })
    );

    await expect(result.buildspec).toMatchFileSnapshot('__snapshots__/full.buildspec.yml');
    expect(result.env).toEqual([
      { name: 'NODE_ENV', value: 'production', type: 'PLAINTEXT' },
      { name: 'QUOTED', value: "it's", type: 'PLAINTEXT' },
      { name: 'WORKFLOW_RUN_ID', value: 'wfr_1', type: 'PLAINTEXT' },
      { name: 'WORKFLOW_VERSION_ID', value: 'wfv_1', type: 'PLAINTEXT' },
      { name: 'RUNTIME', value: 'metorial-forge@1.0.0', type: 'PLAINTEXT' }
    ]);
    expect(result.queued.artifactData).toEqual({
      wfrs_6: { bucket: 'artifacts', storageKey: 'wfr_1/upload1' },
      wfrs_9: { bucket: 'artifacts', storageKey: 'wfr_1/upload2' }
    });
    expect(mocks.getPublicURL).toHaveBeenCalledWith('artifacts', 'run_1/input.zip', 21600);
  });

  it('fails when a download step has no artifact', async () => {
    await expect(
      renderBuildspec(
        createRun({
          actionSteps: [runStep('wfrs_1', 'action', { type: 'download_artifact' })]
        })
      )
    ).rejects.toThrow('Artifact to download not found');
  });
});
