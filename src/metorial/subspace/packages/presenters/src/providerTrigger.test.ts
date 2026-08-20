import { describe, expect, it } from 'vitest';
import { providerTriggerPresenter } from './providerTrigger';

let providerRule = (id: string, method: 'POST' | 'PUT') => ({
  id,
  phase: 'delivery',
  when: { methods: [method] },
  verify: {
    type: 'provider',
    verifierId: 'quickbooks.delivery.v1',
    allowedSecretRefs: [],
    allowedBootstrapCaptureRefs: []
  },
  result: { type: 'dispatch', scope: 'receiver_trigger' },
  replay: {
    kind: 'enforced',
    deduplicate: {
      source: 'preset',
      presetField: 'event_id',
      ttlSeconds: 300,
      scope: 'request'
    }
  }
});

let verification = {
  mechanism: 'provider',
  baseline: 'receiver_path_secret',
  reason: 'The supported vendor API performs verification.',
  allowedSecretRefs: [],
  rules: [providerRule('first.delivery', 'POST'), providerRule('second.delivery', 'PUT')]
};

let providerTrigger = (http: unknown = { verification }) => ({
  id: 'provider-trigger-1',
  key: 'events.created',
  name: 'Events Created',
  description: 'Receives created events',
  value: {
    inputJsonSchema: {},
    outputJsonSchema: {},
    scopes: null,
    invocation: {
      type: 'webhook',
      autoRegistration: true,
      autoUnregistration: false,
      http
    }
  },
  provider: { id: 'provider-1' },
  specification: { id: 'provider-specification-1' },
  createdAt: new Date('2026-08-14T12:00:00.000Z'),
  updatedAt: new Date('2026-08-14T12:00:00.000Z')
});

describe('providerTriggerPresenter', () => {
  it('preserves the exact verification declaration', () => {
    let result = providerTriggerPresenter(providerTrigger() as never);

    expect(result.invocation).toMatchObject({
      type: 'webhook',
      http: {
        verification: {
          mechanism: 'provider',
          rules: [{ id: 'first.delivery' }, { id: 'second.delivery' }]
        }
      }
    });
    expect(result.invocation).not.toHaveProperty('status');
  });

  it('normalizes legacy list/get rows that omitted invocation.http', () => {
    let legacy = providerTrigger();
    delete (legacy.value.invocation as { http?: unknown }).http;

    expect(providerTriggerPresenter(legacy as never).invocation).toMatchObject({
      type: 'webhook',
      http: { verification: null }
    });
  });

  it('preserves an explicit undeclared verification as null', () => {
    expect(
      providerTriggerPresenter(providerTrigger({ verification: null }) as never).invocation
    ).toMatchObject({
      type: 'webhook',
      http: { verification: null }
    });
  });

  it.each([
    [
      'registration details',
      {
        verification: {
          ...verification,
          registrationDetails: { signingSecret: 'raw-secret-sentinel' }
        }
      }
    ],
    ['unknown HTTP fields', { verification, private: 'raw-secret-sentinel' }]
  ])('rejects stored %s rather than forwarding it', (_label, http) => {
    expect(() => providerTriggerPresenter(providerTrigger(http) as never)).toThrow(
      'invalid webhook verification declaration'
    );
  });
});
