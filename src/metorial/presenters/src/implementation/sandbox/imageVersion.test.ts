import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-sandbox', () => ({
  sandboxFailureCodes: ['internal_error'],
  sandboxBuildFailureCodes: ['internal_error']
}));

import { v1SandboxImageVersionPresenter } from './imageVersion';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

let localVersion = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'imv_1',
    versionNumber: 2,
    status: 'active',
    builds: [{ id: 'sbb_2' }],
    regions: [
      { region: { identifier: 'us-east-1' } },
      { region: { identifier: 'eu-west-1' } }
    ],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides
  }) as any;

describe('v1SandboxImageVersionPresenter', () => {
  it('exposes the version number and the producing build', async () => {
    let result = await v1SandboxImageVersionPresenter
      .present({ image: { id: 'img_1' } as any, version: localVersion() }, context)
      .run();

    expect(result).toMatchObject({
      object: 'sandbox.image.version',
      id: 'imv_1',
      image_id: 'img_1',
      version_number: 2,
      build_id: 'sbb_2',
      regions: ['us-east-1', 'eu-west-1']
    });
  });

  it('has no build for versions of global images', async () => {
    let result = await v1SandboxImageVersionPresenter
      .present(
        { image: { id: 'img_1' } as any, version: localVersion({ builds: [] }) },
        context
      )
      .run();

    expect(result.build_id).toBeNull();
  });

  it('reports a null number for versions that are not numbered yet', async () => {
    let result = await v1SandboxImageVersionPresenter
      .present(
        { image: { id: 'img_1' } as any, version: localVersion({ versionNumber: null }) },
        context
      )
      .run();

    expect(result.version_number).toBeNull();
  });
});
