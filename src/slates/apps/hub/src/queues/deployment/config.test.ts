import { describe, expect, it } from 'vitest';
import { resolveSlateDeploymentConfig } from './config';

describe('resolveSlateDeploymentConfig', () => {
  it('uses manifest deployment settings when provided', () => {
    expect(
      resolveSlateDeploymentConfig({
        manifest: {
          name: '@demo/weather',
          version: '1.0.0',
          networkIsolation: true,
          timeout: 45
        },
        defaultMemorySizeMb: 512,
        defaultTimeoutSeconds: 60
      })
    ).toEqual({
      memorySizeMb: 512,
      timeoutSeconds: 45,
      disableNetworkIsolation: false
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
      timeoutSeconds: 60,
      disableNetworkIsolation: true
    });
  });

  it('keeps network isolation disabled when the manifest explicitly opts out', () => {
    expect(
      resolveSlateDeploymentConfig({
        manifest: {
          name: '@demo/weather',
          version: '1.0.0',
          networkIsolation: false
        },
        defaultMemorySizeMb: 512,
        defaultTimeoutSeconds: 60
      })
    ).toEqual({
      memorySizeMb: 512,
      timeoutSeconds: 60,
      disableNetworkIsolation: true
    });
  });
});
