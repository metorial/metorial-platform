import { describe, expect, it } from 'vitest';
import { toWebhookRegistrationCapability } from './webhookRegistrationCapability';

let schemas = {
  userConfigSchema: { type: 'object', properties: { topicName: { type: 'string' } } },
  fullConfigSchema: { type: 'object', properties: { topicName: { type: 'string' } } }
};

let manual = {
  invocation: {
    type: 'webhook' as const,
    registration: { mode: 'manual' as const, ...schemas }
  }
};
let auto = {
  invocation: { type: 'webhook' as const, registration: { mode: 'auto' as const } }
};
let autoWithDeliveryConfig = {
  invocation: {
    type: 'webhook' as const,
    registration: { mode: 'auto' as const, deliveryConfig: schemas }
  }
};
let polling = { invocation: { type: 'polling' as const, intervalSeconds: 60 } };
let gateway = { invocation: { type: 'gateway' as const } };

describe('toWebhookRegistrationCapability', () => {
  it('supports registration for a manual group without naming a purpose', () => {
    expect(toWebhookRegistrationCapability([polling, manual])).toEqual({
      status: 'supported'
    });
  });

  it('does not support registration for plain automatic groups', () => {
    expect(toWebhookRegistrationCapability([auto, polling, gateway])).toEqual({
      status: 'unsupported'
    });
    expect(toWebhookRegistrationCapability([])).toEqual({ status: 'unsupported' });
  });

  it('supports registration as a delivery setup for an automatic group with a delivery config', () => {
    expect(toWebhookRegistrationCapability([auto, autoWithDeliveryConfig])).toEqual({
      status: 'supported',
      purpose: 'delivery_setup'
    });
  });

  it('keeps a provider with a manual group a webhook receiver provider', () => {
    expect(toWebhookRegistrationCapability([autoWithDeliveryConfig, manual])).toEqual({
      status: 'supported'
    });
  });
});
