import { createHmac, generateKeyPairSync, sign as signEd25519 } from 'node:crypto';
import type {
  SlateWebhookProviderRule,
  SlateWebhookVerificationRule,
  WebhookWireRequest
} from '@slates/proto';
import { describe, expect, it, vi } from 'vitest';
import {
  computeWebhookStateHash,
  computeJiraCanonicalQsh,
  createInMemoryWebhookAtomicCommitSeam,
  executeExactWebhookPipeline,
  prepareWebhookItemAdapter,
  selectExactWebhookRule,
  validateExactWebhookMappedOutput,
  verifyEd25519,
  verifyHubWebhookRule,
  verifyRawHmac,
  verifyReceiverPathSecret,
  verifyWebhookPreset,
  type ExactWebhookPipelineDependencies,
  type ExactWebhookRuleBinding,
  type ExactWebhookTriggerProjection,
  type ResolvedWebhookSecret,
  type WebhookAtomicCommitSeam
} from '.';

let wire = (
  d: {
    url?: string;
    method?: WebhookWireRequest['method'];
    headers?: [string, string][];
    body?: string | Uint8Array | null;
  } = {}
): WebhookWireRequest => ({
  url: d.url ?? 'https://webhook.example/callback',
  method: d.method ?? 'POST',
  headers: d.headers ?? [],
  body:
    d.body === null
      ? { present: false }
      : {
          present: true,
          base64: Buffer.from(d.body ?? '').toString('base64')
        }
});

let secret = (
  value: string,
  name = 'secret',
  encoding: ResolvedWebhookSecret['encoding'] = 'utf8'
): ResolvedWebhookSecret => ({
  name,
  value,
  encoding,
  version: 1,
  status: 'active'
});

let sign = (key: string, message: string | Uint8Array, encoding: 'hex' | 'base64' = 'hex') =>
  createHmac('sha256', key).update(message).digest(encoding);

describe('exact rule selection and generic verifiers', () => {
  it('selects only one method, status, and safe matcher match', () => {
    let request = wire({
      url: 'https://webhook.example/callback?challenge=1',
      headers: [['X-Mode', 'delivery']],
      body: '{"kind":"delivery"}'
    });
    let matching = {
      id: 'delivery',
      phase: 'delivery',
      when: {
        methods: ['POST'],
        registrationStatuses: ['registered'],
        matcher: {
          hasHeader: 'x-mode',
          hasQueryParam: 'challenge',
          jsonBodyField: { path: '/kind', equals: 'delivery' }
        }
      },
      verify: {
        type: 'static_token',
        secretName: 'secret',
        selector: { source: 'header', headerName: 'x-token' }
      },
      result: { type: 'dispatch', scope: 'receiver_trigger' },
      replay: {
        kind: 'enforced',
        deduplicate: { source: 'header', headerName: 'x-id', ttlSeconds: 60, scope: 'request' }
      }
    } as SlateWebhookVerificationRule;
    expect(
      selectExactWebhookRule({ rules: [matching], request, registrationStatus: 'registered' })
    ).toMatchObject({ status: 'selected', rule: { id: 'delivery' } });
    expect(
      selectExactWebhookRule({ rules: [matching], request, registrationStatus: 'pending' })
    ).toEqual({ status: 'rejected', code: 'no_matching_rule' });
    expect(
      selectExactWebhookRule({
        rules: [matching, { ...matching, id: 'other' }],
        request,
        registrationStatus: 'registered'
      })
    ).toEqual({ status: 'rejected', code: 'ambiguous_rule' });
  });

  it('enforces bounded path baseline and strict raw HMAC header grammar', () => {
    expect(
      verifyReceiverPathSecret({
        supplied: 'path-secret',
        activeAndRetiring: ['old', 'path-secret']
      })
    ).toBe(true);
    expect(
      verifyReceiverPathSecret({ supplied: 'wrong', activeAndRetiring: ['path-secret'] })
    ).toBe(false);
    let body = Buffer.from([0, 255, 13, 10]);
    let signature = sign('hmac-secret', body);
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
    expect(
      verifyRawHmac({
        request: wire({ body, headers: [['X-Signature', `sha256=${signature}`]] }),
        verifier,
        secrets: [secret('hmac-secret', 'hmac')]
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
        secrets: [secret('hmac-secret', 'hmac')]
      })
    ).toEqual({ status: 'rejected', code: 'security_header_ambiguous' });
    expect(
      verifyRawHmac({
        request: wire({
          body,
          headers: [['X-Signature', `sha256=${'00'.repeat(32)}, sha256=${signature}`]]
        }),
        verifier: {
          ...verifier,
          signature: { ...verifier.signature, multipleSignaturePolicy: 'any_valid' }
        },
        secrets: [secret('hmac-secret', 'hmac')]
      })
    ).toMatchObject({ status: 'accepted' });
    expect(
      verifyRawHmac({
        request: wire({
          body,
          headers: [['X-Signature', `sha256=${'00'.repeat(32)}, sha256=${signature}`]]
        }),
        verifier: {
          ...verifier,
          signature: { ...verifier.signature, multipleSignaturePolicy: 'all_valid' }
        },
        secrets: [secret('hmac-secret', 'hmac')]
      })
    ).toEqual({ status: 'rejected', code: 'credential_invalid' });
  });

  it('supports exact Ed25519 encodings and ordered message parts', () => {
    let pair = generateKeyPairSync('ed25519');
    let publicDer = pair.publicKey.export({ type: 'spki', format: 'der' });
    let publicRaw = publicDer.subarray(publicDer.length - 32);
    let body = Buffer.from('{"type":1}');
    let timestamp = '1700000000';
    let signature = signEd25519(
      null,
      Buffer.concat([Buffer.from(timestamp), body]),
      pair.privateKey
    );
    expect(
      verifyEd25519({
        request: wire({
          body,
          headers: [
            ['X-Signature-Timestamp', timestamp],
            ['X-Signature-Ed25519', signature.toString('hex')]
          ]
        }),
        verifier: {
          type: 'ed25519',
          publicKeyName: 'public-key',
          publicKeyEncoding: 'hex',
          signature: {
            headerName: 'x-signature-ed25519',
            encoding: 'hex',
            duplicateHeaderPolicy: 'reject',
            multipleSignaturePolicy: 'reject'
          },
          message: [
            { source: 'header', headerName: 'x-signature-timestamp' },
            { source: 'body' }
          ]
        },
        secrets: [secret(publicRaw.toString('hex'), 'public-key', 'hex')]
      })
    ).toMatchObject({ status: 'accepted' });
  });
});

describe('reviewed vendor presets', () => {
  it('verifies Slack, Stripe, Zoom, HubSpot, GitLab, Zendesk, Typeform and Linear fixtures', () => {
    let key = 'vendor-secret';
    let body =
      '{"id":"evt_1","event_ts":1700000000,"webhookId":"lin_1","webhookTimestamp":1700000000000}';
    let timestamp = '1700000000';
    let timestampMs = '1700000000000';
    let timestampIso = '2023-11-14T22:13:20.000Z';
    let cases: Array<{ preset: any; request: WebhookWireRequest }> = [
      {
        preset: 'slack.v0',
        request: wire({
          body,
          headers: [
            ['x-slack-request-timestamp', timestamp],
            ['x-slack-signature', `v0=${sign(key, `v0:${timestamp}:${body}`)}`]
          ]
        })
      },
      {
        preset: 'stripe.v1',
        request: wire({
          body,
          headers: [
            [
              'stripe-signature',
              `t=${timestamp},v1=00,v1=${sign(key, `${timestamp}.${body}`)}`
            ]
          ]
        })
      },
      {
        preset: 'zoom.v0',
        request: wire({
          body,
          headers: [
            ['x-zm-request-timestamp', timestamp],
            ['x-zm-signature', `v0=${sign(key, `v0:${timestamp}:${body}`)}`]
          ]
        })
      },
      {
        preset: 'hubspot.v3',
        request: (() => {
          let url = 'https://example.com/a%2Fb';
          return wire({
            url,
            body,
            headers: [
              ['x-hubspot-request-timestamp', timestampMs],
              [
                'x-hubspot-signature-v3',
                sign(key, `POSThttps://example.com/a/b${body}${timestampMs}`, 'base64')
              ]
            ]
          });
        })()
      },
      {
        preset: 'gitlab.standard.v1',
        request: wire({ body, headers: [['x-gitlab-token', key]] })
      },
      {
        preset: 'zendesk.v1',
        request: wire({
          body,
          headers: [
            ['x-zendesk-webhook-signature-timestamp', timestampIso],
            ['x-zendesk-webhook-signature', sign(key, `${timestampIso}${body}`, 'base64')]
          ]
        })
      },
      {
        preset: 'typeform.v1',
        request: wire({
          body,
          headers: [['typeform-signature', `sha256=${sign(key, body, 'base64')}`]]
        })
      },
      {
        preset: 'linear.v1',
        request: wire({ body, headers: [['linear-signature', sign(key, body)]] })
      }
    ];
    for (let fixture of cases) {
      expect(
        verifyWebhookPreset({
          preset: fixture.preset,
          request: fixture.request,
          secrets: [secret(key)],
          nowMs: Number(timestamp) * 1000
        }),
        fixture.preset
      ).toMatchObject({ status: 'accepted' });
    }
  });

  it('verifies Jira JWT and Discord PING fixtures', () => {
    let key = 'jira-secret';
    let jiraRequest = wire({
      url: 'https://example.com/jira/events?project=alpha&label=b&label=a&jwt=excluded'
    });
    expect(computeJiraCanonicalQsh(jiraRequest)).toBe(
      'd95291538a89f3d80d743a72986a0b99b6921cf28b090c2bd0a9c8125e55ecc3'
    );
    expect(
      computeJiraCanonicalQsh(wire({ url: 'https://example.com/jira/events?a=2&B=1' }))
    ).toBe('10ccc1496255384bd8d82920840fd1aac24267127807132b7a85f3002ebcd74f');
    let issuedAt = Math.floor(Date.now() / 1000);
    let header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
      'base64url'
    );
    let tokenFor = (claims: Record<string, unknown>) => {
      let payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
      return `${header}.${payload}.${Buffer.from(createHmac('sha256', key).update(`${header}.${payload}`).digest()).toString('base64url')}`;
    };
    let jwt = tokenFor({
      iss: 'jira-client-key',
      iat: issuedAt,
      exp: issuedAt + 300,
      qsh: computeJiraCanonicalQsh(jiraRequest),
      webhookId: 'jira-1'
    });
    expect(
      verifyWebhookPreset({
        preset: 'jira.oauth_dynamic_webhook.v1',
        request: { ...jiraRequest, headers: [['authorization', `JWT ${jwt}`]] },
        secrets: [secret(key)]
      })
    ).toMatchObject({ status: 'accepted', presetFields: { webhook_id: 'jira-1' } });
    for (let tampered of [
      { ...jiraRequest, method: 'GET' as const },
      { ...jiraRequest, url: 'https://example.com/jira/other?project=alpha&label=b&label=a' },
      { ...jiraRequest, url: 'https://example.com/jira/events?project=beta&label=b&label=a' }
    ]) {
      expect(
        verifyWebhookPreset({
          preset: 'jira.oauth_dynamic_webhook.v1',
          request: { ...tampered, headers: [['authorization', `JWT ${jwt}`]] },
          secrets: [secret(key)]
        })
      ).toEqual({ status: 'rejected', code: 'credential_invalid' });
    }
    expect(
      verifyWebhookPreset({
        preset: 'jira.oauth_dynamic_webhook.v1',
        request: { ...jiraRequest, headers: [['authorization', `Bearer ${jwt}`]] },
        secrets: [secret(key)]
      })
    ).toEqual({ status: 'rejected', code: 'credential_invalid' });
    expect(
      verifyWebhookPreset({
        preset: 'jira.oauth_dynamic_webhook.v1',
        request: {
          ...jiraRequest,
          headers: [
            ['authorization', `JWT ${jwt}`],
            ['Authorization', `JWT ${jwt}`]
          ]
        },
        secrets: [secret(key)]
      })
    ).toEqual({ status: 'rejected', code: 'security_header_ambiguous' });
    let staleJwt = tokenFor({
      iss: 'jira-client-key',
      iat: issuedAt - 301,
      exp: issuedAt + 300,
      qsh: computeJiraCanonicalQsh(jiraRequest)
    });
    expect(
      verifyWebhookPreset({
        preset: 'jira.oauth_dynamic_webhook.v1',
        request: { ...jiraRequest, headers: [['authorization', `JWT ${staleJwt}`]] },
        secrets: [secret(key)]
      })
    ).toEqual({ status: 'rejected', code: 'credential_stale' });
    for (let claims of [
      {
        iat: issuedAt,
        exp: issuedAt + 300,
        qsh: computeJiraCanonicalQsh(jiraRequest)
      },
      {
        iss: 'jira-client-key',
        iat: issuedAt + 61,
        exp: issuedAt + 300,
        qsh: computeJiraCanonicalQsh(jiraRequest)
      },
      {
        iss: 'jira-client-key',
        iat: issuedAt,
        exp: issuedAt - 1,
        qsh: computeJiraCanonicalQsh(jiraRequest)
      },
      {
        iss: 'jira-client-key',
        iat: issuedAt + 30,
        exp: issuedAt + 20,
        qsh: computeJiraCanonicalQsh(jiraRequest)
      }
    ]) {
      expect(
        verifyWebhookPreset({
          preset: 'jira.oauth_dynamic_webhook.v1',
          request: {
            ...jiraRequest,
            headers: [['authorization', `JWT ${tokenFor(claims)}`]]
          },
          secrets: [secret(key)]
        })
      ).toMatchObject({ status: 'rejected' });
    }

    let pair = generateKeyPairSync('ed25519');
    let publicDer = pair.publicKey.export({ type: 'spki', format: 'der' });
    let publicRaw = publicDer.subarray(publicDer.length - 32);
    let body = '{"type":1,"id":"interaction-1"}';
    let timestamp = '1700000000';
    let signature = signEd25519(null, Buffer.from(timestamp + body), pair.privateKey);
    expect(
      verifyWebhookPreset({
        preset: 'discord.interactions.v1',
        request: wire({
          body,
          headers: [
            ['x-signature-timestamp', timestamp],
            ['x-signature-ed25519', signature.toString('hex')]
          ]
        }),
        secrets: [secret(publicRaw.toString('hex'), 'discord-key', 'hex')],
        nowMs: Number(timestamp) * 1000
      })
    ).toMatchObject({ status: 'accepted', presetFields: { interaction_id: 'interaction-1' } });
  });

  it('enforces Linear authenticated millisecond freshness without trusting unsigned time', () => {
    let key = 'linear-secret';
    let nowMs = 1_700_000_000_000;
    let verify = (webhookTimestamp: number, signatureKey = key) => {
      let body = JSON.stringify({ webhookId: 'linear-event', webhookTimestamp });
      return verifyWebhookPreset({
        preset: 'linear.v1',
        request: wire({
          body,
          headers: [['linear-signature', sign(signatureKey, body)]]
        }),
        secrets: [secret(key)],
        nowMs
      });
    };

    expect(verify(nowMs - 5 * 60 * 1000 - 1)).toEqual({
      status: 'rejected',
      code: 'credential_stale'
    });
    expect(verify(nowMs + 60 * 1000 + 1)).toEqual({
      status: 'rejected',
      code: 'credential_future'
    });
    expect(verify(Number.MAX_SAFE_INTEGER, 'wrong-signing-key')).toEqual({
      status: 'rejected',
      code: 'credential_invalid'
    });
  });

  it('isolates mixed-validity Graph siblings and reconstructs accepted-only bytes', () => {
    let body = [
      '{\n  "metadata" : { "keep" : "spacing" },\n  "value" : [\n    ',
      '{ "id":"delivery-good", "subscriptionId":"sub-good", "clientState":"client-secret", "resource":"a", "number":1e+02 },\n    ',
      '{"subscriptionId":"sub-bad","clientState":"wrong","resource":"b","escaped":"\\u0061"},\n    ',
      '{"subscriptionId":"sub-arbitrary","clientState":"client-secret","resource":"a"}\n  ]\n}\n'
    ].join('');
    let request = wire({ body });
    let adapter = prepareWebhookItemAdapter('graph.body_value.v1', request);
    expect(adapter.candidates[0]).toMatchObject({
      candidateId: expect.stringMatching(/^graph\.body_value\.v1:0:[a-f0-9]{16}$/),
      deliveryIds: ['delivery-good']
    });
    expect(adapter.candidates[1]!.deliveryIds[0]).toMatch(/^sha256:[a-f0-9]{64}$/);
    let result = verifyWebhookPreset({
      preset: 'graph.change_notification.v1',
      request,
      secrets: [secret('client-secret')],
      itemAdapter: adapter,
      graphAuthorities: [
        {
          subscriptionId: 'sub-good',
          clientState: 'client-secret',
          resource: 'a',
          registrationGeneration: 1,
          specHash: 'a'.repeat(64)
        }
      ],
      registrationGeneration: 1,
      specHash: 'a'.repeat(64)
    });
    expect(result).toMatchObject({
      status: 'accepted',
      selection: {
        scope: 'verified_items',
        acceptedCandidateIds: [adapter.candidates[0]!.candidateId]
      }
    });
    let reconstructed = adapter.reconstruct([adapter.candidates[0]!.candidateId]);
    expect(reconstructed.dispatchRequestHash).not.toBe(adapter.originalRequestHash);
    let reconstructedBody = Buffer.from(
      reconstructed.request.body.present ? reconstructed.request.body.base64 : '',
      'base64'
    ).toString();
    expect(reconstructedBody).toContain(
      '{ "id":"delivery-good", "subscriptionId":"sub-good", "clientState":"client-secret", "resource":"a", "number":1e+02 }'
    );
    expect(reconstructedBody).not.toContain('sub-bad');
    expect(reconstructedBody).not.toContain('sub-arbitrary');
    expect(JSON.parse(reconstructedBody)).toMatchObject({
      value: [{ subscriptionId: 'sub-good' }]
    });
    expect(() => adapter.reconstruct(['unknown'])).toThrow('unknown');
    expect(() =>
      adapter.reconstruct([
        adapter.candidates[0]!.candidateId,
        adapter.candidates[0]!.candidateId
      ])
    ).toThrow('duplicate');
    expect(
      verifyWebhookPreset({
        preset: 'graph.change_notification.v1',
        request,
        secrets: [],
        itemAdapter: adapter,
        graphAuthorities: [
          {
            subscriptionId: 'sub-good',
            clientState: 'client-secret',
            registrationGeneration: 1,
            specHash: 'a'.repeat(64)
          }
        ],
        registrationGeneration: 2,
        specHash: 'a'.repeat(64)
      })
    ).toEqual({ status: 'rejected', code: 'credential_missing' });
  });
});

let providerRule = (id: string, type: 'dispatch' | 'sync' = 'dispatch') =>
  ({
    id,
    phase: type === 'sync' ? 'bootstrap' : 'delivery',
    when: {
      methods: ['POST'],
      registrationStatuses: type === 'sync' ? ['pending'] : ['registered']
    },
    verify: {
      type: 'provider',
      verifierId: type === 'sync' ? 'asana.delivery.v1' : 'quickbooks.delivery.v1',
      allowedSecretRefs: ['secret'],
      allowedBootstrapCaptureRefs: type === 'sync' ? ['secret'] : []
    },
    result:
      type === 'sync'
        ? { type: 'sync_only' }
        : { type: 'dispatch', scope: 'receiver_trigger' },
    replay:
      type === 'sync'
        ? { kind: 'not_applicable', reason: 'bootstrap_sync_only' }
        : {
            kind: 'enforced',
            deduplicate: {
              source: 'header',
              headerName: 'x-id',
              ttlSeconds: 60,
              scope: 'request'
            }
          }
  }) as SlateWebhookProviderRule;

let projection = (d: {
  id: string;
  rule?: SlateWebhookProviderRule | SlateWebhookVerificationRule;
  status?: string;
  graphAuthorities?: ExactWebhookTriggerProjection['graphAuthorities'];
}): ExactWebhookTriggerProjection => {
  let rule = d.rule ?? providerRule(`rule-${d.id}`);
  let state = { cursor: d.id };
  return {
    receiverId: 'receiver',
    receiverTriggerId: d.id,
    actionId: `action-${d.id}`,
    specHash: 'a'.repeat(64),
    registrationStatus: d.status ?? (rule.phase === 'bootstrap' ? 'pending' : 'registered'),
    registrationGeneration: 1,
    registrationVersion: 1,
    graphAuthorities: d.graphAuthorities,
    verification: {
      mechanism: rule.verify.type === 'provider' ? 'provider' : 'hub',
      baseline: 'receiver_path_secret',
      ...(rule.verify.type === 'provider' ? { reason: 'fixture' } : {}),
      allowedSecretRefs: [],
      rules: [rule] as any
    } as any,
    secrets: [secret('secret')],
    actionInputSchema: {
      type: 'object',
      properties: { value: { type: 'string' }, candidateId: { type: 'string' } },
      additionalProperties: true
    },
    state,
    stateVersion: 1,
    stateHash: computeWebhookStateHash(state)
  };
};

let acceptedMapping = (
  bindings: ExactWebhookRuleBinding,
  input: Record<string, unknown> = { value: 'mapped' }
) => ({
  bindings,
  inputs: [input]
});

let dependencies = (overrides: Partial<ExactWebhookPipelineDependencies> = {}) => {
  let memory = createInMemoryWebhookAtomicCommitSeam();
  let deps: ExactWebhookPipelineDependencies = {
    verifyProvider: async () => ({
      status: 'accepted',
      selection: { scope: 'receiver_trigger' }
    }),
    mapProvider: async ({ bindings }) => acceptedMapping(bindings),
    atomicCommit: memory.seam,
    ...overrides
  };
  return { deps, memory };
};

let paypalRule = {
  id: 'paypal.delivery.v1',
  phase: 'delivery',
  when: { methods: ['POST'], registrationStatuses: ['registered'] },
  verify: {
    type: 'provider',
    verifierId: 'paypal.delivery.v1',
    allowedSecretRefs: [
      'paypal_webhook_id',
      'paypal_access_token',
      'paypal_client_id',
      'paypal_client_secret',
      'paypal_environment'
    ],
    allowedBootstrapCaptureRefs: []
  },
  result: { type: 'dispatch', scope: 'receiver_trigger' },
  replay: {
    kind: 'enforced',
    freshness: {
      source: 'preset',
      presetField: 'timestamp',
      format: 'rfc3339',
      maxAgeSeconds: 86_400,
      maxFutureSkewSeconds: 300
    },
    deduplicate: {
      source: 'preset',
      presetField: 'delivery_id',
      ttlSeconds: 2_592_000,
      scope: 'request'
    }
  }
} satisfies SlateWebhookProviderRule;

let paypalRequest = (d: { actionId: string; timestamp: string; transmissionId?: string }) =>
  wire({
    body: JSON.stringify({ id: `${d.actionId}-event` }),
    headers: [
      ['paypal-auth-algo', 'SHA256withRSA'],
      ['paypal-cert-url', 'https://api.paypal.com/cert.pem'],
      ['paypal-transmission-id', d.transmissionId ?? `${d.actionId}-transmission`],
      ['paypal-transmission-sig', `${d.actionId}-signature`],
      ['paypal-transmission-time', d.timestamp]
    ]
  });

let paypalTrigger = (actionId: string, webhookId = `${actionId}-webhook`) => ({
  ...projection({ id: actionId, rule: paypalRule }),
  receiverId: 'paypal-receiver',
  actionId,
  secrets: [secret(webhookId, 'paypal_webhook_id')]
});

let verifyPayPalProviderHandlerResult: ExactWebhookPipelineDependencies['verifyProvider'] =
  async ({ trigger, request }) => {
    let oneHeader = (name: string) => {
      let values = request.headers.filter(
        ([header]) => header.toLowerCase() === name.toLowerCase()
      );
      return values.length === 1 && values[0]![1].trim().length > 0
        ? values[0]![1].trim()
        : null;
    };
    let timestamp = oneHeader('paypal-transmission-time');
    let transmissionId = oneHeader('paypal-transmission-id');
    let required = [
      oneHeader('paypal-auth-algo'),
      oneHeader('paypal-cert-url'),
      transmissionId,
      oneHeader('paypal-transmission-sig'),
      timestamp
    ];
    if (required.some(value => value === null)) {
      return { status: 'rejected', code: 'credential_missing' };
    }
    let webhookId = trigger.secrets.find(item => item.name === 'paypal_webhook_id')?.value;
    if (
      webhookId !== `${trigger.actionId}-webhook` ||
      transmissionId !== `${trigger.actionId}-transmission`
    ) {
      return { status: 'rejected', code: 'credential_invalid' };
    }
    return {
      status: 'accepted',
      selection: { scope: 'receiver_trigger' },
      presetFields: {
        timestamp: timestamp!,
        event_id: `${trigger.actionId}-event`,
        delivery_id: `${transmissionId}:${timestamp}:${webhookId}`
      }
    };
  };

describe('PayPal production provider-handler to Hub freshness and replay claim', () => {
  it.each([
    'dispute_events',
    'invoice_events',
    'order_events',
    'payment_events',
    'payout_events',
    'subscription_events'
  ])(
    'enforces stale, duplicate, wrong webhook and wrong header bindings for %s',
    async actionId => {
      let nowMs = Date.parse('2026-08-15T00:00:00.000Z');
      let freshRequest = paypalRequest({
        actionId,
        timestamp: '2026-08-15T00:00:00.000Z'
      });
      let { deps } = dependencies({ verifyProvider: verifyPayPalProviderHandlerResult });
      let first = await executeExactWebhookPipeline({
        receiverId: 'paypal-receiver',
        requestId: `${actionId}-first`,
        request: freshRequest,
        triggers: [paypalTrigger(actionId)],
        dependencies: deps,
        nowMs
      });
      expect(first, JSON.stringify(first)).toMatchObject({ status: 'committed' });
      await expect(
        executeExactWebhookPipeline({
          receiverId: 'paypal-receiver',
          requestId: `${actionId}-duplicate`,
          request: freshRequest,
          triggers: [paypalTrigger(actionId)],
          dependencies: deps,
          nowMs
        })
      ).resolves.toMatchObject({ status: 'duplicate' });

      for (let [caseId, request, trigger, code] of [
        [
          'stale',
          paypalRequest({ actionId, timestamp: '2026-08-13T23:59:59.999Z' }),
          paypalTrigger(actionId),
          'credential_stale'
        ],
        [
          'wrong-webhook',
          freshRequest,
          paypalTrigger(actionId, 'another-actions-webhook'),
          'credential_invalid'
        ],
        [
          'wrong-header',
          paypalRequest({
            actionId,
            timestamp: '2026-08-15T00:00:00.000Z',
            transmissionId: 'another-actions-transmission'
          }),
          paypalTrigger(actionId),
          'credential_invalid'
        ]
      ] as const) {
        let isolated = dependencies({
          verifyProvider: verifyPayPalProviderHandlerResult
        });
        await expect(
          executeExactWebhookPipeline({
            receiverId: 'paypal-receiver',
            requestId: `${actionId}-${caseId}`,
            request,
            triggers: [trigger],
            dependencies: isolated.deps,
            nowMs
          })
        ).resolves.toMatchObject({ status: 'rejected', code });
      }
    }
  );
});

describe('receiver aggregation, provider mapping and Task 7 seam', () => {
  it('keeps weak and strong triggers isolated and commits multiple dispatches together', async () => {
    let weakVerify = vi.fn(async () => ({ status: 'rejected', code: 'credential_invalid' }));
    let map = vi.fn(async ({ bindings }: any) => acceptedMapping(bindings));
    let { deps, memory } = dependencies({ verifyProvider: weakVerify, mapProvider: map });
    let strongRule = {
      id: 'strong',
      phase: 'delivery',
      when: { methods: ['POST'] },
      verify: {
        type: 'static_token',
        secretName: 'token',
        selector: { source: 'header', headerName: 'x-token' }
      },
      result: { type: 'dispatch', scope: 'receiver_trigger' },
      replay: {
        kind: 'enforced',
        deduplicate: { source: 'header', headerName: 'x-id', ttlSeconds: 60, scope: 'request' }
      }
    } as SlateWebhookVerificationRule;
    let strong = {
      ...projection({ id: 'strong', rule: strongRule }),
      secrets: [secret('strong-secret', 'token')]
    };
    let result = await executeExactWebhookPipeline({
      receiverId: 'receiver',
      requestId: 'request',
      request: wire({ headers: [['x-token', 'strong-secret']] }),
      triggers: [projection({ id: 'weak' }), strong],
      dependencies: deps
    });
    expect(result.status).toBe('committed');
    expect(map).toHaveBeenCalledOnce();
    expect(
      memory.committed[0]!.dispatches.map(dispatch => dispatch.bindings.receiverTriggerId)
    ).toEqual(['strong']);
  });

  it('aggregates independently matched dispatches in receiver-trigger order', async () => {
    let first = projection({ id: 'a' });
    let second = projection({ id: 'b' });
    let run = async (triggers: ExactWebhookTriggerProjection[]) => {
      let { deps, memory } = dependencies();
      let result = await executeExactWebhookPipeline({
        receiverId: 'receiver',
        requestId: 'ordered',
        request: wire({ body: JSON.stringify({ delivery: triggers[0]!.receiverTriggerId }) }),
        triggers,
        dependencies: deps
      });
      expect(result.status).toBe('committed');
      return memory.committed[0]!.dispatches.map(
        dispatch => dispatch.bindings.receiverTriggerId
      );
    };
    expect(await run([second, first])).toEqual(['a', 'b']);
    expect(await run([first, second])).toEqual(['a', 'b']);
  });

  it('rejects authorized sync plus dispatch after verification and before mapping, capture, or commit', async () => {
    let verify = vi.fn(async () => ({
      status: 'accepted' as const,
      selection: { scope: 'receiver_trigger' as const }
    }));
    let map = vi.fn();
    let capture = vi.fn();
    let commit = vi.fn();
    let { deps } = dependencies({
      verifyProvider: verify,
      mapProvider: map,
      captureBootstrap: capture,
      atomicCommit: { commit } as any
    });
    let result = await executeExactWebhookPipeline({
      receiverId: 'receiver',
      requestId: 'request',
      request: wire(),
      triggers: [
        projection({ id: 'sync', rule: providerRule('sync', 'sync') }),
        projection({ id: 'dispatch' })
      ],
      dependencies: deps
    });
    expect(result).toMatchObject({ status: 'rejected', code: 'conflicting_rule_outcomes' });
    expect(verify).toHaveBeenCalledTimes(2);
    expect(map).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it('does not let an unauthenticated dispatch match suppress an authorized sync response', async () => {
    let response = {
      status: 200,
      headers: [] as [string, string][],
      body: { present: true as const, base64: Buffer.from('challenge').toString('base64') }
    };
    let { deps, memory } = dependencies({
      verifyProvider: async ({ rule }) =>
        rule.result.type === 'dispatch'
          ? { status: 'rejected', code: 'credential_invalid' }
          : { status: 'accepted', selection: { scope: 'receiver_trigger' } },
      captureBootstrap: async ({ bindings }) => ({
        status: 'accepted',
        bindings,
        capturedSecrets: { secret: { value: 'captured', version: 2 } },
        response
      })
    });
    let result = await executeExactWebhookPipeline({
      receiverId: 'receiver',
      requestId: 'authorized-sync-only',
      request: wire(),
      triggers: [
        projection({ id: 'sync', rule: providerRule('sync', 'sync') }),
        projection({ id: 'dispatch' })
      ],
      dependencies: deps
    });
    expect(result).toMatchObject({ status: 'committed', response });
    expect(memory.committed[0]!.syncs).toHaveLength(1);
    expect(memory.committed[0]!.dispatches).toHaveLength(0);
  });

  it('fails closed when the atomic commit rejects mapped output', async () => {
    let { deps } = dependencies({
      atomicCommit: {
        commit: async () => ({ status: 'rejected', code: 'mapped_output_invalid' as const })
      }
    });
    let result = await executeExactWebhookPipeline({
      receiverId: 'receiver',
      requestId: 'task-7-unavailable',
      request: wire(),
      triggers: [projection({ id: 'dispatch' })],
      dependencies: deps
    });
    expect(result).toMatchObject({ status: 'rejected', code: 'mapped_output_invalid' });
  });

  it('coalesces identical sync responses and rejects conflicting responses without commit', async () => {
    let response = {
      status: 200,
      headers: [['x-hook-secret', 'redacted']] as [string, string][],
      body: { present: true as const, base64: '' }
    };
    let commit = vi.fn(async (_input: Parameters<WebhookAtomicCommitSeam['commit']>[0]) => ({
      status: 'committed' as const,
      commitId: 'commit'
    }));
    let { deps } = dependencies({
      captureBootstrap: async ({ trigger, bindings }) => ({
        status: 'accepted',
        bindings,
        capturedSecrets: {
          secret: { value: `captured-${trigger.receiverTriggerId}`, version: 2 }
        },
        response
      }),
      atomicCommit: { commit }
    });
    let triggers = [
      projection({ id: 'a', rule: providerRule('sync-a', 'sync') }),
      projection({ id: 'b', rule: providerRule('sync-b', 'sync') })
    ];
    let identical = await executeExactWebhookPipeline({
      receiverId: 'receiver',
      requestId: 'request',
      request: wire(),
      triggers,
      dependencies: deps
    });
    expect(identical.status).toBe('committed');
    expect(commit.mock.calls[0]![0].syncs).toHaveLength(2);

    let conflictCommit = vi.fn();
    let { deps: conflicting } = dependencies({
      captureBootstrap: async ({ trigger, bindings }) => ({
        status: 'accepted',
        bindings,
        capturedSecrets: {},
        response: { ...response, status: trigger.receiverTriggerId === 'a' ? 200 : 202 }
      }),
      atomicCommit: { commit: conflictCommit } as any
    });
    let rejected = await executeExactWebhookPipeline({
      receiverId: 'receiver',
      requestId: 'other',
      request: wire(),
      triggers,
      dependencies: conflicting
    });
    expect(rejected).toMatchObject({ status: 'rejected', code: 'conflicting_sync_responses' });
    expect(conflictCommit).not.toHaveBeenCalled();
  });

  it.each([
    'malformed',
    'extra',
    'missing',
    'cross_trigger',
    'state_prior',
    'action_schema',
    'timeout'
  ])('never enters commit for %s mapping output', async kind => {
    let commit = vi.fn();
    let graphRule = {
      id: 'graph',
      phase: 'delivery',
      when: { methods: ['POST'] },
      verify: {
        type: 'provider',
        verifierId: 'graph.change_notification.provider.v1',
        allowedSecretRefs: ['secret'],
        allowedBootstrapCaptureRefs: []
      },
      result: { type: 'dispatch', scope: 'verified_items' },
      replay: {
        kind: 'enforced',
        deduplicate: {
          source: 'preset',
          presetField: 'delivery_id',
          ttlSeconds: 60,
          scope: 'verified_item'
        }
      }
    } as SlateWebhookProviderRule;
    let { deps } = dependencies({
      verifyProvider: async ({ itemAdapter }) => ({
        status: 'accepted',
        selection: {
          scope: 'verified_items',
          itemAdapterId: 'graph.body_value.v1',
          acceptedCandidateIds: [itemAdapter!.candidates[0]!.candidateId]
        }
      }),
      mapProvider: async ({ bindings, trigger }) => {
        if (kind === 'timeout') throw new Error('mapping timeout');
        if (kind === 'malformed') return { inputs: [] };
        if (kind === 'cross_trigger')
          return acceptedMapping({ ...bindings, receiverTriggerId: 'other' });
        if (kind === 'state_prior')
          return {
            ...acceptedMapping(bindings),
            proposedState: {
              value: {},
              expectedPriorVersion: trigger.stateVersion + 1,
              expectedPriorHash: trigger.stateHash
            }
          };
        if (kind === 'missing') return { bindings, inputs: [] };
        if (kind === 'action_schema') {
          return acceptedMapping(bindings, {
            candidateId: bindings.selectedItems[0]!.candidateId,
            value: 123
          });
        }
        return {
          bindings,
          inputs: [
            { candidateId: bindings.selectedItems[0]!.candidateId, value: 'mapped' },
            { candidateId: 'graph:999:' + 'f'.repeat(64), value: 'extra' }
          ]
        };
      },
      atomicCommit: { commit } as any
    });
    let result = await executeExactWebhookPipeline({
      receiverId: 'receiver',
      requestId: kind,
      request: wire({
        body: JSON.stringify({ value: [{ subscriptionId: 'sub', clientState: 'secret' }] })
      }),
      triggers: [
        projection({
          id: 'trigger',
          rule: graphRule,
          graphAuthorities: [
            {
              subscriptionId: 'sub',
              clientState: 'secret',
              registrationGeneration: 1,
              specHash: 'a'.repeat(64)
            }
          ]
        })
      ],
      dependencies: deps
    });
    expect(result.status).toBe('rejected');
    expect(commit).not.toHaveBeenCalled();
  });

  it('never lets a provider authorize a Graph candidate outside trusted registration authority', async () => {
    let graphRule = {
      id: 'graph-authority',
      phase: 'delivery',
      when: { methods: ['POST'] },
      verify: {
        type: 'provider',
        verifierId: 'graph.change_notification.provider.v1',
        allowedSecretRefs: ['secret'],
        allowedBootstrapCaptureRefs: []
      },
      result: { type: 'dispatch', scope: 'verified_items' },
      replay: {
        kind: 'enforced',
        deduplicate: {
          source: 'preset',
          presetField: 'delivery_id',
          ttlSeconds: 60,
          scope: 'verified_item'
        }
      }
    } as SlateWebhookProviderRule;
    let mapProvider = vi.fn();
    let commit = vi.fn();
    let { deps } = dependencies({
      verifyProvider: async ({ itemAdapter }) => ({
        status: 'accepted',
        selection: {
          scope: 'verified_items',
          itemAdapterId: 'graph.body_value.v1',
          acceptedCandidateIds: [itemAdapter!.candidates[1]!.candidateId]
        }
      }),
      mapProvider,
      atomicCommit: { commit } as any
    });
    let result = await executeExactWebhookPipeline({
      receiverId: 'receiver',
      requestId: 'graph-authority',
      request: wire({
        body: JSON.stringify({
          value: [
            { subscriptionId: 'trusted', clientState: 'state' },
            { subscriptionId: 'untrusted', clientState: 'state' }
          ]
        })
      }),
      triggers: [
        projection({
          id: 'graph',
          rule: graphRule,
          graphAuthorities: [
            {
              subscriptionId: 'trusted',
              clientState: 'state',
              registrationGeneration: 1,
              specHash: 'a'.repeat(64)
            }
          ]
        })
      ],
      dependencies: deps
    });

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'item_candidate_contradictory'
    });
    expect(mapProvider).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it('rolls back replay and secret writes on state/secret CAS loss', async () => {
    let state = { cursor: 'old' };
    let memory = createInMemoryWebhookAtomicCommitSeam({
      states: { trigger: { version: 2, hash: computeWebhookStateHash(state), value: state } },
      capturedSecretVersions: { 'trigger:secret': 2 }
    });
    let binding = {
      receiverId: 'receiver',
      receiverTriggerId: 'trigger',
      actionId: 'action',
      specHash: 'a'.repeat(64),
      registrationGeneration: 1,
      registrationVersion: 1,
      ruleId: 'rule',
      requestId: 'request',
      originalRequestHash: 'b'.repeat(64),
      dispatchRequestHash: 'b'.repeat(64),
      selectedItems: []
    } satisfies ExactWebhookRuleBinding;
    let stateConflict = await memory.seam.commit({
      requestId: 'request',
      receiverId: 'receiver',
      originalRequestHash: binding.originalRequestHash,
      syncs: [],
      dispatches: [
        {
          bindings: binding,
          inputs: [],
          replayKeys: ['delivery'],
          proposedState: {
            value: {},
            expectedPriorVersion: 1,
            expectedPriorHash: 'c'.repeat(64)
          }
        }
      ]
    });
    expect(stateConflict).toEqual({ status: 'rejected', code: 'state_cas_conflict' });
    expect(memory.replay.size).toBe(0);
    let secretConflict = await memory.seam.commit({
      requestId: 'request',
      receiverId: 'receiver',
      originalRequestHash: binding.originalRequestHash,
      dispatches: [],
      syncs: [
        {
          bindings: binding,
          response: { status: 200, headers: [], body: { present: false } },
          capturedSecrets: { secret: { value: 'new', version: 2 } },
          replayKeys: ['delivery']
        }
      ]
    });
    expect(secretConflict.status).toBe('rejected');
    expect(memory.replay.size).toBe(0);
  });

  it('rolls back every receiver-level captured secret when one CAS loses', async () => {
    let memory = createInMemoryWebhookAtomicCommitSeam({
      capturedSecretVersions: { 'b:secret': 2 }
    });
    let response = {
      status: 200,
      headers: [] as [string, string][],
      body: { present: false as const }
    };
    let result = await executeExactWebhookPipeline({
      receiverId: 'receiver',
      requestId: 'capture-conflict',
      request: wire(),
      triggers: [
        projection({ id: 'a', rule: providerRule('sync-a', 'sync') }),
        projection({ id: 'b', rule: providerRule('sync-b', 'sync') })
      ],
      dependencies: {
        verifyProvider: async () => ({
          status: 'accepted',
          selection: { scope: 'receiver_trigger' }
        }),
        mapProvider: async ({ bindings }) => acceptedMapping(bindings),
        captureBootstrap: async ({ bindings }) => ({
          status: 'accepted',
          bindings,
          capturedSecrets: { secret: { value: 'captured', version: 2 } },
          response
        }),
        atomicCommit: memory.seam
      }
    });
    expect(result.status).toBe('rejected');
    expect(memory.capturedSecretVersions.has('a:secret')).toBe(false);
    expect(memory.capturedSecretVersions.get('b:secret')).toBe(2);
    expect(memory.replay.size).toBe(0);
    expect(memory.committed).toHaveLength(0);
  });

  it('remaps a different delivery against fresh state and leaves duplicate handling to the seam', async () => {
    let initialState = { cursor: 'initial' };
    let memory = createInMemoryWebhookAtomicCommitSeam({
      states: {
        trigger: {
          version: 1,
          hash: computeWebhookStateHash(initialState),
          value: initialState
        }
      }
    });
    let seen = vi.fn();
    let deps: ExactWebhookPipelineDependencies = {
      verifyProvider: async () => ({
        status: 'accepted',
        selection: { scope: 'receiver_trigger' }
      }),
      mapProvider: async ({ bindings, state, stateVersion, stateHash }) => {
        seen({ requestId: bindings.requestId, state, stateVersion, stateHash });
        return {
          ...acceptedMapping(bindings),
          proposedState: {
            value: { cursor: bindings.requestId },
            expectedPriorVersion: stateVersion,
            expectedPriorHash: stateHash
          }
        };
      },
      atomicCommit: memory.seam
    };
    let base = {
      ...projection({ id: 'trigger' }),
      state: initialState,
      stateVersion: 1,
      stateHash: computeWebhookStateHash(initialState)
    };
    let first = await executeExactWebhookPipeline({
      receiverId: 'receiver',
      requestId: 'delivery-one',
      request: wire({ body: 'one' }),
      triggers: [base],
      dependencies: deps
    });
    expect(first.status).toBe('committed');
    let fresh = memory.states.get('trigger')!;
    let secondProjection = {
      ...base,
      state: fresh.value,
      stateVersion: fresh.version,
      stateHash: fresh.hash
    };
    let second = await executeExactWebhookPipeline({
      receiverId: 'receiver',
      requestId: 'delivery-two',
      request: wire({ body: 'two' }),
      triggers: [secondProjection],
      dependencies: deps
    });
    expect(second.status).toBe('committed');
    expect(seen.mock.calls.map(call => call[0])).toEqual([
      {
        requestId: 'delivery-one',
        state: initialState,
        stateVersion: 1,
        stateHash: computeWebhookStateHash(initialState)
      },
      {
        requestId: 'delivery-two',
        state: { cursor: 'delivery-one' },
        stateVersion: 2,
        stateHash: computeWebhookStateHash({ cursor: 'delivery-one' })
      }
    ]);
    let duplicate = await executeExactWebhookPipeline({
      receiverId: 'receiver',
      requestId: 'delivery-two-retry',
      request: wire({ body: 'two' }),
      triggers: [
        {
          ...secondProjection,
          state: memory.states.get('trigger')!.value,
          stateVersion: memory.states.get('trigger')!.version,
          stateHash: memory.states.get('trigger')!.hash
        }
      ],
      dependencies: deps
    });
    expect(duplicate.status).toBe('duplicate');
    expect(memory.committed).toHaveLength(2);
  });
});

describe('bootstrap protocol fixtures', () => {
  it('returns exact Graph, Meta, Zoom, and Discord synchronous handshakes', async () => {
    let run = async (d: {
      requestId: string;
      request: WebhookWireRequest;
      rule: SlateWebhookVerificationRule;
      secrets?: ResolvedWebhookSecret[];
    }) => {
      let trigger = {
        ...projection({ id: d.requestId, rule: d.rule, status: 'pending' }),
        secrets: d.secrets ?? []
      };
      let { deps } = dependencies();
      return await executeExactWebhookPipeline({
        receiverId: 'receiver',
        requestId: d.requestId,
        request: d.request,
        triggers: [trigger],
        dependencies: deps,
        nowMs: 1_700_000_000_000
      });
    };
    let graphRule = {
      id: 'graph-validation',
      phase: 'bootstrap',
      when: {
        methods: ['GET'],
        registrationStatuses: ['pending'],
        matcher: { hasQueryParam: 'validationToken' }
      },
      verify: { type: 'path_secret' },
      result: { type: 'sync_only' },
      replay: { kind: 'not_applicable', reason: 'bootstrap_sync_only' }
    } as SlateWebhookVerificationRule;
    let graph = await run({
      requestId: 'graph',
      request: wire({
        method: 'GET',
        body: null,
        url: 'https://example.com/callback?validationToken=graph-challenge'
      }),
      rule: graphRule
    });
    expect(
      Buffer.from(
        graph.status !== 'rejected' && graph.response?.body.present
          ? graph.response.body.base64
          : '',
        'base64'
      ).toString()
    ).toBe('graph-challenge');

    let metaRule = {
      id: 'meta-get',
      phase: 'bootstrap',
      when: {
        methods: ['GET'],
        registrationStatuses: ['pending'],
        matcher: { hasQueryParam: 'hub.challenge' }
      },
      verify: {
        type: 'static_token',
        secretName: 'meta',
        selector: { source: 'query', queryParam: 'hub.verify_token' }
      },
      result: { type: 'sync_only' },
      replay: { kind: 'not_applicable', reason: 'bootstrap_sync_only' }
    } as SlateWebhookVerificationRule;
    let meta = await run({
      requestId: 'meta',
      request: wire({
        method: 'GET',
        body: null,
        url: 'https://example.com/callback?hub.verify_token=meta-secret&hub.challenge=meta-challenge'
      }),
      rule: metaRule,
      secrets: [secret('meta-secret', 'meta')]
    });
    expect(
      Buffer.from(
        meta.status !== 'rejected' && meta.response?.body.present
          ? meta.response.body.base64
          : '',
        'base64'
      ).toString()
    ).toBe('meta-challenge');

    let zoomSecret = 'zoom-secret';
    let zoomBody = JSON.stringify({
      event: 'endpoint.url_validation',
      payload: { plainToken: 'zoom-challenge' }
    });
    let zoomTimestamp = '1700000000';
    let zoomRule = {
      id: 'zoom-validation',
      phase: 'bootstrap',
      when: { methods: ['POST'], registrationStatuses: ['pending'] },
      verify: { type: 'preset', preset: 'zoom.v0' },
      result: { type: 'sync_only' },
      replay: { kind: 'not_applicable', reason: 'bootstrap_sync_only' }
    } as SlateWebhookVerificationRule;
    let zoom = await run({
      requestId: 'zoom',
      request: wire({
        body: zoomBody,
        headers: [
          ['x-zm-request-timestamp', zoomTimestamp],
          ['x-zm-signature', `v0=${sign(zoomSecret, `v0:${zoomTimestamp}:${zoomBody}`)}`]
        ]
      }),
      rule: zoomRule,
      secrets: [secret(zoomSecret)]
    });
    let zoomResponse = JSON.parse(
      Buffer.from(
        zoom.status !== 'rejected' && zoom.response?.body.present
          ? zoom.response.body.base64
          : '',
        'base64'
      ).toString()
    );
    expect(zoomResponse).toEqual({
      plainToken: 'zoom-challenge',
      encryptedToken: sign(zoomSecret, 'zoom-challenge')
    });

    let pair = generateKeyPairSync('ed25519');
    let publicDer = pair.publicKey.export({ type: 'spki', format: 'der' });
    let publicRaw = publicDer.subarray(publicDer.length - 32);
    let discordBody = '{"type":1,"id":"ping"}';
    let discordTimestamp = '1700000000';
    let discordSignature = signEd25519(
      null,
      Buffer.from(discordTimestamp + discordBody),
      pair.privateKey
    );
    let discordRule = {
      id: 'discord-ping',
      phase: 'bootstrap',
      when: { methods: ['POST'], registrationStatuses: ['pending'] },
      verify: { type: 'preset', preset: 'discord.interactions.v1' },
      result: { type: 'sync_only' },
      replay: { kind: 'not_applicable', reason: 'bootstrap_sync_only' }
    } as SlateWebhookVerificationRule;
    let discord = await run({
      requestId: 'discord',
      request: wire({
        body: discordBody,
        headers: [
          ['x-signature-timestamp', discordTimestamp],
          ['x-signature-ed25519', discordSignature.toString('hex')]
        ]
      }),
      rule: discordRule,
      secrets: [secret(publicRaw.toString('hex'), 'discord-key', 'hex')]
    });
    expect(
      Buffer.from(
        discord.status !== 'rejected' && discord.response?.body.present
          ? discord.response.body.base64
          : '',
        'base64'
      ).toString()
    ).toBe('{"type":1}');
  });

  it('keeps Asana and Notion capture proposals pure until the atomic seam', async () => {
    let capture = vi.fn(async ({ bindings }: any) => ({
      status: 'accepted',
      bindings,
      capturedSecrets: { secret: { value: 'captured', version: 2 } },
      response: {
        status: 200,
        headers: [['x-hook-secret', 'captured']],
        body: { present: false }
      }
    }));
    let commit = vi.fn(async () => ({ status: 'committed' as const, commitId: 'commit' }));
    let { deps } = dependencies({ captureBootstrap: capture, atomicCommit: { commit } });
    for (let verifierId of ['asana.delivery.v1', 'notion.delivery.v1'] as const) {
      let rule = {
        ...providerRule(verifierId, 'sync'),
        verify: {
          ...providerRule(verifierId, 'sync').verify,
          verifierId
        }
      } as SlateWebhookProviderRule;
      let name = verifierId.split('.')[0]!;
      await executeExactWebhookPipeline({
        receiverId: 'receiver',
        requestId: name,
        request: wire({ body: name }),
        triggers: [projection({ id: name, rule })],
        dependencies: deps
      });
    }
    expect(capture).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledTimes(2);
    for (let index = 0; index < 2; index += 1) {
      expect(commit.mock.invocationCallOrder[index]).toBeGreaterThan(
        capture.mock.invocationCallOrder[index]!
      );
    }
  });
});
