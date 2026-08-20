import type { ProviderSpecificationGetForProviderParam } from '@metorial-subspace/provider-utils/src/interfaces/providerCapabilities';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderCapabilities } from './capabilities';
import { mapSlatesSpecificationTrigger } from './capabilitiesTrigger';

let mocks = vi.hoisted(() => ({
  findUniqueOrThrow: vi.fn(),
  getSlateVersion: vi.fn(),
  getSlateSpecification: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    slateVersion: {
      findUniqueOrThrow: mocks.findUniqueOrThrow
    }
  }
}));
vi.mock('../client', () => ({
  slates: {
    slateVersion: { get: mocks.getSlateVersion },
    slateSpecification: { get: mocks.getSlateSpecification }
  }
}));
vi.mock('@lowerdeck/error', () => ({
  badRequestError: (value: unknown) => value,
  ServiceError: class ServiceError extends Error {
    constructor(value: unknown) {
      super(JSON.stringify(value));
    }
  }
}));

let verification = {
  mechanism: 'hub' as const,
  baseline: 'receiver_path_secret' as const,
  allowedSecretRefs: [],
  rules: [
    {
      id: 'first.delivery',
      phase: 'delivery' as const,
      when: { methods: ['POST' as const] },
      verify: { type: 'preset' as const, preset: 'stripe.v1' as const },
      result: { type: 'dispatch' as const, scope: 'receiver_trigger' as const },
      replay: {
        kind: 'enforced' as const,
        freshness: {
          source: 'preset' as const,
          presetField: 'timestamp' as const,
          format: 'unix_seconds' as const,
          maxAgeSeconds: 300,
          maxFutureSkewSeconds: 30
        }
      }
    },
    {
      id: 'second.delivery',
      phase: 'delivery' as const,
      when: { methods: ['PUT' as const] },
      verify: { type: 'preset' as const, preset: 'stripe.v1' as const },
      result: { type: 'dispatch' as const, scope: 'receiver_trigger' as const },
      replay: {
        kind: 'enforced' as const,
        freshness: {
          source: 'preset' as const,
          presetField: 'timestamp' as const,
          format: 'unix_seconds' as const,
          maxAgeSeconds: 300,
          maxFutureSkewSeconds: 30
        }
      }
    }
  ]
};

let trigger = (
  http: unknown = {
    methods: ['POST', 'PUT'],
    sync: { mode: 'never' },
    ingress: {
      kind: 'receiver_route',
      baseline: 'receiver_path_secret',
      verification
    }
  }
) => ({
  id: 'slate-trigger-1',
  identifier: 'trigger.identifier',
  key: 'events.created',
  name: 'Events Created',
  description: 'Receives created events',
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  capabilities: { webhookInboundVerificationV1: true },
  metadata: { eventTypes: ['event.created', 'event.updated'] },
  scopes: null,
  invocation: {
    type: 'webhook' as const,
    autoRegistration: true,
    autoUnregistration: true,
    http
  }
});

let loadSpecification = async (triggers: ReturnType<typeof trigger>[]) => {
  mocks.getSlateSpecification.mockResolvedValueOnce({
    id: 'slate-specification-1',
    identifier: 'slate.specification',
    key: 'slate-specification',
    name: 'Slate specification',
    providerInfo: { description: 'Provider description', metadata: {} },
    configSchema: {},
    triggers,
    authMethods: [],
    tools: []
  });

  return new ProviderCapabilities({ backend: {} as never }).getSpecificationForProviderVersion(
    {
      tenant: null,
      provider: {},
      providerVariant: {},
      providerVersion: { slateVersionOid: 1n }
    } as ProviderSpecificationGetForProviderParam
  );
};

describe('Slates provider trigger verification mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 'slate-version-1',
      slate: { id: 'slate-1' }
    });
    mocks.getSlateVersion.mockResolvedValue({
      specification: { specificationId: 'slate-specification-1' }
    });
  });

  it('preserves the exact mechanism and ordered rules through both real capability paths', async () => {
    let result = await loadSpecification([trigger()]);
    expect(result?.status).toBe('success');
    if (!result || result.status !== 'success') throw new Error('Expected a specification');

    let specificationTriggers = result.specification.triggers;
    if (!specificationTriggers) throw new Error('Expected nested specification triggers');
    expect(specificationTriggers).toBe(result.triggers);
    let nested = specificationTriggers[0];
    let topLevel = result.triggers[0];
    expect(nested?.invocation).toEqual(topLevel?.invocation);
    expect(topLevel?.invocation).toMatchObject({
      type: 'webhook',
      http: {
        verification: {
          mechanism: 'hub',
          rules: [{ id: 'first.delivery' }, { id: 'second.delivery' }]
        }
      }
    });
    expect(topLevel?.eventTypes).toEqual(['event.created', 'event.updated']);
  });

  it('normalizes the exact closed legacy HTTP contract to an explicit undeclared value', async () => {
    let result = await loadSpecification([
      trigger({ methods: ['POST'], sync: { mode: 'never' } })
    ]);
    expect(result?.status).toBe('success');
    if (!result || result.status !== 'success') throw new Error('Expected a specification');

    let specificationTriggers = result.specification.triggers;
    if (!specificationTriggers) throw new Error('Expected nested specification triggers');
    expect(specificationTriggers[0]?.invocation).toMatchObject({
      type: 'webhook',
      http: { verification: null }
    });
    expect(result.triggers[0]?.invocation).toEqual(specificationTriggers[0]?.invocation);
  });

  it('also normalizes a legacy trigger that omitted HTTP entirely', async () => {
    let legacy = trigger();
    delete (legacy.invocation as { http?: unknown }).http;
    let result = await loadSpecification([legacy]);
    expect(result?.status).toBe('success');
    if (!result || result.status !== 'success') throw new Error('Expected a specification');

    expect(result.triggers[0]?.invocation).toMatchObject({
      type: 'webhook',
      http: { verification: null }
    });
  });

  it.each([
    ['partial verification', { verification: { mode: 'invalid' } }],
    ['legacy mode', { mode: 'legacy' }],
    ['unknown HTTP field', { methods: ['POST'], private: 'raw-secret-sentinel' }],
    [
      'malformed valid-looking verification',
      {
        ingress: {
          kind: 'receiver_route',
          baseline: 'receiver_path_secret',
          verification: { mechanism: 'hub', baseline: 'receiver_path_secret', rules: [] }
        }
      }
    ],
    [
      'private registration details inside a declaration',
      {
        ingress: {
          kind: 'receiver_route',
          baseline: 'receiver_path_secret',
          verification: {
            ...verification,
            registrationDetails: { secret: 'raw-secret-sentinel' }
          }
        }
      }
    ],
    ['explicit null HTTP', null]
  ])('rejects %s through the real ProviderCapabilities path', async (_label, http) => {
    await expect(loadSpecification([trigger(http)])).rejects.toThrow(
      'invalid webhook verification declaration'
    );
  });

  it('projects a fresh canonical value instead of retaining mutable input objects', () => {
    let source = trigger();
    let mapped = mapSlatesSpecificationTrigger(source);
    expect((mapped.invocation as { http: object }).http).not.toBe(source.invocation.http);
    expect(JSON.stringify(mapped)).not.toContain('raw-secret-sentinel');
  });

  it.each([
    ['missing event types', undefined],
    ['non-array metadata', 'event.created'],
    ['blank event type', ['event.created', '  ']],
    ['duplicate event type', ['event.created', 'event.created']]
  ])('rejects %s', (_label, eventTypes) => {
    let source = trigger();
    source.metadata.eventTypes = eventTypes as never;

    expect(() => mapSlatesSpecificationTrigger(source)).toThrow('invalid eventTypes metadata');
  });
});
