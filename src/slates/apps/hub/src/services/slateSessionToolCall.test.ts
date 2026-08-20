import { computeSlateConfigSchemaV2Hash } from '@slates/proto';
import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

let { authMock, dbMock, errorMock, invocationMock, securityMock, sessionMock } = vi.hoisted(
  () => ({
    authMock: {
      getSlateInstanceAuthMetadata: vi.fn(),
      getSlateInstanceAuth: vi.fn()
    },
    dbMock: {
      slateAction: { findFirst: vi.fn() },
      slateDeployment: { findFirst: vi.fn() },
      slateInstance: { findUniqueOrThrow: vi.fn() },
      slateInstanceConfigSecret: { findMany: vi.fn() },
      slateSession: { findFirst: vi.fn(), updateMany: vi.fn() },
      slateSessionToolCall: { create: vi.fn() },
      slateTriggerReceiver: { findMany: vi.fn() }
    },
    errorMock: { recordSlateError: vi.fn(async () => {}) },
    invocationMock: {
      createInvocationWithState: vi.fn(),
      invokeToolAction: vi.fn()
    },
    securityMock: {
      issueToolGrant: vi.fn(),
      grants: { revoke: vi.fn() }
    },
    sessionMock: { getSessionVersion: vi.fn() }
  })
);

vi.mock('../db', () => ({ db: dbMock }));
vi.mock('../lib/invocation/store', () => ({
  getStoredAttachmentsStorageKey: vi.fn((digest: string) => `attachments/${digest}`)
}));
vi.mock('../storage', () => ({
  invocationsBucketRecord: { bucket: 'test' },
  storage: {}
}));
vi.mock('../id', () => ({
  getId: (type: string) => ({ oid: 900n, id: `${type}-id` }),
  ID: { generateId: vi.fn(async () => 'invocation-1') }
}));
vi.mock('./slateError', () => ({ slateErrorService: errorMock }));
vi.mock('./slateInstanceAuthHandler', () => ({ slateAuthHandlerService: authMock }));
vi.mock('./slateInvocation', () => ({ slateInvocationService: invocationMock }));
vi.mock('./slateSession', () => ({ slateSessionService: sessionMock }));
vi.mock('./slateTriggerReceiverSecurity', () => ({
  slateTriggerReceiverProductionSecurity: securityMock
}));

import { slateSessionToolCallService } from './slateSessionToolCall';
import {
  computeWebhookStateHash,
  createInMemoryWebhookAtomicCommitSeam,
  executeExactWebhookPipeline,
  type ExactWebhookRuleBinding,
  type ExactWebhookTriggerProjection
} from '../lib/webhookVerification';

afterEach(() => vi.resetAllMocks());

describe('slate session tool-call classified boundary', () => {
  it('issues before auth decryption, sends only presence plus an opaque grant, and persists no classified material', async () => {
    let fields = {
      apiKey: { visibility: 'secret' as const, lifecycle: 'projection' as const }
    };
    let jsonSchema = {
      type: 'object',
      properties: { apiKey: { type: 'string' } },
      required: ['apiKey'],
      additionalProperties: false
    };
    let descriptorHash = computeSlateConfigSchemaV2Hash({
      version: 2,
      fieldOrder: ['apiKey'],
      fields,
      jsonSchema
    });
    let now = new Date();
    let session = {
      oid: 10n,
      id: 'session-1',
      tenantOid: 1n,
      slateOid: 2n,
      slateVersionOid: 3n,
      slateInstanceOid: 4n,
      lastActiveAt: now,
      createdAt: now,
      slate: { oid: 2n, currentVersionOid: 3n },
      tenant: { oid: 1n, id: 'tenant-1' },
      slateInstance: {
        oid: 4n,
        id: 'instance-1',
        currentConfig: {
          oid: 5n,
          id: 'config-1',
          value: { apiKey: { configured: true } },
          schema: {
            version: 2,
            descriptorHash,
            fields,
            schema: jsonSchema
          },
          secrets: []
        }
      },
      slateVersion: {
        oid: 3n,
        id: 'version-1',
        status: 'active',
        activeDeploymentOid: 12n,
        providerDeploymentInfo: {},
        specification: {
          oid: 6n,
          authMethods: [{}],
          providerInfo: {
            capabilities: { configSchemaV2: true, scopedInvocationGrantV1: true }
          }
        }
      },
      instanceConfiguration: null
    };
    dbMock.slateSession.findFirst.mockResolvedValue(session);
    dbMock.slateAction.findFirst.mockResolvedValue({ oid: 7n, key: 'read' });
    dbMock.slateDeployment.findFirst.mockResolvedValue({
      id: 'deployment-1',
      runtimeIdentityId: 'runtime-1',
      runtimeIdentityGeneration: 2
    });
    dbMock.slateInstanceConfigSecret.findMany.mockResolvedValue([
      { key: 'apiKey', secretVersion: 11 }
    ]);
    authMock.getSlateInstanceAuthMetadata.mockResolvedValue({
      authConfig: { id: 'auth-config-1', updatedAt: now },
      authMethod: { key: 'api_token' }
    });
    let envelope = {
      version: 'scoped_invocation_grant_v1' as const,
      grantId: 'opaque-grant',
      token: 'opaque-token',
      requestId: 'request-1'
    };
    securityMock.issueToolGrant.mockResolvedValue(envelope);
    let clearClassifiedInvocation = vi.fn();
    invocationMock.createInvocationWithState.mockResolvedValue({ clearClassifiedInvocation });
    invocationMock.invokeToolAction.mockResolvedValue({
      status: 'success',
      data: { output: { ok: true }, message: 'done', attachments: [] },
      invocation: { oid: 8n, id: 'invocation-1' }
    });
    dbMock.slateSessionToolCall.create.mockImplementation(async ({ data }: any) => data);

    await slateSessionToolCallService.createSlateToolCall({
      input: {
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        toolId: 'read',
        authConfigId: 'auth-config-1',
        input: {},
        participants: []
      }
    });

    expect(authMock.getSlateInstanceAuth).not.toHaveBeenCalled();
    expect(authMock.getSlateInstanceAuthMetadata.mock.invocationCallOrder[0]).toBeLessThan(
      securityMock.issueToolGrant.mock.invocationCallOrder[0]!
    );
    expect(invocationMock.createInvocationWithState).toHaveBeenCalledWith(
      expect.objectContaining({
        config: { apiKey: { configured: true } },
        auth: {
          authenticationMethodId: 'api_token',
          data: { $output: { configured: true } }
        },
        artifactSecurity: {
          redactionSentinels: [],
          forbiddenValues: ['opaque-grant', 'opaque-token']
        }
      })
    );
    expect(invocationMock.invokeToolAction).toHaveBeenCalledWith(
      expect.objectContaining({ invocation: envelope })
    );
    expect(securityMock.issueToolGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        deploymentId: 'deployment-1',
        runtimeIdentityId: 'runtime-1',
        runtimeIdentityGeneration: 2,
        hubInvocationId: 'invocation-1'
      })
    );
    let persisted = dbMock.slateSessionToolCall.create.mock.calls[0]![0].data;
    expect(Object.keys(persisted).sort()).toEqual(
      [
        'actionOid',
        'durationMs',
        'errorCode',
        'errorMessage',
        'id',
        'invocationOid',
        'oid',
        'sessionOid',
        'slateVersionOid',
        'status'
      ].sort()
    );
    expect(clearClassifiedInvocation).toHaveBeenCalledOnce();
    expect(securityMock.grants.revoke).toHaveBeenCalledWith(envelope);

    securityMock.grants.revoke.mockClear();
    invocationMock.invokeToolAction.mockClear();
    invocationMock.createInvocationWithState.mockRejectedValueOnce(
      new Error('invocation storage unavailable')
    );

    await expect(
      slateSessionToolCallService.createSlateToolCall({
        input: {
          tenantId: 'tenant-1',
          sessionId: 'session-1',
          toolId: 'read',
          authConfigId: 'auth-config-1',
          input: {},
          participants: []
        }
      })
    ).rejects.toThrow('invocation storage unavailable');
    expect(invocationMock.invokeToolAction).not.toHaveBeenCalled();
    expect(securityMock.grants.revoke).toHaveBeenCalledOnce();
    expect(securityMock.grants.revoke).toHaveBeenCalledWith(envelope);
  });

  it('binds one eligible receiver generation and projected secret without persisting authority', async () => {
    let fields = {};
    let jsonSchema = {
      type: 'object',
      properties: {},
      additionalProperties: false
    };
    let descriptorHash = computeSlateConfigSchemaV2Hash({
      version: 2,
      fieldOrder: [],
      fields,
      jsonSchema
    });
    let now = new Date();
    dbMock.slateSession.findFirst.mockResolvedValue({
      oid: 10n,
      id: 'session-1',
      tenantOid: 1n,
      slateOid: 2n,
      slateVersionOid: 3n,
      slateInstanceOid: 4n,
      lastActiveAt: now,
      createdAt: now,
      slate: { oid: 2n, currentVersionOid: 3n },
      tenant: { oid: 1n, id: 'tenant-1' },
      slateInstance: {
        oid: 4n,
        id: 'instance-1',
        currentConfig: {
          oid: 5n,
          id: 'config-1',
          value: {},
          schema: {
            version: 2,
            descriptorHash,
            fields,
            schema: jsonSchema
          },
          secrets: []
        }
      },
      slateVersion: {
        oid: 3n,
        id: 'version-1',
        status: 'active',
        activeDeploymentOid: 12n,
        providerDeploymentInfo: {},
        specification: {
          oid: 6n,
          authMethods: [],
          providerInfo: {
            capabilities: {
              configSchemaV2: true,
              scopedInvocationGrantV1: true,
              receiverBoundToolContextV1: true
            }
          }
        }
      },
      instanceConfiguration: null
    });
    dbMock.slateAction.findFirst.mockResolvedValue({
      oid: 7n,
      key: 'launch_agent',
      spec: {
        capabilities: {
          receiverBoundToolContextV1: { secretNames: ['cursor_webhook_secret'] }
        }
      }
    });
    dbMock.slateTriggerReceiver.findMany.mockResolvedValue([
      {
        id: 'receiver-1',
        triggers: [
          {
            id: 'receiver-trigger-1',
            registrationGeneration: 8,
            registrationVersion: 13,
            verificationSpecHash: 'a'.repeat(64),
            action: {
              key: 'agent_status_change',
              spec: { specHash: 'a'.repeat(64) }
            },
            boundSecrets: [
              {
                name: 'cursor_webhook_secret',
                specHash: 'a'.repeat(64),
                status: 'active',
                secretVersion: 21
              }
            ]
          }
        ]
      }
    ]);
    dbMock.slateDeployment.findFirst.mockResolvedValue({
      id: 'deployment-1',
      runtimeIdentityId: 'runtime-1',
      runtimeIdentityGeneration: 2
    });
    dbMock.slateInstanceConfigSecret.findMany.mockResolvedValue([]);
    let envelope = {
      version: 'scoped_invocation_grant_v1' as const,
      grantId: 'opaque-grant',
      token: 'opaque-token',
      requestId: 'request-1'
    };
    securityMock.issueToolGrant.mockResolvedValue(envelope);
    invocationMock.createInvocationWithState.mockResolvedValue({
      clearClassifiedInvocation: vi.fn()
    });
    invocationMock.invokeToolAction.mockResolvedValue({
      status: 'success',
      data: { output: { agentId: 'agent-1' }, message: 'launched', attachments: [] },
      invocation: { oid: 8n, id: 'invocation-1' }
    });
    dbMock.slateSessionToolCall.create.mockImplementation(async ({ data }: any) => data);

    await slateSessionToolCallService.createSlateToolCall({
      input: {
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        toolId: 'launch_agent',
        receiverCallbackSelector: 'receiver-1',
        input: { prompt: 'Fix the build' },
        participants: []
      }
    });

    expect(securityMock.issueToolGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'launch_agent',
        receiverCallback: {
          receiverId: 'receiver-1',
          receiverTriggerId: 'receiver-trigger-1',
          triggerActionId: 'agent_status_change',
          specHash: 'a'.repeat(64),
          registrationGeneration: 8,
          registrationVersion: 13,
          projectedSecretVersions: { cursor_webhook_secret: 21 }
        }
      })
    );
    expect(invocationMock.invokeToolAction).toHaveBeenCalledWith(
      expect.objectContaining({ input: { prompt: 'Fix the build' }, invocation: envelope })
    );
    let storedCall = dbMock.slateSessionToolCall.create.mock.calls[0]![0].data;
    let serializedStoredCall = JSON.stringify(storedCall, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
    expect(serializedStoredCall).not.toContain('receiver-1');
    expect(serializedStoredCall).not.toContain('cursor_webhook_secret');
    expect(serializedStoredCall).not.toContain('opaque-token');
  });

  it('fails before grant issue when provider receiver capability is absent', async () => {
    let fields = {};
    let jsonSchema = { type: 'object', properties: {}, additionalProperties: false };
    let descriptorHash = computeSlateConfigSchemaV2Hash({
      version: 2,
      fieldOrder: [],
      fields,
      jsonSchema
    });
    let now = new Date();
    dbMock.slateSession.findFirst.mockResolvedValue({
      oid: 10n,
      id: 'session-1',
      tenantOid: 1n,
      slateOid: 2n,
      slateVersionOid: 3n,
      slateInstanceOid: 4n,
      lastActiveAt: now,
      createdAt: now,
      slate: { oid: 2n, currentVersionOid: 3n },
      tenant: { oid: 1n, id: 'tenant-1' },
      slateInstance: {
        oid: 4n,
        id: 'instance-1',
        currentConfig: {
          oid: 5n,
          value: {},
          schema: { version: 2, descriptorHash, fields, schema: jsonSchema },
          secrets: []
        }
      },
      slateVersion: {
        oid: 3n,
        id: 'version-1',
        status: 'active',
        activeDeploymentOid: 12n,
        providerDeploymentInfo: {},
        specification: {
          oid: 6n,
          authMethods: [],
          providerInfo: {
            capabilities: { configSchemaV2: true, scopedInvocationGrantV1: true }
          }
        }
      },
      instanceConfiguration: null
    });
    dbMock.slateAction.findFirst.mockResolvedValue({
      oid: 7n,
      key: 'launch_agent',
      spec: {
        capabilities: {
          receiverBoundToolContextV1: { secretNames: ['cursor_webhook_secret'] }
        }
      }
    });
    dbMock.slateTriggerReceiver.findMany.mockResolvedValue([
      {
        id: 'receiver-1',
        triggers: [
          {
            id: 'receiver-trigger-1',
            registrationGeneration: 8,
            registrationVersion: 13,
            verificationSpecHash: 'a'.repeat(64),
            action: {
              key: 'agent_status_change',
              spec: { specHash: 'a'.repeat(64) }
            },
            boundSecrets: [
              {
                name: 'cursor_webhook_secret',
                specHash: 'a'.repeat(64),
                status: 'active',
                secretVersion: 21
              }
            ]
          }
        ]
      }
    ]);

    await expect(
      slateSessionToolCallService.createSlateToolCall({
        input: {
          tenantId: 'tenant-1',
          sessionId: 'session-1',
          toolId: 'launch_agent',
          receiverCallbackSelector: 'receiver-1',
          input: { prompt: 'Fix the build' },
          participants: []
        }
      })
    ).rejects.toThrow('does not support receiver-bound tool context');
    expect(securityMock.issueToolGrant).not.toHaveBeenCalled();
    expect(invocationMock.invokeToolAction).not.toHaveBeenCalled();
  });

  it.each(['success', 'failure', 'timeout', 'cancel'] as const)(
    'runs Metorial to Hub to Cursor launch_agent with %s and keeps callback authority out of persistence and logs',
    async outcome => {
      let fields = {};
      let jsonSchema = { type: 'object', properties: {}, additionalProperties: false };
      let descriptorHash = computeSlateConfigSchemaV2Hash({
        version: 2,
        fieldOrder: [],
        fields,
        jsonSchema
      });
      let now = new Date();
      let session = {
        oid: 10n,
        id: 'session-1',
        tenantOid: 1n,
        slateOid: 2n,
        slateVersionOid: 3n,
        slateInstanceOid: 4n,
        lastActiveAt: now,
        createdAt: now,
        slate: { oid: 2n, currentVersionOid: 3n },
        tenant: { oid: 1n, id: 'tenant-1' },
        slateInstance: {
          oid: 4n,
          id: 'instance-1',
          currentConfig: {
            oid: 5n,
            id: 'config-1',
            value: {},
            schema: { version: 2, descriptorHash, fields, schema: jsonSchema },
            secrets: []
          }
        },
        slateVersion: {
          oid: 3n,
          id: 'version-1',
          status: 'active',
          activeDeploymentOid: 12n,
          providerDeploymentInfo: {},
          specification: {
            oid: 6n,
            authMethods: [],
            providerInfo: {
              capabilities: {
                configSchemaV2: true,
                scopedInvocationGrantV1: true,
                receiverBoundToolContextV1: true
              }
            }
          }
        },
        instanceConfiguration: null
      };
      dbMock.slateSession.findFirst.mockResolvedValue(session);
      dbMock.slateAction.findFirst.mockResolvedValue({
        oid: 7n,
        key: 'launch_agent',
        spec: {
          capabilities: {
            receiverBoundToolContextV1: { secretNames: ['cursor_webhook_secret'] }
          }
        }
      });
      dbMock.slateTriggerReceiver.findMany.mockResolvedValue([
        {
          id: 'cursor-callback-receiver',
          triggers: [
            {
              id: 'cursor-callback-trigger',
              registrationGeneration: 8,
              registrationVersion: 13,
              verificationSpecHash: 'a'.repeat(64),
              action: {
                key: 'agent_status_change',
                spec: { specHash: 'a'.repeat(64) }
              },
              boundSecrets: [
                {
                  name: 'cursor_webhook_secret',
                  specHash: 'a'.repeat(64),
                  status: 'active',
                  secretVersion: 21
                }
              ]
            }
          ]
        }
      ]);
      dbMock.slateDeployment.findFirst.mockResolvedValue({
        id: 'deployment-1',
        runtimeIdentityId: 'runtime-1',
        runtimeIdentityGeneration: 2
      });
      dbMock.slateInstanceConfigSecret.findMany.mockResolvedValue([]);
      dbMock.slateSessionToolCall.create.mockImplementation(async ({ data }: any) => data);
      dbMock.slateSession.updateMany.mockResolvedValue({ count: 1 });
      errorMock.recordSlateError.mockResolvedValue(undefined);

      let grant = {
        version: 'scoped_invocation_grant_v1' as const,
        grantId: 'classified-cursor-grant',
        token: 'classified-cursor-token',
        requestId: 'cursor-request'
      };
      securityMock.issueToolGrant.mockResolvedValue(grant);
      securityMock.grants.revoke.mockResolvedValue(undefined);
      let clearClassifiedInvocation = vi.fn();
      invocationMock.createInvocationWithState.mockResolvedValue({
        clearClassifiedInvocation
      });

      let callbackSecret = 'classified-cursor-webhook-secret';
      let callbackResult: Awaited<ReturnType<typeof executeExactWebhookPipeline>> | null =
        null;
      let callbackMemory = createInMemoryWebhookAtomicCommitSeam();
      invocationMock.invokeToolAction.mockImplementation(
        async ({ invocation, actionId, input }: any) => {
          expect(invocation).toEqual(grant);
          expect(actionId).toBe('launch_agent');
          expect(input).toEqual({ promptText: 'Fix the build' });
          if (outcome === 'success') {
            let callbackBody = JSON.stringify({
              event: 'statusChange',
              timestamp: '2026-08-15T00:00:00.000Z',
              id: 'cursor-agent-1',
              status: 'FINISHED',
              summary: 'Build fixed'
            });
            let signature = `sha256=${createHmac('sha256', callbackSecret)
              .update(callbackBody)
              .digest('hex')}`;
            let callbackRule = {
              id: 'cursor.delivery.v1',
              phase: 'delivery',
              when: { methods: ['POST'], registrationStatuses: ['registered'] },
              verify: {
                type: 'provider',
                verifierId: 'cursor.delivery.v1',
                allowedSecretRefs: ['cursor_webhook_secret'],
                allowedBootstrapCaptureRefs: []
              },
              result: { type: 'dispatch', scope: 'receiver_trigger' },
              replay: {
                kind: 'enforced',
                freshness: {
                  source: 'json_pointer',
                  pointer: '/timestamp',
                  format: 'rfc3339',
                  maxAgeSeconds: 600,
                  maxFutureSkewSeconds: 60
                },
                deduplicate: {
                  source: 'json_pointer',
                  pointer: '/id',
                  ttlSeconds: 86_400,
                  scope: 'request'
                }
              }
            } as const;
            let callbackTrigger: ExactWebhookTriggerProjection = {
              receiverId: 'cursor-callback-receiver',
              receiverTriggerId: 'cursor-callback-trigger',
              actionId: 'agent_status_change',
              specHash: 'a'.repeat(64),
              registrationStatus: 'registered',
              registrationGeneration: 8,
              registrationVersion: 13,
              verification: {
                mechanism: 'provider',
                baseline: 'receiver_path_secret',
                reason: 'Cursor signs the exact callback body.',
                allowedSecretRefs: [],
                rules: [callbackRule]
              },
              secrets: [
                {
                  name: 'cursor_webhook_secret',
                  value: callbackSecret,
                  encoding: 'utf8',
                  version: 21,
                  status: 'active'
                }
              ],
              actionInputSchema: {
                type: 'object',
                properties: {
                  agentId: { type: 'string' },
                  status: { type: 'string' },
                  timestamp: { type: 'string' }
                },
                required: ['agentId', 'status', 'timestamp'],
                additionalProperties: false
              },
              state: {},
              stateVersion: 1,
              stateHash: computeWebhookStateHash({})
            };
            callbackResult = await executeExactWebhookPipeline({
              receiverId: 'cursor-callback-receiver',
              requestId: 'cursor-callback-request',
              request: {
                url: 'https://hooks.test/receivers/cursor-callback-receiver',
                method: 'POST',
                headers: [['x-webhook-signature', signature]],
                body: {
                  present: true,
                  base64: Buffer.from(callbackBody).toString('base64')
                }
              },
              triggers: [callbackTrigger],
              dependencies: {
                verifyProvider: async ({ trigger, request }) => {
                  let supplied = request.headers.filter(
                    ([name]) => name.toLowerCase() === 'x-webhook-signature'
                  );
                  let body = request.body.present
                    ? Buffer.from(request.body.base64, 'base64')
                    : null;
                  let projected = trigger.secrets.find(
                    item => item.name === 'cursor_webhook_secret'
                  )?.value;
                  if (!body || supplied.length !== 1 || !projected) {
                    return { status: 'rejected', code: 'credential_missing' };
                  }
                  let expected = `sha256=${createHmac('sha256', projected)
                    .update(body)
                    .digest('hex')}`;
                  return supplied[0]![1] === expected
                    ? {
                        status: 'accepted',
                        selection: { scope: 'receiver_trigger' }
                      }
                    : { status: 'rejected', code: 'credential_invalid' };
                },
                mapProvider: async ({ bindings, request }) => {
                  let body = JSON.parse(
                    Buffer.from(
                      request.body.present ? request.body.base64 : '',
                      'base64'
                    ).toString('utf8')
                  );
                  return {
                    bindings: bindings as ExactWebhookRuleBinding,
                    inputs: [
                      {
                        agentId: body.id,
                        status: body.status,
                        timestamp: body.timestamp
                      }
                    ]
                  };
                },
                atomicCommit: callbackMemory.seam
              },
              nowMs: Date.parse('2026-08-15T00:00:00.000Z')
            });
            return {
              status: 'success',
              data: {
                output: { agentId: 'cursor-agent-1' },
                message: 'launched',
                attachments: []
              },
              invocation: { oid: 8n, id: 'invocation-1' }
            };
          }
          let errorByOutcome = {
            failure: { code: 'provider_error', message: 'Cursor launch failed' },
            timeout: { code: 'provider_timeout', message: 'Cursor launch timed out' },
            cancel: { code: 'provider_cancelled', message: 'Cursor launch cancelled' }
          } as const;
          return {
            status: 'error',
            error: errorByOutcome[outcome],
            invocation: { oid: 8n, id: 'invocation-1' }
          };
        }
      );
      let consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      let consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        let result = await slateSessionToolCallService.createSlateToolCall({
          input: {
            tenantId: 'tenant-1',
            sessionId: 'session-1',
            toolId: 'launch_agent',
            receiverCallbackSelector: 'cursor-callback-receiver',
            input: { promptText: 'Fix the build' },
            participants: []
          }
        });
        expect(result.status).toBe(outcome === 'success' ? 'success' : 'error');
        expect(clearClassifiedInvocation).toHaveBeenCalledOnce();
        expect(securityMock.grants.revoke).toHaveBeenCalledWith(grant);
        expect(securityMock.issueToolGrant).toHaveBeenCalledWith(
          expect.objectContaining({
            actionId: 'launch_agent',
            receiverCallback: expect.objectContaining({
              receiverId: 'cursor-callback-receiver',
              receiverTriggerId: 'cursor-callback-trigger',
              projectedSecretVersions: { cursor_webhook_secret: 21 }
            })
          })
        );
        let stored = dbMock.slateSessionToolCall.create.mock.calls[0]![0].data;
        expect(stored.status).toBe(outcome === 'success' ? 'succeeded' : 'failed');
        expect(callbackResult?.status ?? null).toBe(
          outcome === 'success' ? 'committed' : null
        );
        expect(callbackMemory.committed).toHaveLength(outcome === 'success' ? 1 : 0);
        let durableAndLogSurfaces = JSON.stringify(
          {
            stored,
            errorAudit: errorMock.recordSlateError.mock.calls,
            consoleError: consoleError.mock.calls,
            consoleLog: consoleLog.mock.calls
          },
          (_key, value) => (typeof value === 'bigint' ? value.toString() : value)
        );
        for (let forbidden of [
          callbackSecret,
          grant.grantId,
          grant.token,
          'cursor_webhook_secret',
          'cursor-callback-receiver'
        ]) {
          expect(durableAndLogSurfaces).not.toContain(forbidden);
        }
        let callbackPersistence = JSON.stringify(callbackMemory.committed);
        for (let forbidden of [callbackSecret, grant.grantId, grant.token]) {
          expect(callbackPersistence).not.toContain(forbidden);
        }
      } finally {
        consoleError.mockRestore();
        consoleLog.mockRestore();
      }
    }
  );
});
