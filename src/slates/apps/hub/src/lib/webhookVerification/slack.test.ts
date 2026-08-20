import { createHmac } from 'node:crypto';
import type { SlateWebhookVerificationRule, WebhookWireRequest } from '@slates/proto';
import { describe, expect, it } from 'vitest';
import {
  computeWebhookStateHash,
  createInMemoryWebhookAtomicCommitSeam,
  executeExactWebhookPipeline,
  verifyWebhookPreset,
  type ExactWebhookPipelineDependencies,
  type ExactWebhookRuleBinding,
  type ExactWebhookTriggerProjection,
  type ResolvedWebhookSecret
} from '.';

let NOW_MS = Date.parse('2026-08-19T00:00:00.000Z');
let NOW_SECONDS = String(NOW_MS / 1000);
let ACTIVE_SIGNING_SECRET = 'slack-signing-secret-active';

let resolvedSecret = (
  value: string,
  d: {
    version?: number;
    status?: ResolvedWebhookSecret['status'];
    validUntil?: Date | null;
  } = {}
): ResolvedWebhookSecret => ({
  name: 'hmac_secret',
  value,
  encoding: 'utf8',
  version: d.version ?? 1,
  status: d.status ?? 'active',
  ...(d.validUntil !== undefined ? { validUntil: d.validUntil } : {})
});

let slackSignature = (key: string, timestamp: string, body: Uint8Array) =>
  createHmac('sha256', key).update(`v0:${timestamp}:`, 'utf8').update(body).digest('hex');

let signedSlackRequest = (d: {
  body: string | Uint8Array;
  key?: string;
  timestamp?: string;
  contentType?: string;
  extraHeaders?: [string, string][];
}): WebhookWireRequest => {
  let body = typeof d.body === 'string' ? Buffer.from(d.body, 'utf8') : Buffer.from(d.body);
  let timestamp = d.timestamp ?? NOW_SECONDS;
  let key = d.key ?? ACTIVE_SIGNING_SECRET;
  return {
    url: 'https://hooks.metorial.test/slack/events',
    method: 'POST',
    headers: [
      ...(d.contentType ? ([['content-type', d.contentType]] as [string, string][]) : []),
      ...(d.extraHeaders ?? []),
      ['x-slack-request-timestamp', timestamp],
      ['x-slack-signature', `v0=${slackSignature(key, timestamp, body)}`]
    ],
    body: { present: true, base64: body.toString('base64') }
  };
};

let formBody = (entries: [string, string][]) => new URLSearchParams(entries).toString();

let interactionBody = (payload: Record<string, unknown>) =>
  formBody([['payload', JSON.stringify(payload)]]);

let slackEventCallbackBody = (eventId: string) =>
  JSON.stringify({
    token: 'deprecated-verification-token',
    team_id: 'T01234567',
    api_app_id: 'A01234567',
    type: 'event_callback',
    event_id: eventId,
    event_time: 1787097600,
    event_context: '4-eyJldCI6Im1lc3NhZ2UifQ',
    event: {
      type: 'message',
      user: 'U01234567',
      text: 'hello',
      channel: 'C01234567',
      event_ts: '1787097600.000100'
    },
    authorizations: [
      {
        enterprise_id: null,
        team_id: 'T01234567',
        user_id: 'U07654321',
        is_bot: true,
        is_enterprise_install: false
      }
    ],
    is_ext_shared_channel: false
  });

let SLACK_BODY_FIXTURES: ReadonlyArray<{
  name: string;
  body: string;
  contentType: string;
  extraHeaders?: [string, string][];
}> = [
  {
    name: 'URL verification JSON',
    contentType: 'application/json',
    body: JSON.stringify({
      token: 'deprecated-verification-token',
      challenge: 'challenge-value',
      type: 'url_verification'
    })
  },
  {
    name: 'event callback JSON',
    contentType: 'application/json',
    body: slackEventCallbackBody('Ev01234567')
  },
  {
    name: 'event callback retry JSON',
    contentType: 'application/json',
    body: slackEventCallbackBody('Ev07654321'),
    extraHeaders: [
      ['x-slack-retry-num', '1'],
      ['x-slack-retry-reason', 'http_timeout']
    ]
  },
  {
    name: 'app rate limited JSON',
    contentType: 'application/json',
    body: JSON.stringify({
      token: 'deprecated-verification-token',
      type: 'app_rate_limited',
      team_id: 'T01234567',
      minute_rate_limited: 1787097600,
      api_app_id: 'A01234567'
    })
  },
  {
    name: 'block actions interaction form',
    contentType: 'application/x-www-form-urlencoded',
    body: interactionBody({
      type: 'block_actions',
      team: { id: 'T01234567', domain: 'metorial' },
      user: { id: 'U01234567', username: 'tester', team_id: 'T01234567' },
      api_app_id: 'A01234567',
      trigger_id: 'trigger.block-actions',
      response_url: 'https://hooks.slack.com/actions/response',
      actions: [
        {
          action_id: 'approve',
          block_id: 'approval',
          value: 'yes',
          type: 'button',
          action_ts: '1787097600.000100'
        }
      ]
    })
  },
  {
    name: 'block suggestion interaction form',
    contentType: 'application/x-www-form-urlencoded',
    body: interactionBody({
      type: 'block_suggestion',
      team: { id: 'T01234567', domain: 'metorial' },
      user: { id: 'U01234567', username: 'tester', team_id: 'T01234567' },
      api_app_id: 'A01234567',
      action_id: 'search',
      block_id: 'search-block',
      value: 'metorial'
    })
  },
  {
    name: 'view submission interaction form',
    contentType: 'application/x-www-form-urlencoded',
    body: interactionBody({
      type: 'view_submission',
      team: { id: 'T01234567', domain: 'metorial' },
      user: { id: 'U01234567', username: 'tester', team_id: 'T01234567' },
      api_app_id: 'A01234567',
      trigger_id: 'trigger.view-submission',
      view: {
        id: 'V01234567',
        type: 'modal',
        callback_id: 'submit-settings',
        state: { values: {} }
      }
    })
  },
  {
    name: 'view closed interaction form',
    contentType: 'application/x-www-form-urlencoded',
    body: interactionBody({
      type: 'view_closed',
      team: { id: 'T01234567', domain: 'metorial' },
      user: { id: 'U01234567', username: 'tester', team_id: 'T01234567' },
      api_app_id: 'A01234567',
      is_cleared: false,
      view: {
        id: 'V01234567',
        type: 'modal',
        callback_id: 'submit-settings',
        state: { values: {} }
      }
    })
  },
  {
    name: 'global shortcut interaction form',
    contentType: 'application/x-www-form-urlencoded',
    body: interactionBody({
      type: 'shortcut',
      token: 'deprecated-verification-token',
      action_ts: '1787097600.000100',
      team: { id: 'T01234567', domain: 'metorial' },
      user: { id: 'U01234567', username: 'tester', team_id: 'T01234567' },
      api_app_id: 'A01234567',
      callback_id: 'open-settings',
      trigger_id: 'trigger.shortcut'
    })
  },
  {
    name: 'message action interaction form',
    contentType: 'application/x-www-form-urlencoded',
    body: interactionBody({
      type: 'message_action',
      token: 'deprecated-verification-token',
      action_ts: '1787097600.000100',
      team: { id: 'T01234567', domain: 'metorial' },
      user: { id: 'U01234567', username: 'tester', team_id: 'T01234567' },
      channel: { id: 'C01234567', name: 'general' },
      api_app_id: 'A01234567',
      callback_id: 'save-message',
      trigger_id: 'trigger.message-action',
      response_url: 'https://hooks.slack.com/actions/response',
      message: { type: 'message', user: 'U07654321', text: 'save this message' }
    })
  },
  {
    name: 'slash command form',
    contentType: 'application/x-www-form-urlencoded',
    body: formBody([
      ['token', 'deprecated-verification-token'],
      ['team_id', 'T01234567'],
      ['team_domain', 'metorial'],
      ['channel_id', 'C01234567'],
      ['channel_name', 'general'],
      ['user_id', 'U01234567'],
      ['user_name', 'tester'],
      ['command', '/metorial'],
      ['text', 'status'],
      ['api_app_id', 'A01234567'],
      ['is_enterprise_install', 'false'],
      ['response_url', 'https://hooks.slack.com/commands/response'],
      ['trigger_id', 'trigger.slash-command']
    ])
  },
  {
    name: 'SSL check form',
    contentType: 'application/x-www-form-urlencoded',
    body: formBody([
      ['token', 'deprecated-verification-token'],
      ['ssl_check', '1']
    ])
  }
];

let verifySlackRequest = (
  request: WebhookWireRequest,
  secrets: readonly ResolvedWebhookSecret[] = [resolvedSecret(ACTIVE_SIGNING_SECRET)],
  nowMs = NOW_MS
) =>
  verifyWebhookPreset({
    preset: 'slack.v0',
    request,
    secrets,
    nowMs
  });

let withoutHeader = (request: WebhookWireRequest, headerName: string): WebhookWireRequest => ({
  ...request,
  headers: request.headers.filter(([name]) => name.toLowerCase() !== headerName.toLowerCase())
});

let withReplacedHeader = (
  request: WebhookWireRequest,
  headerName: string,
  value: string
): WebhookWireRequest => ({
  ...request,
  headers: request.headers.map(([name, current]) =>
    name.toLowerCase() === headerName.toLowerCase() ? [name, value] : [name, current]
  )
});

let withExtraHeader = (
  request: WebhookWireRequest,
  name: string,
  value: string
): WebhookWireRequest => ({
  ...request,
  headers: [...request.headers, [name, value]]
});

describe('Slack v0 real wire verification', () => {
  it.each(SLACK_BODY_FIXTURES)('accepts $name signed over its exact bytes', fixture => {
    let request = signedSlackRequest(fixture);
    let signature = request.headers.find(
      ([name]) => name.toLowerCase() === 'x-slack-signature'
    )?.[1];
    let timestamp = request.headers.find(
      ([name]) => name.toLowerCase() === 'x-slack-request-timestamp'
    )?.[1];

    expect(signature).toMatch(/^v0=[0-9a-f]{64}$/);
    expect(timestamp).toBe(NOW_SECONDS);
    expect(verifySlackRequest(request)).toEqual({
      status: 'accepted',
      selection: { scope: 'receiver_trigger' },
      presetFields: { timestamp: NOW_SECONDS }
    });
  });

  it.each(
    (() => {
      let body = slackEventCallbackBody('Ev-rejection-matrix');
      let valid = signedSlackRequest({ body, contentType: 'application/json' });
      let validSignature = valid.headers.find(
        ([name]) => name.toLowerCase() === 'x-slack-signature'
      )![1];
      let validTimestamp = valid.headers.find(
        ([name]) => name.toLowerCase() === 'x-slack-request-timestamp'
      )![1];
      return [
        [
          'wrong signing key',
          signedSlackRequest({
            body,
            key: 'wrong-signing-secret',
            contentType: 'application/json'
          }),
          'credential_invalid'
        ],
        [
          'body mutation after signing',
          {
            ...valid,
            body: {
              present: true,
              base64: Buffer.from(`${body}\n`, 'utf8').toString('base64')
            }
          },
          'credential_invalid'
        ],
        ['missing signature', withoutHeader(valid, 'x-slack-signature'), 'credential_missing'],
        [
          'missing timestamp',
          withoutHeader(valid, 'x-slack-request-timestamp'),
          'credential_missing'
        ],
        [
          'duplicate signature',
          withExtraHeader(valid, 'x-slack-signature', validSignature),
          'security_header_ambiguous'
        ],
        [
          'duplicate signature with a case variant',
          withExtraHeader(valid, 'X-Slack-Signature', validSignature),
          'security_header_ambiguous'
        ],
        [
          'duplicate timestamp',
          withExtraHeader(valid, 'x-slack-request-timestamp', validTimestamp),
          'security_header_ambiguous'
        ],
        [
          'duplicate timestamp with a case variant',
          withExtraHeader(valid, 'X-Slack-Request-Timestamp', validTimestamp),
          'security_header_ambiguous'
        ],
        [
          'malformed signature version',
          withReplacedHeader(valid, 'x-slack-signature', `v1=${'aa'.repeat(32)}`),
          'credential_invalid'
        ],
        [
          'non-hex digest',
          withReplacedHeader(valid, 'x-slack-signature', `v0=${'gg'.repeat(32)}`),
          'credential_invalid'
        ],
        [
          'odd-length digest',
          withReplacedHeader(valid, 'x-slack-signature', `v0=${'a'.repeat(63)}`),
          'credential_invalid'
        ],
        [
          'short digest',
          withReplacedHeader(valid, 'x-slack-signature', `v0=${'aa'.repeat(31)}`),
          'credential_invalid'
        ],
        [
          'long digest',
          withReplacedHeader(valid, 'x-slack-signature', `v0=${'aa'.repeat(33)}`),
          'credential_invalid'
        ],
        [
          'timestamp older than 300 seconds',
          signedSlackRequest({
            body,
            timestamp: String(Number(NOW_SECONDS) - 301),
            contentType: 'application/json'
          }),
          'credential_stale'
        ],
        [
          'timestamp more than 60 seconds in the future',
          signedSlackRequest({
            body,
            timestamp: String(Number(NOW_SECONDS) + 61),
            contentType: 'application/json'
          }),
          'credential_future'
        ],
        [
          'invalid signature with matching deprecated token',
          withReplacedHeader(
            signedSlackRequest({
              body: JSON.stringify({
                token: ACTIVE_SIGNING_SECRET,
                type: 'event_callback',
                event_id: 'Ev-deprecated-token'
              }),
              contentType: 'application/json'
            }),
            'x-slack-signature',
            `v0=${'00'.repeat(32)}`
          ),
          'credential_invalid'
        ]
      ] as const;
    })()
  )('rejects %s with the exact safe code', (_name, request, code) => {
    expect(verifySlackRequest(request)).toEqual({ status: 'rejected', code });
  });

  it('accepts active and retiring signing-secret versions but rejects an unknown key', () => {
    let active = resolvedSecret('slack-active-version', { version: 7, status: 'active' });
    let retiring = resolvedSecret('slack-retiring-version', {
      version: 6,
      status: 'retiring',
      validUntil: new Date(NOW_MS + 24 * 60 * 60 * 1000)
    });
    let secrets = [active, retiring];
    let body = slackEventCallbackBody('Ev-secret-rotation');

    for (let key of [active.value, retiring.value]) {
      expect(
        verifySlackRequest(
          signedSlackRequest({ body, key, contentType: 'application/json' }),
          secrets
        )
      ).toMatchObject({
        status: 'accepted',
        presetFields: { timestamp: NOW_SECONDS }
      });
    }

    expect(
      verifySlackRequest(
        signedSlackRequest({
          body,
          key: 'slack-unrecognized-version',
          contentType: 'application/json'
        }),
        secrets
      )
    ).toEqual({ status: 'rejected', code: 'credential_invalid' });
  });
});

let slackEventCallbackRule = {
  id: 'slack.event_callback.v1',
  phase: 'delivery',
  when: {
    methods: ['POST'],
    matcher: {
      jsonBodyField: { path: '/type', equals: 'event_callback' }
    }
  },
  verify: { type: 'preset', preset: 'slack.v0' },
  result: { type: 'dispatch', scope: 'receiver_trigger' },
  replay: {
    kind: 'enforced',
    freshness: {
      source: 'preset',
      presetField: 'timestamp',
      format: 'unix_seconds',
      maxAgeSeconds: 300,
      maxFutureSkewSeconds: 60
    },
    deduplicate: {
      source: 'json_pointer',
      pointer: '/event_id',
      ttlSeconds: 604_800,
      scope: 'request'
    }
  }
} satisfies SlateWebhookVerificationRule;

let slackEventCallbackProjection = (
  secrets: readonly ResolvedWebhookSecret[]
): ExactWebhookTriggerProjection => {
  let state = { cursor: null, deliveries: 0 };
  return {
    receiverId: 'receiver-slack',
    receiverTriggerId: 'receiver-trigger-slack-events',
    actionId: 'slack-events',
    specHash: 'a'.repeat(64),
    registrationStatus: 'registered',
    registrationGeneration: 3,
    registrationVersion: 5,
    verification: {
      mechanism: 'hub',
      baseline: 'receiver_path_secret',
      allowedSecretRefs: [
        {
          source: 'registration',
          name: 'hmac_secret',
          registrationKey: 'hmacSecret',
          encoding: 'utf8'
        }
      ],
      rules: [slackEventCallbackRule]
    },
    secrets,
    actionInputSchema: {
      type: 'object',
      properties: {
        value: { type: 'string' }
      },
      required: ['value'],
      additionalProperties: false
    },
    state,
    stateVersion: 11,
    stateHash: computeWebhookStateHash(state)
  };
};

let responseBodyText = (response: {
  body: { present: false } | { present: true; base64: string };
}) => (response.body.present ? Buffer.from(response.body.base64, 'base64').toString('utf8') : '');

let slackProjection = (
  rule: SlateWebhookVerificationRule,
  actionInputSchema: Record<string, unknown> = {
    type: 'object',
    properties: { value: { type: 'string' } },
    required: ['value'],
    additionalProperties: false
  }
): ExactWebhookTriggerProjection => {
  let state = {};
  return {
    receiverId: 'receiver-slack-sync',
    receiverTriggerId: `receiver-trigger-${rule.id}`,
    actionId: `action-${rule.id}`,
    specHash: 'b'.repeat(64),
    registrationStatus: 'registered',
    registrationGeneration: 1,
    registrationVersion: 1,
    verification: {
      mechanism: 'hub',
      baseline: 'receiver_path_secret',
      allowedSecretRefs: [],
      rules: [rule]
    },
    secrets: [resolvedSecret(ACTIVE_SIGNING_SECRET)],
    actionInputSchema,
    state,
    stateVersion: 0,
    stateHash: computeWebhookStateHash(state)
  };
};

describe('Slack authenticated synchronous exact responses', () => {
  it('returns the URL verification challenge only after exact verification', async () => {
    let memory = createInMemoryWebhookAtomicCommitSeam();
    let mapCalls = 0;
    let rule = {
      id: 'slack.url_verification.v1',
      phase: 'bootstrap',
      when: {
        methods: ['POST'],
        matcher: { jsonBodyField: { path: '/type', equals: 'url_verification' } }
      },
      verify: { type: 'preset', preset: 'slack.v0' },
      result: { type: 'sync_only' },
      replay: { kind: 'not_applicable', reason: 'bootstrap_sync_only' }
    } satisfies SlateWebhookVerificationRule;
    let trigger = slackProjection(rule);
    let request = signedSlackRequest({
      contentType: 'application/json',
      body: JSON.stringify({ type: 'url_verification', challenge: 'slack-challenge' })
    });
    let dependencies: ExactWebhookPipelineDependencies = {
      verifyProvider: async () => {
        throw new Error('Hub preset must not call provider verification');
      },
      mapProvider: async () => {
        mapCalls += 1;
        throw new Error('sync_only must not map');
      },
      atomicCommit: memory.seam
    };

    let accepted = await executeExactWebhookPipeline({
      receiverId: trigger.receiverId,
      requestId: 'slack-url-accepted',
      request,
      triggers: [trigger],
      dependencies,
      nowMs: NOW_MS
    });
    expect(accepted.status).toBe('committed');
    expect(accepted.response?.status).toBe(200);
    expect(accepted.response?.headers).toEqual([
      ['content-type', 'text/plain; charset=utf-8']
    ]);
    expect(responseBodyText(accepted.response!)).toBe('slack-challenge');
    expect(mapCalls).toBe(0);

    let rejected = await executeExactWebhookPipeline({
      receiverId: trigger.receiverId,
      requestId: 'slack-url-rejected',
      request: withReplacedHeader(request, 'x-slack-signature', `v0=${'00'.repeat(32)}`),
      triggers: [trigger],
      dependencies,
      nowMs: NOW_MS
    });
    expect(rejected).toEqual({ status: 'rejected', code: 'credential_invalid' });
    expect(memory.committed).toHaveLength(1);
  });

});

describe('Slack event callback exact pipeline replay behavior', () => {
  it('commits once, deduplicates retries before mapping, and commits a new retry event', async () => {
    let memory = createInMemoryWebhookAtomicCommitSeam();
    let mappedBindings: ExactWebhookRuleBinding[] = [];
    let dependencies: ExactWebhookPipelineDependencies = {
      lookupReplay: async ({ replayKeys }) => ({
        duplicateCandidateIds: replayKeys.some(replayKey => memory.replay.has(replayKey))
          ? ['receiver:0']
          : []
      }),
      verifyProvider: async () => {
        throw new Error('Slack Hub preset must not invoke a provider verifier');
      },
      mapProvider: async ({ bindings }) => {
        mappedBindings.push(bindings);
        return {
          bindings,
          inputs: [{ value: 'mapped' }]
        };
      },
      atomicCommit: memory.seam
    };
    let trigger = slackEventCallbackProjection([resolvedSecret(ACTIVE_SIGNING_SECRET)]);
    let firstRequest = signedSlackRequest({
      body: slackEventCallbackBody('Ev-replay-one'),
      contentType: 'application/json'
    });

    let first = await executeExactWebhookPipeline({
      receiverId: trigger.receiverId,
      requestId: 'request-first',
      request: firstRequest,
      triggers: [trigger],
      dependencies,
      nowMs: NOW_MS
    });
    expect(first).toEqual({ status: 'committed' });

    let duplicate = await executeExactWebhookPipeline({
      receiverId: trigger.receiverId,
      requestId: 'request-duplicate',
      request: firstRequest,
      triggers: [trigger],
      dependencies,
      nowMs: NOW_MS
    });
    expect(duplicate).toEqual({ status: 'duplicate' });

    let sameEventRetry = signedSlackRequest({
      body: slackEventCallbackBody('Ev-replay-one'),
      contentType: 'application/json',
      extraHeaders: [
        ['x-slack-retry-num', '1'],
        ['x-slack-retry-reason', 'http_timeout']
      ]
    });
    let retryDuplicate = await executeExactWebhookPipeline({
      receiverId: trigger.receiverId,
      requestId: 'request-same-event-retry',
      request: sameEventRetry,
      triggers: [trigger],
      dependencies,
      nowMs: NOW_MS
    });
    expect(retryDuplicate).toEqual({ status: 'duplicate' });

    let nextRetry = signedSlackRequest({
      body: slackEventCallbackBody('Ev-replay-two'),
      contentType: 'application/json',
      extraHeaders: [
        ['x-slack-retry-num', '1'],
        ['x-slack-retry-reason', 'http_timeout']
      ]
    });
    let next = await executeExactWebhookPipeline({
      receiverId: trigger.receiverId,
      requestId: 'request-new-retry-event',
      request: nextRetry,
      triggers: [trigger],
      dependencies,
      nowMs: NOW_MS
    });
    expect(next).toEqual({ status: 'committed' });

    expect(mappedBindings).toHaveLength(2);
    expect(mappedBindings.every(binding => binding.ruleId === 'slack.event_callback.v1')).toBe(
      true
    );
    expect(memory.committed).toHaveLength(2);
    expect(memory.replay.size).toBe(2);
    expect(memory.committed.map(commit => commit.dispatches[0]!.replayTtlSeconds)).toEqual([
      604_800, 604_800
    ]);
  });

  it('rejects an atomic replay race claimed after the pre-mapping lookup', async () => {
    let memory = createInMemoryWebhookAtomicCommitSeam();
    let trigger = slackEventCallbackProjection([resolvedSecret(ACTIVE_SIGNING_SECRET)]);
    let eventId = 'Ev-atomic-race';
    let replayKey = `${trigger.receiverTriggerId}:${slackEventCallbackRule.id}:${eventId}`;
    let lookupCalls = 0;
    let dependencies: ExactWebhookPipelineDependencies = {
      lookupReplay: async ({ replayKeys }) => {
        lookupCalls += 1;
        expect(replayKeys).toEqual([replayKey]);
        expect(memory.replay.has(replayKey)).toBe(false);
        return { duplicateCandidateIds: [] };
      },
      verifyProvider: async () => {
        throw new Error('Slack Hub preset must not invoke a provider verifier');
      },
      mapProvider: async ({ bindings }) => ({
        bindings,
        inputs: [{ value: 'mapped' }]
      }),
      atomicCommit: {
        commit: async input => {
          let racingRequestHash = 'f'.repeat(64);
          let racing = await memory.seam.commit({
            ...input,
            requestId: 'request-racing-claimant',
            originalRequestHash: racingRequestHash,
            dispatches: input.dispatches.map(dispatch => ({
              ...dispatch,
              bindings: {
                ...dispatch.bindings,
                requestId: 'request-racing-claimant',
                originalRequestHash: racingRequestHash,
                dispatchRequestHash: racingRequestHash
              }
            }))
          });
          expect(racing).toMatchObject({ status: 'committed' });
          return memory.seam.commit(input);
        }
      }
    };

    let result = await executeExactWebhookPipeline({
      receiverId: trigger.receiverId,
      requestId: 'request-race-loser',
      request: signedSlackRequest({
        body: slackEventCallbackBody(eventId),
        contentType: 'application/json'
      }),
      triggers: [trigger],
      dependencies,
      nowMs: NOW_MS
    });

    expect(result).toEqual({ status: 'rejected', code: 'replay_conflict' });
    expect(lookupCalls).toBe(1);
    expect(memory.committed).toHaveLength(1);
    expect(memory.committed[0]!.requestId).toBe('request-racing-claimant');
  });
});
