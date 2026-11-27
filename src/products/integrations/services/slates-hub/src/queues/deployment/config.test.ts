import { beforeEach, describe, expect, it, vi } from 'vitest';

let edition = vi.hoisted(() => ({ current: 'cloud' }));

vi.mock('@metorial/editions', () => ({
  checkEdition: (...allowed: string[]) => allowed.includes(edition.current)
}));

import { resolveSlateDeploymentConfig } from './config';

beforeEach(() => {
  edition.current = 'cloud';
});

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
      disableNetworkIsolation: false,
      concurrency: 'shared'
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
      disableNetworkIsolation: true,
      concurrency: 'shared'
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
      disableNetworkIsolation: true,
      concurrency: 'shared'
    });
  });

  it('always isolates the network on-prem, even when the manifest opts out', () => {
    edition.current = 'on-prem';

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
      disableNetworkIsolation: false,
      concurrency: 'shared'
    });
  });

  it('isolates the network on-prem when the manifest omits it', () => {
    edition.current = 'on-prem';

    expect(
      resolveSlateDeploymentConfig({
        manifest: {
          name: '@demo/weather',
          version: '1.0.0'
        },
        defaultMemorySizeMb: 512,
        defaultTimeoutSeconds: 60
      }).disableNetworkIsolation
    ).toBe(false);
  });
});
