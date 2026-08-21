import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({ db: {}, getImageUrl: vi.fn() }));
vi.mock('@metorial-subspace/db', () => ({}));
import {
  v1CallbackInstancePresenter,
  v1CallbackReceiverPathSecretPresenter
} from './callbackInstance';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;
let now = new Date('2026-08-21T12:00:00.000Z');

let callbackInstance = {
  id: 'cbi_1',
  status: 'attached',
  registrationStatus: 'failed',
  registrationGeneration: 3,
  registrationTransitionVersion: 7,
  registrationErrorCode: 'provider_timeout',
  registrationErrorMessage: 'Registration timed out.',
  registrationErrorMetadata: { operation: 'register', attempt: 2 },
  registrationErrorAt: now,
  lastRegistrationSyncErrorCode: null,
  lastRegistrationSyncErrorMessage: null,
  lastRegistrationSyncErrorAt: null,
  verificationMechanism: 'hub',
  verificationSpecHash: 'a'.repeat(64),
  providerDeploymentConfigPair: {
    providerDeploymentVersion: {
      deployment: {
        id: 'pde_1',
        isDefault: false,
        name: 'Production',
        description: null,
        metadata: null,
        provider: { id: 'pro_1' },
        createdAt: now,
        updatedAt: now
      }
    },
    providerConfigVersion: {
      config: {
        id: 'pcf_1',
        isDefault: false,
        name: 'Config',
        description: null,
        metadata: null,
        createdAt: now,
        updatedAt: now
      }
    },
    providerAuthConfigVersion: null
  },
  createdAt: now,
  updatedAt: now
};

let receiver = {
  receiverWebhookUrl: 'https://hooks.example.test/slates-hub/triggers/receiver-webhook/str_1',
  receiverPathSecret: {
    id: 'sec_path_1',
    generation: 4,
    createdAt: now,
    updatedAt: now
  },
  triggers: [
    {
      id: 'strt_1',
      active: true,
      authoritativeStateVersion: 9,
      triggerId: 'provider-trigger-spec-1',
      triggerKey: 'events.created',
      triggerName: 'Events Created',
      source: 'webhook',
      eventTypes: ['event.created'],
      pollIntervalSeconds: null,
      nextPollAt: null,
      lastPolledAt: null,
      webhookUrl: 'https://hooks.example.test/slates-hub/triggers/webhook/strt_1',
      isWebhookRegistered: false,
      registrationStatus: 'failed',
      registrationGeneration: 3,
      registrationTransitionVersion: 7,
      registrationError: {
        code: 'provider_timeout',
        message: 'Registration timed out.',
        metadata: { operation: 'register', attempt: 2 },
        at: now
      },
      verificationMechanism: 'hub',
      verificationSpecHash: 'a'.repeat(64),
      providerTrigger: null
    }
  ]
};

describe('v1CallbackInstancePresenter simplified security metadata', () => {
  it('presents one metadata-only receiver path secret and trigger lifecycle tuples', async () => {
    let result = await v1CallbackInstancePresenter
      .present(
        { callbackInstance: callbackInstance as never, receiver: receiver as never },
        context
      )
      .run();

    expect(result).toMatchObject({
      registration_status: 'failed',
      registration_error: {
        code: 'provider_timeout',
        metadata: { operation: 'register', attempt: 2 }
      },
      verification_mechanism: 'hub',
      receiver_path_secret: {
        object: 'callback.receiver_path_secret#metadata',
        id: 'sec_path_1',
        generation: 4
      },
      triggers: [
        {
          active: true,
          authoritative_state_version: 9,
          registration_status: 'failed',
          registration_generation: 3,
          registration_transition_version: 7,
          verification_mechanism: 'hub'
        }
      ]
    });
    expect(result).not.toHaveProperty('security');
    expect(result).not.toHaveProperty('path_secrets');
    expect(JSON.stringify(result)).not.toMatch(/plaintext|ciphertext|receipt|secret_version/i);
    expect(v1CallbackInstancePresenter.schema.validate(result).success).toBe(true);
  });

  it('returns plaintext only through the confidential create/rotate presenter', async () => {
    let result = await v1CallbackReceiverPathSecretPresenter
      .present(
        {
          receiverPathSecret: {
            pathSecret: {
              id: 'sec_path_2',
              generation: 5,
              createdAt: now,
              updatedAt: now
            },
            plaintext: 'metorial_callback_path_once',
            webhookUrl: 'https://hooks.example.test/receiver/str_1/metorial_callback_path_once'
          }
        },
        context
      )
      .run();

    expect(result).toEqual({
      object: 'callback.receiver_path_secret',
      id: 'sec_path_2',
      generation: 5,
      value: 'metorial_callback_path_once',
      webhook_url: 'https://hooks.example.test/receiver/str_1/metorial_callback_path_once'
    });
    expect(v1CallbackReceiverPathSecretPresenter.schema.validate(result).success).toBe(true);
  });
});
