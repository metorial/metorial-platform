import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({ db: {}, getImageUrl: vi.fn() }));
import { v1CallbackInstancePresenter } from './callbackInstance';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

describe('v1CallbackInstancePresenter lifecycle', () => {
  it('presents lifecycle and verification mechanism as safe fields', async () => {
    let now = new Date('2026-08-14T12:00:00.000Z');
    let result = await v1CallbackInstancePresenter
      .present(
        {
          callbackInstance: {
            id: 'callback-instance-1',
            status: 'attached',
            registrationStatus: 'failed',
            registrationGeneration: 4,
            registrationTransitionVersion: 2,
            registrationError: {
              code: 'provider_timeout',
              message: 'The provider registration request timed out.',
              metadata: { version: 1 },
              at: now
            },
            lastRegistrationSyncError: null,
            verificationMechanism: 'hub',
            verificationSpecHash: 'a'.repeat(64),
            deployment: {
              id: 'deployment-1',
              isDefault: false,
              name: 'Deployment',
              description: null,
              metadata: null,
              providerId: 'provider-1',
              createdAt: now,
              updatedAt: now
            },
            config: {
              id: 'config-1',
              isDefault: false,
              name: 'Config',
              description: null,
              metadata: null,
              providerId: 'provider-1',
              createdAt: now,
              updatedAt: now
            },
            authConfig: null,
            webhookUrl: 'https://secured.example/opaque',
            security: {
              receiverId: 'receiver-1',
              receiverUrl: 'https://secured.example/opaque',
              pathSecrets: [
                {
                  id: 'path-secret-1',
                  status: 'active',
                  secretVersion: 2,
                  validFrom: now,
                  validUntil: null,
                  rotatedAt: null
                }
              ],
              provisionedApps: [
                {
                  id: 'app-1',
                  vendor: 'github',
                  credentialOwnerType: 'byo',
                  status: 'active',
                  externalAppId: 'external-app-1',
                  githubManifestStateExpiresAt: null,
                  githubManifestCompletedAt: now,
                  githubInstallationCompletedAt: now
                }
              ]
            },
            triggers: [
              {
                id: 'trigger-1',
                source: 'webhook',
                pollIntervalSeconds: null,
                nextPollAt: null,
                lastPolledAt: null,
                webhookUrl: 'https://secured.example/opaque/trigger',
                isWebhookRegistered: false,
                registrationStatus: 'failed',
                registrationGeneration: 4,
                registrationTransitionVersion: 2,
                registrationError: {
                  code: 'provider_timeout',
                  message: 'The provider registration request timed out.',
                  metadata: { version: 1 },
                  at: now
                },
                verificationMechanism: 'hub',
                verificationSpecHash: 'a'.repeat(64),
                providerTrigger: {
                  id: 'provider-trigger-1',
                  key: 'events.created',
                  name: 'Events Created',
                  description: null,
                  inputJsonSchema: {},
                  outputJsonSchema: {},
                  invocation: {
                    type: 'webhook',
                    autoRegistration: { status: 'supported' },
                    autoUnregistration: { status: 'unsupported' }
                  },
                  providerId: 'provider-1',
                  specificationId: 'provider-specification-1',
                  createdAt: now,
                  updatedAt: now
                }
              }
            ],
            createdAt: now,
            updatedAt: now
          } as any
        },
        context
      )
      .run();
    expect(result).toMatchObject({
      registration_status: 'failed',
      verification_mechanism: 'hub'
    });
    expect(result.triggers[0]).toMatchObject({
      registration_status: 'failed',
      verification_mechanism: 'hub'
    });
    expect(result.triggers[0]?.provider_trigger?.invocation).toMatchObject({
      type: 'webhook',
      http: { verification: null }
    });
    expect(result.security).toMatchObject({
      receiver_id: 'receiver-1',
      receiver_url: 'https://secured.example/opaque',
      path_secrets: [{ id: 'path-secret-1', secret_version: 2 }],
      provisioned_apps: [{ id: 'app-1', credential_owner_type: 'byo' }]
    });
    expect(JSON.stringify(result)).not.toMatch(
      /registrationDetails|encryptedValue|ciphertext|plaintext|receipt_token/i
    );
  });
});
