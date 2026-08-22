import { describe, expect, it } from 'vitest';
import {
  projectSlatesSpecificationTriggerWebhookHttp,
  projectStoredSpecificationTriggerWebhookHttp
} from './webhookVerification';

let verification = {
  mechanism: 'hub' as const,
  baseline: 'receiver_path_secret' as const,
  allowedSecretRefs: [
    {
      source: 'auth_config' as const,
      name: 'webhook.signing_secret',
      credentialKey: 'signingSecret',
      authMethods: ['oauth'],
      encoding: 'utf8' as const
    }
  ],
  rules: [
    {
      id: 'delivery',
      phase: 'delivery' as const,
      when: { methods: ['POST' as const] },
      verify: { type: 'preset' as const, preset: 'slack.v0' as const },
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

describe('webhook verification projection', () => {
  it('projects a receiver-route declaration and preserves I1 auth references', () => {
    expect(
      projectSlatesSpecificationTriggerWebhookHttp({
        ingress: {
          kind: 'receiver_route',
          baseline: 'receiver_path_secret',
          verification
        }
      })
    ).toEqual({ verification });
  });

  it('represents an absent optional HTTP declaration without inventing verification', () => {
    expect(projectSlatesSpecificationTriggerWebhookHttp(undefined)).toEqual({
      verification: null
    });
    expect(projectStoredSpecificationTriggerWebhookHttp(undefined)).toEqual({
      verification: null
    });
  });

  it.each([
    [{ verification, privateValue: 'secret' }],
    [{ verification: { mechanism: 'hub' } }],
    [{ verification: null, nested: {} }]
  ])('rejects a non-canonical stored declaration', value => {
    expect(() => projectStoredSpecificationTriggerWebhookHttp(value)).toThrow(
      'invalid webhook verification declaration'
    );
  });

  it('does not project shared provisioned-app ingress into receiver metadata', () => {
    expect(() =>
      projectSlatesSpecificationTriggerWebhookHttp({
        ingress: {
          kind: 'shared_provisioned_app',
          baseline: 'app_route_secret',
          routeFamily: 'slack.events',
          verification: {
            mechanism: 'hub',
            allowedSecretRefs: [],
            rules: verification.rules
          }
        }
      })
    ).toThrow('invalid webhook verification declaration');
  });
});
