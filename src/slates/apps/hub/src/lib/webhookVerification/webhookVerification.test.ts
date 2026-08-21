import { createHmac } from 'node:crypto';
import type { SlateWebhookVerificationRule, WebhookWireRequest } from '@slates/proto';
import { describe, expect, it } from 'vitest';
import {
  computeWebhookStateHash,
  createInMemoryWebhookAtomicCommitSeam,
  selectExactWebhookRule,
  verifyRawHmac,
  verifyReceiverPathSecret,
  type WebhookAtomicCommitInput
} from '.';

let wire = (d: {
  headers?: [string, string][];
  body?: Uint8Array;
} = {}): WebhookWireRequest => ({
  url: 'https://webhook.example/callback',
  method: 'POST',
  headers: d.headers ?? [],
  body: {
    present: true,
    base64: Buffer.from(d.body ?? new Uint8Array()).toString('base64')
  }
});

describe('verified webhook ingress', () => {
  it('requires one exact matching rule', () => {
    let rule = {
      id: 'delivery',
      phase: 'delivery',
      when: {
        methods: ['POST'],
        registrationStatuses: ['registered']
      },
      verify: {
        type: 'static_token',
        secretName: 'secret',
        selector: { source: 'header', headerName: 'x-token' }
      },
      result: { type: 'dispatch', scope: 'receiver_trigger' },
      replay: {
        kind: 'enforced',
        deduplicate: {
          source: 'header',
          headerName: 'x-id',
          ttlSeconds: 60,
          scope: 'request'
        }
      }
    } as SlateWebhookVerificationRule;

    expect(
      selectExactWebhookRule({
        rules: [rule],
        request: wire(),
        registrationStatus: 'registered'
      })
    ).toMatchObject({ status: 'selected', rule: { id: 'delivery' } });
    expect(
      selectExactWebhookRule({
        rules: [rule, { ...rule, id: 'also-delivery' }],
        request: wire(),
        registrationStatus: 'registered'
      })
    ).toEqual({ status: 'rejected', code: 'ambiguous_rule' });
  });

  it('verifies the path baseline and raw bytes without accepting duplicate signatures', () => {
    expect(
      verifyReceiverPathSecret({ supplied: 'current', activeAndRetiring: ['current'] })
    ).toBe(true);
    expect(
      verifyReceiverPathSecret({ supplied: 'stale', activeAndRetiring: ['current'] })
    ).toBe(false);

    let body = Buffer.from([0, 255, 13, 10]);
    let signature = createHmac('sha256', 'hmac-secret').update(body).digest('hex');
    let verifier = {
      type: 'raw_hmac',
      secretName: 'hmac',
      algorithm: 'sha256',
      signature: {
        headerName: 'x-signature',
        encoding: 'hex',
        prefix: 'sha256=',
        duplicateHeaderPolicy: 'reject',
        multipleSignaturePolicy: 'reject'
      },
      message: [{ source: 'body' }]
    } satisfies Parameters<typeof verifyRawHmac>[0]['verifier'];
    let secrets = [{ name: 'hmac', value: 'hmac-secret', encoding: 'utf8' as const }];

    expect(
      verifyRawHmac({
        request: wire({ body, headers: [['X-Signature', `sha256=${signature}`]] }),
        verifier,
        secrets
      })
    ).toMatchObject({ status: 'accepted' });
    expect(
      verifyRawHmac({
        request: wire({
          body,
          headers: [
            ['X-Signature', `sha256=${signature}`],
            ['x-signature', `sha256=${signature}`]
          ]
        }),
        verifier,
        secrets
      })
    ).toEqual({ status: 'rejected', code: 'security_header_ambiguous' });
  });

  it('commits replay identity and state as one operation', async () => {
    let initialState = { cursor: 'before' };
    let memory = createInMemoryWebhookAtomicCommitSeam({
      states: {
        trigger: {
          version: 1,
          hash: computeWebhookStateHash(initialState),
          value: initialState
        }
      }
    });
    let input: WebhookAtomicCommitInput = {
      requestId: 'request',
      receiverId: 'receiver',
      originalRequestHash: 'request-hash',
      syncs: [],
      dispatches: [
        {
          bindings: {
            receiverId: 'receiver',
            receiverTriggerId: 'trigger',
            actionId: 'action',
            specHash: 'spec',
            registrationGeneration: 1,
            registrationVersion: 1,
            ruleId: 'delivery',
            requestId: 'request',
            originalRequestHash: 'request-hash',
            dispatchRequestHash: 'dispatch-hash',
            selectedItems: []
          },
          acceptedRequest: wire(),
          inputs: [{ event: 'created' }],
          replayKeys: ['delivery-1'],
          replayTtlSeconds: 60,
          proposedState: {
            value: { cursor: 'after' },
            expectedPriorVersion: 1,
            expectedPriorHash: computeWebhookStateHash(initialState)
          }
        }
      ]
    };

    expect(await memory.seam.commit(input)).toMatchObject({ status: 'committed' });
    expect(await memory.seam.commit(input)).toMatchObject({ status: 'duplicate' });
    expect(memory.states.get('trigger')).toEqual({
      version: 2,
      hash: computeWebhookStateHash({ cursor: 'after' }),
      value: { cursor: 'after' }
    });
  });
});
