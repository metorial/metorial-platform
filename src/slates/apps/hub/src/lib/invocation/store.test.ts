import { computeSlateConfigSchemaV2Hash } from '@slates/proto';
import { describe, expect, it, vi } from 'vitest';
import {
  assertCanonicalStoredSlateConfigSchema,
  redactWithCanonicalSlateConfigSchema
} from '../configPatch';

vi.mock('../../db', () => ({ db: {} }));
vi.mock('../../storage', () => ({
  invocationsBucketRecord: { bucket: 'test-bucket', oid: 1n },
  storage: { putObject: vi.fn() }
}));

import {
  sanitizeStoredWebhookInvocationArtifact,
  sanitizeWebhookInvocationArtifact,
  storeSlateInvocation
} from './store';

let canonicalSchema = () => {
  let fields = {
    endpoint: { visibility: 'plain' as const, lifecycle: 'none' as const },
    innocuousName: { visibility: 'secret' as const, lifecycle: 'projection' as const }
  };
  let jsonSchema = {
    type: 'object',
    properties: { endpoint: { type: 'string' }, innocuousName: { type: 'string' } },
    additionalProperties: false
  };
  return assertCanonicalStoredSlateConfigSchema({
    version: 2,
    descriptorHash: computeSlateConfigSchemaV2Hash({
      version: 2,
      fieldOrder: Object.keys(fields).sort(),
      fields,
      jsonSchema
    }),
    fields,
    schema: jsonSchema
  });
};

describe('Task 3 scoped invocation production store boundary', () => {
  it.each(['success', 'error', 'timeout', 'cancel', 'direct_console'] as const)(
    'sanitizes stored and reported %s artifacts',
    async outcome => {
      let sentinel = `store-${outcome}-sentinel`;
      let grant = `store-${outcome}-grant`;
      let handle = `store-${outcome}-handle`;
      let persisted: string[] = [];
      let reported: unknown[] = [];
      let logged: unknown[] = [];
      let updates: unknown[] = [];
      await storeSlateInvocation({
        record: { id: `invocation-${outcome}`, oid: 1n } as any,
        requestMessages: [
          {
            jsonrpc: '2.0',
            method: 'slates/session.start',
            params: { sessionId: 'session', state: { ordinary: sentinel } }
          },
          {
            jsonrpc: '2.0',
            id: 'tool-call',
            method: 'slates/tool.call',
            params: { input: { ordinary: sentinel } }
          },
          {
            jsonrpc: '2.0',
            id: 'scoped-call',
            method: 'slates/action.trigger.webhook_verify',
            invocation: {
              version: 'scoped_invocation_grant_v1',
              grantId: grant,
              token: grant,
              requestId: 'scoped-call'
            },
            params: { ordinary: sentinel }
          }
        ] as any,
        responseMessages: [
          {
            jsonrpc: '2.0',
            id: 'tool-call',
            result: {
              ordinary: sentinel,
              requestTraces: [{ url: `https://trace.test/${sentinel}/${grant}` }]
            }
          },
          {
            jsonrpc: '2.0',
            id: 'scoped-call',
            error: { code: -1, message: `${outcome}/${sentinel}/${handle}` }
          }
        ] as any,
        invocationResult: {
          id: `provider-${outcome}`,
          status: outcome === 'success' ? 'succeeded' : 'failed',
          type: outcome === 'success' ? 'success' : 'error',
          functionVersionId: 'function-version',
          billedTimeMs: 1,
          computeTimeMs: 1,
          error: `${outcome}/${sentinel}/${grant}`,
          logs: [
            { timestamp: 1, message: `console ${outcome}/${sentinel}/${grant}/${handle}` }
          ]
        } as any,
        slateVersion: {} as any,
        participants: [],
        scopedSecurity: {
          redactionSentinels: [sentinel],
          forbiddenValues: [grant, handle],
          executionControl: {} as any
        },
        storeDependencies: {
          putObject: async (_bucket, _key, value) => {
            persisted.push(value);
          },
          updateInvocation: async input => {
            updates.push(input);
            throw new Error(`db ${sentinel}/${grant}/${handle}`);
          },
          captureException: error => reported.push(error),
          logError: (_message, error) => logged.push(error)
        }
      });

      expect(persisted).toHaveLength(1);
      expect(updates).toHaveLength(1);
      expect(reported).toHaveLength(1);
      expect(logged).toHaveLength(1);
      for (let artifact of [...persisted, ...reported, ...logged]) {
        let serialized =
          artifact instanceof Error
            ? `${artifact.message}\n${artifact.stack}`
            : typeof artifact === 'string'
              ? artifact
              : JSON.stringify(artifact);
        expect(serialized).not.toContain(sentinel);
        expect(serialized).not.toContain(grant);
        expect(serialized).not.toContain(handle);
      }
      expect(persisted[0]).not.toContain('scoped_invocation_grant_v1');
    }
  );

  it('persists provider-sanitized tool artifacts while Hub remains presence-only', async () => {
    let persisted = '';
    await storeSlateInvocation({
      record: { id: 'presence-only-tool', oid: 3n } as any,
      requestMessages: [
        {
          jsonrpc: '2.0',
          id: 'tool-call',
          method: 'slates/action.tool.invoke',
          invocation: {
            version: 'scoped_invocation_grant_v1',
            grantId: 'opaque-grant',
            token: 'opaque-token',
            requestId: 'tool-call'
          },
          params: { input: {} }
        }
      ] as any,
      responseMessages: [
        {
          jsonrpc: '2.0',
          id: 'tool-call',
          result: {
            output: { ok: true },
            message: '[redacted]',
            requestTraces: [{ request: { url: 'https://example.test/[redacted]' } }]
          }
        }
      ] as any,
      invocationResult: {
        id: 'provider-presence-only',
        status: 'succeeded',
        type: 'success',
        functionVersionId: 'function-version',
        billedTimeMs: 1,
        computeTimeMs: 1,
        logs: [{ timestamp: 1, message: 'console [redacted]' }]
      } as any,
      slateVersion: {} as any,
      participants: [],
      scopedSecurity: {
        redactionSentinels: [],
        forbiddenValues: ['opaque-grant', 'opaque-token'],
        executionControl: {} as any
      },
      storeDependencies: {
        putObject: async (_bucket, _key, value) => {
          persisted = value;
        },
        updateInvocation: async () => {},
        captureException: () => {},
        logError: () => {}
      }
    });

    expect(persisted).toContain('[redacted]');
    expect(persisted).not.toContain('opaque-grant');
    expect(persisted).not.toContain('opaque-token');
    expect(persisted).not.toContain('scoped_invocation_grant_v1');
  });
});

describe('Task 5 webhook invocation sanitization', () => {
  it.each(['result', 'error'] as const)(
    'removes secured request and secret material from %s terminal artifacts',
    terminal => {
      let secret = 'top-secret-value';
      let value = {
        method: 'slates/action.trigger.webhook_register',
        params: {
          url: `https://hooks.test/slates-hub/triggers/webhook/id/${secret}?token=${secret}`,
          headers: [
            ['Authorization', secret],
            ['Content-Type', 'application/json']
          ],
          body: { encoding: 'base64', content: Buffer.from(secret).toString('base64') },
          suggestedSecrets: { signing: secret },
          registrationDetails: { token: secret },
          config: { apiKey: secret }
        },
        [terminal]: {
          capturedSecrets: { signing: secret },
          decryptedRegistrationData: secret
        }
      };
      let sanitized = sanitizeWebhookInvocationArtifact(value);
      let serialized = JSON.stringify(sanitized);
      expect(serialized).not.toContain(secret);
      expect(serialized).not.toContain(Buffer.from(secret).toString('base64'));
      expect(serialized).toContain('[REDACTED]');
      expect(serialized).toContain('sha256');
    }
  );

  it('redacts all descriptor roots through the exact canonical schema while preserving plain roots', () => {
    let canonical = canonicalSchema();
    let value = {
      config: { endpoint: 'https://safe.test', innocuousName: 'root-secret' },
      nested: { innocuousName: { token: 'nested-secret' } }
    };
    let sanitized = redactWithCanonicalSlateConfigSchema(value, canonical);
    expect(sanitized).toEqual({
      config: { endpoint: 'https://safe.test', innocuousName: '[REDACTED]' },
      nested: { innocuousName: '[REDACTED]' }
    });
    expect(Object.isFrozen(canonical)).toBe(true);
    expect(Object.isFrozen(canonical.fields.innocuousName)).toBe(true);
    expect(Object.isFrozen(canonical.jsonSchema)).toBe(true);
  });

  it('uses canonical config values to redact persistence and logs without heuristic key names', async () => {
    let persisted = '';
    await storeSlateInvocation({
      record: { id: 'config-invocation', oid: 2n } as any,
      requestMessages: [
        {
          jsonrpc: '2.0',
          id: 'config-changed-1',
          method: 'slates/config.changed',
          params: {
            previousConfig: { endpoint: 'https://safe.test', innocuousName: 'old-secret' },
            newConfig: { endpoint: 'https://safe.test/new', innocuousName: 'new-secret' }
          }
        }
      ] as any,
      responseMessages: [
        {
          jsonrpc: '2.0',
          id: 'config-changed-1',
          result: { config: { innocuousName: 'response-secret' } }
        }
      ] as any,
      invocationResult: {
        id: 'provider-config',
        status: 'succeeded',
        type: 'success',
        functionVersionId: 'function-version',
        billedTimeMs: 1,
        computeTimeMs: 1,
        logs: [{ timestamp: 1, message: 'old-secret/new-secret/response-secret' }]
      } as any,
      slateVersion: {} as any,
      participants: [],
      canonicalConfigSchema: canonicalSchema(),
      storeDependencies: {
        putObject: async (_bucket, _key, value) => {
          persisted = value;
        },
        updateInvocation: async () => {},
        captureException: () => {},
        logError: () => {}
      }
    });
    expect(persisted).toContain('https://safe.test');
    expect(persisted).not.toMatch(/old-secret|new-secret|response-secret/);
  });
});
