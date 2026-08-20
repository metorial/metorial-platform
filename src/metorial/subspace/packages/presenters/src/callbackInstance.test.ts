import { describe, expect, it } from 'vitest';
import { callbackInstanceTriggerPresenter } from './callbackInstance';

describe('callbackInstanceTriggerPresenter', () => {
  it('keeps registration lifecycle and verification mechanism without private details', () => {
    let value = callbackInstanceTriggerPresenter({
      id: 'trigger-1',
      source: 'webhook',
      pollIntervalSeconds: null,
      nextPollAt: null,
      lastPolledAt: null,
      webhookUrl: 'https://secured.example/opaque',
      isWebhookRegistered: false,
      registrationStatus: 'failed',
      registrationGeneration: 3,
      registrationTransitionVersion: 2,
      registrationError: {
        code: 'provider_timeout',
        message: 'The provider registration request timed out.',
        metadata: { version: 1 },
        at: new Date('2026-08-14T12:00:00.000Z')
      },
      verificationMechanism: 'hub',
      verificationSpecHash: 'a'.repeat(64),
      providerTrigger: {
        id: 'provider-trigger-1',
        key: 'events.created',
        name: 'Events Created',
        description: null,
        value: {
          inputJsonSchema: {},
          outputJsonSchema: {},
          scopes: null,
          invocation: {
            type: 'webhook',
            autoRegistration: true,
            autoUnregistration: false
          }
        },
        provider: { id: 'provider-1' },
        specification: { id: 'provider-specification-1' },
        createdAt: new Date('2026-08-14T12:00:00.000Z'),
        updatedAt: new Date('2026-08-14T12:00:00.000Z')
      }
    } as any);
    expect(value).toMatchObject({
      registrationStatus: 'failed',
      verificationMechanism: 'hub'
    });
    expect(value.providerTrigger?.invocation).toMatchObject({
      type: 'webhook',
      http: { verification: null }
    });
    expect(JSON.stringify(value)).not.toMatch(/registrationDetails|encrypted|secret/i);
  });
});
