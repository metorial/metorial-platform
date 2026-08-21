import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({ db: {}, getImageUrl: vi.fn() }));
vi.mock('@metorial-subspace/db', () => ({}));
import { v1ProviderTriggerPresenter } from './providerTrigger';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

let verification = {
  mechanism: 'hub',
  baseline: 'receiver_path_secret',
  allowedSecretRefs: [
    {
      source: 'auth_config',
      name: 'webhook.signing_secret',
      credentialKey: 'signingSecret',
      authMethods: ['slack.oauth'],
      encoding: 'utf8'
    }
  ],
  rules: [
    {
      id: 'delivery',
      phase: 'delivery',
      when: { methods: ['POST'] },
      verify: { type: 'preset', preset: 'slack.v0' },
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
    }
  ]
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

describe('v1ProviderTriggerPresenter I1 callback contract', () => {
  it('preserves event types and auth-backed verification references', async () => {
    let result = await present(trigger());

    expect(result).toMatchObject({
      event_types: ['event.created', 'event.updated'],
      invocation: {
        type: 'webhook',
        http: {
          verification: {
            mechanism: 'hub',
            allowedSecretRefs: [
              {
                source: 'auth_config',
                credentialKey: 'signingSecret',
                authMethods: ['slack.oauth']
              }
            ],
            rules: [{ id: 'delivery' }]
          }
        }
      }
    });
    expect(v1ProviderTriggerPresenter.schema.validate(result).success).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/ciphertext|plaintext|secretVersion|receipt/i);
  });

  it('normalizes legacy rows without invocation.http to explicit null verification', async () => {
    let legacy = trigger();
    delete (legacy.invocation as { http?: unknown }).http;

    await expect(present(legacy)).resolves.toMatchObject({
      invocation: { type: 'webhook', http: { verification: null } }
    });
  });

  it.each([
    [
      'removed config secret source',
      {
        ...verification,
        allowedSecretRefs: [
          { source: 'config', name: 'legacy', configKey: 'secret', encoding: 'utf8' }
        ]
      }
    ],
    ['private fields', { ...verification, privateValue: 'raw-secret-sentinel' }],
    ['partial declaration', { mechanism: 'hub' }]
  ])('rejects %s before public presentation', async (_label, declaration) => {
    let error = await present(trigger({ verification: declaration })).catch(value => value);
    expect(error).toBeInstanceOf(TypeError);
    expect(String(error)).toContain('invalid webhook verification declaration');
    expect(String(error)).not.toContain('raw-secret-sentinel');
  });
});
