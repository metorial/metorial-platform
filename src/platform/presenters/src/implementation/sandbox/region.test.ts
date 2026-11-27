import { afterEach, describe, expect, it, vi } from 'vitest';
import { v1SandboxRegionPresenter } from './region';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

afterEach(() => vi.unstubAllEnvs());

describe('sandbox default region', () => {
  it.each([
    ['dev', 'dev', 'dev'],
    ['us1', 'aws:us-east-1', 'iad1'],
    ['eu1', 'aws:eu-west-1', 'dub1']
  ])('uses the %s deployment default', async (deployment, id, identifier) => {
    vi.stubEnv('METORIAL_REGION', deployment);

    let present = (regionId: string) =>
      v1SandboxRegionPresenter
        .present(
          {
            region: {
              id: regionId,
              identifier,
              name: 'Region',
              areaId: 'area',
              areaName: 'Area'
            } as any
          },
          context
        )
        .run();

    expect((await present(id)).is_default).toBe(true);
    expect((await present('other')).is_default).toBe(false);
  });
});
