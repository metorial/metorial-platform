import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Service } from './index';

let telemetry = vi.hoisted(() => ({
  enabled: false,
  hasSpan: false
}));

vi.mock('@lowerdeck/telemetry', () => ({
  isTelemetryEnabled: () => telemetry.enabled,
  hasActiveSpan: () => telemetry.hasSpan,
  SpanStatusCode: { ERROR: 2, OK: 1, UNSET: 0 },
  trace: {
    getTracer: () => ({
      startActiveSpan: (_name: string, fn: (span: { setStatus: Function; end: Function }) => unknown) =>
        fn({
          setStatus: vi.fn(),
          end: vi.fn()
        })
    })
  }
}));

describe('Service', () => {
  beforeEach(() => {
    telemetry.enabled = false;
    telemetry.hasSpan = false;
  });

  it('keeps class prototype methods', async () => {
    class ExampleService {
      async getValue() {
        return 'ok';
      }
    }

    let service = Service.create('example', () => new ExampleService()).build();

    expect(service.getValue).toBeTypeOf('function');
    await expect(service.getValue()).resolves.toBe('ok');
  });

  it('keeps own methods from plain object services', async () => {
    let service = Service.create('plain-object', () => ({
      async get() {
        return 'get';
      },
      async list() {
        return ['list'];
      }
    })).build();

    expect(service.get).toBeTypeOf('function');
    expect(service.list).toBeTypeOf('function');
    await expect(service.get()).resolves.toBe('get');
    await expect(service.list()).resolves.toEqual(['list']);
  });

  it('rethrows sync service errors instead of wrapping them in a promise', () => {
    telemetry.enabled = true;
    telemetry.hasSpan = true;

    class ExampleService {
      throwSync() {
        throw new Error('already linked');
      }
    }

    let service = Service.create('example', () => new ExampleService()).build();

    expect(() => service.throwSync()).toThrow('already linked');
  });

  it('still rejects async service errors when tracing is active', async () => {
    telemetry.enabled = true;
    telemetry.hasSpan = true;

    class ExampleService {
      async throwAsync() {
        throw new Error('already linked');
      }
    }

    let service = Service.create('example', () => new ExampleService()).build();

    await expect(service.throwAsync()).rejects.toThrow('already linked');
  });
});
