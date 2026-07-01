import { describe, expect, it } from 'bun:test';
import { resolveSlateDeploymentConfig } from './config';

describe('resolveSlateDeploymentConfig', () => {
  it('uses the manifest timeout when provided', () => {
    expect(
      resolveSlateDeploymentConfig({
        manifest: {
          name: '@demo/weather',
          version: '1.0.0',
          timeout: 45
        },
        defaultMemorySizeMb: 512,
        defaultTimeoutSeconds: 60
      })
    ).toEqual({
      memorySizeMb: 512,
      timeoutSeconds: 45
    });
  });

  it('falls back to the default timeout when the manifest omits it', () => {
    expect(
      resolveSlateDeploymentConfig({
        manifest: {
          name: '@demo/weather',
          version: '1.0.0'
        },
        defaultMemorySizeMb: 512,
        defaultTimeoutSeconds: 60
      })
    ).toEqual({
      memorySizeMb: 512,
      timeoutSeconds: 60
    });
  });
});
