import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({ db: {}, getImageUrl: vi.fn() }));
import { v1ProviderTriggerPresenter } from './providerTrigger';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

let hubRule = (id: string, method: 'POST' | 'PUT') => ({
  id,
  phase: 'delivery',
  when: { methods: [method] },
  verify: { type: 'preset', preset: 'stripe.v1' },
  result: { type: 'dispatch', scope: 'receiver_trigger' },
  replay: {
    kind: 'enforced',
    freshness: {
      source: 'preset',
      presetField: 'timestamp',
      format: 'unix_seconds',
      maxAgeSeconds: 300,
      maxFutureSkewSeconds: 30
    }
  }
});

let verification = {
  mechanism: 'hub',
  baseline: 'receiver_path_secret',
  allowedSecretRefs: [
    {
      source: 'generated',
      name: 'webhook.signing.secret',
      binding: 'receiver_trigger',
      encoding: 'base64url'
    }
  ],
  rules: [hubRule('first.delivery', 'POST'), hubRule('second.delivery', 'PUT')]
};

let trigger = (http: unknown = { verification }) => ({
  id: 'provider-trigger-1',
  key: 'events.created',
  name: 'Events Created',
  description: null,
  inputJsonSchema: {},
  outputJsonSchema: {},
  eventTypes: ['event.created', 'event.updated'],
  invocation: {
    type: 'webhook',
    autoRegistration: { status: 'supported' },
    autoUnregistration: { status: 'unsupported' },
    http
  },
  providerId: 'provider-1',
  specificationId: 'provider-specification-1',
  createdAt: new Date('2026-08-14T12:00:00.000Z'),
  updatedAt: new Date('2026-08-14T12:00:00.000Z')
});

let present = (value: ReturnType<typeof trigger>) =>
  v1ProviderTriggerPresenter.present({ trigger: value as never }, context).run();

describe('v1ProviderTriggerPresenter verification declaration', () => {
  it('preserves the exact closed declaration and ordered rules in the public API', async () => {
    let result = await present(trigger());

    expect(result.invocation).toMatchObject({
      type: 'webhook',
      http: {
        verification: {
          mechanism: 'hub',
          allowedSecretRefs: [
            {
              source: 'generated',
              name: 'webhook.signing.secret',
              binding: 'receiver_trigger',
              encoding: 'base64url'
            }
          ],
          rules: [{ id: 'first.delivery' }, { id: 'second.delivery' }]
        }
      }
    });
    expect(result).not.toHaveProperty('verification_enforcement');
    expect(result).not.toHaveProperty('verification_readiness');
    expect(result.event_types).toEqual(['event.created', 'event.updated']);
    expect(v1ProviderTriggerPresenter.schema.validate(result).success).toBe(true);
  });

  it('uses the canonical closed protocol for the public schema itself', async () => {
    let result = await present(trigger());
    if (result.invocation.type !== 'webhook' || !result.invocation.http.verification) {
      throw new Error('Expected a webhook verification declaration');
    }
    let declaration = result.invocation.http.verification;

    let emptyRules = {
      ...result,
      invocation: {
        ...result.invocation,
        http: { verification: { ...declaration, rules: [] } }
      }
    };
    expect(v1ProviderTriggerPresenter.schema.validate(emptyRules).success).toBe(false);

    let privateExtra = {
      ...result,
      invocation: {
        ...result.invocation,
        http: {
          verification: {
            ...declaration,
            rawSecret: 'raw-secret-sentinel'
          }
        }
      }
    };
    expect(v1ProviderTriggerPresenter.schema.validate(privateExtra).success).toBe(false);
  });

  it('normalizes legacy public list/get rows that omitted invocation.http', async () => {
    let legacy = trigger();
    delete (legacy.invocation as { http?: unknown }).http;

    await expect(present(legacy)).resolves.toMatchObject({
      invocation: { type: 'webhook', http: { verification: null } }
    });
  });

  it('preserves an explicit undeclared verification as null', async () => {
    await expect(present(trigger({ verification: null }))).resolves.toMatchObject({
      invocation: { type: 'webhook', http: { verification: null } }
    });
  });

  it.each([
    [
      'private registration fields',
      {
        verification: {
          ...verification,
          registrationDetails: { secret: 'raw-secret-sentinel' },
          private: true
        }
      }
    ],
    ['unknown HTTP fields', { verification, rawSecret: 'raw-secret-sentinel' }],
    ['a partial declaration', { verification: { mechanism: 'hub' } }]
  ])('rejects %s before public presentation', async (_label, http) => {
    let error = await present(trigger(http)).catch(value => value);
    expect(error).toBeInstanceOf(TypeError);
    expect(String(error)).toContain('invalid webhook verification declaration');
    expect(String(error)).not.toContain('raw-secret-sentinel');
  });
});
