import { computeWebhookActionSpecHashV1 } from '@slates/proto';
import { describe, expect, it } from 'vitest';
import {
  combineWebhookCapturePolicyProjections,
  projectStoredWebhookActionCapturePolicy
} from './webhookCapturePolicy';

let action = (rules: any[]) => {
  let value: any = {
    id: 'action_1',
    type: 'action.trigger',
    capabilities: { webhookInboundVerificationV1: true },
    invocation: {
      type: 'webhook',
      autoRegistration: false,
      autoUnregistration: false,
      http: {
        ingress: {
          kind: 'receiver_route',
          baseline: 'receiver_path_secret',
          verification: {
            mechanism: 'hub',
            baseline: 'receiver_path_secret',
            allowedSecretRefs: [
              {
                name: 'signing',
                source: 'config',
                configKey: 'webhookSigningSecret',
                encoding: 'utf8'
              }
            ],
            rules
          }
        }
      }
    }
  };
  try {
    value.specHash = computeWebhookActionSpecHashV1(value);
  } catch {
    value.specHash = '0'.repeat(64);
  }
  return value;
};

let rule = (overrides: Record<string, unknown> = {}) => ({
  id: 'delivery.v1',
  phase: 'delivery',
  when: { methods: ['POST'] },
  verify: {
    type: 'raw_hmac',
    secretName: 'signing',
    algorithm: 'sha256',
    signature: {
      headerName: 'X-Signature',
      encoding: 'hex',
      duplicateHeaderPolicy: 'reject',
      multipleSignaturePolicy: 'reject'
    },
    message: [{ source: 'body' }]
  },
  result: { type: 'dispatch', scope: 'receiver_trigger' },
  replay: {
    kind: 'enforced',
    deduplicate: {
      source: 'header',
      headerName: 'X-Delivery-Id',
      ttlSeconds: 60,
      scope: 'request'
    }
  },
  ...overrides
});

describe('stored webhook capture policy projection', () => {
  it('defaults to one MiB and accepts an explicit reviewed larger limit', () => {
    expect(
      projectStoredWebhookActionCapturePolicy({
        action: action([rule()]),
        registrationStatus: 'registered',
        method: 'POST'
      }).maxBodyBytes
    ).toBe(1024 * 1024);
    expect(
      projectStoredWebhookActionCapturePolicy({
        action: action([rule({ maxBodyBytes: 2 * 1024 * 1024 })]),
        registrationStatus: 'registered',
        method: 'POST'
      }).maxBodyBytes
    ).toBe(2 * 1024 * 1024);
  });

  it.each([0, 10 * 1024 * 1024 + 1])('fails closed for invalid limit %s', maxBodyBytes => {
    expect(() =>
      projectStoredWebhookActionCapturePolicy({
        action: action([rule({ maxBodyBytes })]),
        registrationStatus: 'registered',
        method: 'POST'
      })
    ).toThrow('capture policy is invalid');
  });

  it('permits only the reviewed signature multi-value grammar', () => {
    let multi = rule({
      verify: {
        ...(rule().verify as any),
        signature: {
          ...(rule().verify as any).signature,
          duplicateHeaderPolicy: 'preserve',
          multipleSignaturePolicy: 'any_valid'
        }
      }
    });
    let projection = projectStoredWebhookActionCapturePolicy({
      action: action([multi]),
      registrationStatus: 'registered',
      method: 'POST'
    });
    expect(projection.duplicateSecurityHeaders).toEqual([
      { headerName: 'x-signature', grammar: 'signature_multi_value_v1' }
    ]);
  });

  it('rejects zero, ambiguous, inconsistent, and stale projections', () => {
    expect(() =>
      projectStoredWebhookActionCapturePolicy({
        action: action([rule()]),
        registrationStatus: 'registered',
        method: 'GET'
      })
    ).toThrow('No stored webhook rule');

    let ambiguous = action([
      rule({ id: 'first' }),
      rule({ id: 'second', maxBodyBytes: 2 * 1024 * 1024 })
    ]);
    expect(() =>
      projectStoredWebhookActionCapturePolicy({
        action: ambiguous,
        registrationStatus: 'registered',
        method: 'POST'
      })
    ).toThrow('ambiguous capture policies');

    let first = projectStoredWebhookActionCapturePolicy({
      action: action([rule({ id: 'first' })]),
      registrationStatus: 'registered',
      method: 'POST'
    });
    let second = projectStoredWebhookActionCapturePolicy({
      action: action([rule({ id: 'second', maxBodyBytes: 2 * 1024 * 1024 })]),
      registrationStatus: 'registered',
      method: 'POST'
    });
    expect(() => combineWebhookCapturePolicyProjections([first, second])).toThrow(
      'inconsistent capture policies'
    );

    let stale = action([rule()]);
    stale.specHash = 'f'.repeat(64);
    expect(() =>
      projectStoredWebhookActionCapturePolicy({
        action: stale,
        registrationStatus: 'registered',
        method: 'POST'
      })
    ).toThrow('hash is stale');
  });
});
