import { describe, expect, it } from 'bun:test';
import { generateComposeServices } from './generator';
import type { ResolvedGraph } from '../types';

let graph = (runner: 'service' | 'sidecar'): ResolvedGraph => ({
  name: 'example',
  dir: '/repo/src/systems/example/service',
  entrypoint: '/repo',
  ossRoot: '/repo',
  rootPrefix: 'example',
  deps: [],
  depHosts: {},
  databases: {},
  env: {
    DATABASE_URL: 'postgresql://postgres:postgres@postgres:5432/postgres'
  },
  serviceComposeName: 'example-service',
  testRunnerComposeName: runner === 'sidecar' ? 'example-test' : 'example-service',
  config: {
    control: { name: 'example' },
    service: { port: 52000 },
    test: {
      e2e: {
        command: 'bun test',
        runner
      }
    }
  }
});

describe('generateComposeServices', () => {
  it('keeps prebuilt service-runner tests in the service container', () => {
    let { services } = generateComposeServices(graph('service'), 'example-ci', {
      prebuiltImages: { prefix: 'control', tag: 'test-tag' }
    });

    expect(Object.keys(services).sort()).toEqual(['example-service']);
    expect(services['example-service'].image).toBe('control/example-test:test-tag');
    expect(services['example-service'].container_name).toBe('example-ci-service');
    expect(services['example-service'].healthcheck).toBeUndefined();
  });

  it('keeps prebuilt sidecar tests split from the service container', () => {
    let { services } = generateComposeServices(graph('sidecar'), 'example-ci', {
      prebuiltImages: { prefix: 'control', tag: 'test-tag' }
    });

    expect(Object.keys(services).sort()).toEqual(['example-service', 'example-test']);
    expect(services['example-service'].image).toBe('control/example:test-tag');
    expect(services['example-test'].image).toBe('control/example-test:test-tag');
    expect(services['example-test'].container_name).toBe('example-ci-test');
  });
});
