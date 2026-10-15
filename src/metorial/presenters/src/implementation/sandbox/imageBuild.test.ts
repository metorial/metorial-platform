import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-sandbox', () => ({
  sandboxFailureCodes: ['internal_error'],
  sandboxBuildFailureCodes: ['internal_error'],
  mapSandboxBuildFailure: vi.fn(() => null)
}));

import { v1SandboxImageBuildPresenter } from './imageBuild';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

let localBuild = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'sbb_1',
    image: { id: 'img_1' },
    version: { id: 'imv_1', versionNumber: 3 },
    sourceFile: { id: 'file_1' },
    status: 'succeeded',
    failureCode: null,
    failureMessage: null,
    options: {
      dockerfilePath: 'Dockerfile.prod',
      contextPath: 'app',
      target: 'runtime',
      buildArgNames: ['NODE_ENV', 'TOKEN'],
      timeoutSeconds: 900
    },
    diskSizeBytes: 1073741824n,
    regions: [
      {
        kind: 'builder',
        status: 'succeeded',
        logStreamId: 'log_1',
        region: { identifier: 'us-east-1' }
      }
    ],
    contextUploadedAt: new Date('2026-01-01T00:00:10Z'),
    builtAt: new Date('2026-01-01T00:05:00Z'),
    endedAt: new Date('2026-01-01T00:06:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides
  }) as any;

describe('v1SandboxImageBuildPresenter', () => {
  it('exposes the build settings and version number', async () => {
    let result = await v1SandboxImageBuildPresenter
      .present({ build: localBuild() }, context)
      .run();

    expect(result).toMatchObject({
      object: 'sandbox.image.build',
      id: 'sbb_1',
      image_id: 'img_1',
      version_id: 'imv_1',
      version_number: 3,
      file_id: 'file_1',
      dockerfile_path: 'Dockerfile.prod',
      context_path: 'app',
      target: 'runtime',
      build_arg_names: ['NODE_ENV', 'TOKEN'],
      timeout_seconds: 900,
      disk_size_bytes: 1073741824,
      has_logs: true,
      context_uploaded_at: new Date('2026-01-01T00:00:10Z')
    });
  });

  it('never exposes build argument values', async () => {
    let result = await v1SandboxImageBuildPresenter
      .present({ build: localBuild() }, context)
      .run();

    expect(result).not.toHaveProperty('build_args');
  });

  it('reports null settings for builds that predate them', async () => {
    let result = await v1SandboxImageBuildPresenter
      .present(
        {
          build: localBuild({
            options: null,
            regions: [],
            contextUploadedAt: null,
            sourceFile: null,
            version: { id: 'imv_1', versionNumber: null }
          })
        },
        context
      )
      .run();

    expect(result).toMatchObject({
      version_number: null,
      file_id: null,
      dockerfile_path: null,
      context_path: null,
      target: null,
      build_arg_names: null,
      timeout_seconds: null,
      has_logs: false,
      context_uploaded_at: null
    });
  });

  it('presents a null target and an empty argument list as recorded', async () => {
    let result = await v1SandboxImageBuildPresenter
      .present(
        {
          build: localBuild({
            options: {
              dockerfilePath: 'Dockerfile',
              contextPath: '.',
              target: null,
              buildArgNames: [],
              timeoutSeconds: 600
            }
          })
        },
        context
      )
      .run();

    expect(result.target).toBeNull();
    expect(result.build_arg_names).toEqual([]);
    expect(result.dockerfile_path).toBe('Dockerfile');
  });
});
