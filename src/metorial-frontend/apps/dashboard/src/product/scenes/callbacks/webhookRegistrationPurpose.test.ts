import { describe, expect, it } from 'vitest';
import {
  getConnectionWebhookRegistrationPurpose,
  getDeliverySetupState,
  getWebhookRegistrationPurpose,
  providerNeedsWebhookReceiver,
  WEBHOOK_REGISTRATION_COPY
} from './webhookRegistrationPurpose';

let manual = {
  status: 'enabled' as const,
  webhookRegistration: { status: 'supported' as const, purpose: 'webhook_receiver' }
};
// Provider types presented before `purpose` existed.
let legacyManual = {
  status: 'enabled' as const,
  webhookRegistration: { status: 'supported' as const }
};
let deliverySetup = {
  status: 'enabled' as const,
  webhookRegistration: { status: 'supported' as const, purpose: 'delivery_setup' }
};
let automatic = {
  status: 'enabled' as const,
  webhookRegistration: { status: 'unsupported' as const, purpose: null }
};
let disabled = { status: 'disabled' as const };

describe('webhook registration purpose', () => {
  it('tells a webhook receiver provider from a delivery setup provider', () => {
    expect(getWebhookRegistrationPurpose(manual)).toBe('webhook_receiver');
    expect(getWebhookRegistrationPurpose(legacyManual)).toBe('webhook_receiver');
    expect(getWebhookRegistrationPurpose(deliverySetup)).toBe('delivery_setup');
  });

  it('has no purpose for providers that take no registration', () => {
    expect(getWebhookRegistrationPurpose(automatic)).toBeNull();
    expect(getWebhookRegistrationPurpose(disabled)).toBeNull();
    expect(getWebhookRegistrationPurpose(undefined)).toBeNull();
  });

  it('shows nothing to a connection on managed credentials', () => {
    for (let triggers of [manual, legacyManual, deliverySetup, automatic, disabled]) {
      expect(
        getConnectionWebhookRegistrationPurpose({ triggers, authCredentialsIsManaged: true })
      ).toBeNull();
    }
  });

  it('shows the registration to a connection on its own OAuth app', () => {
    expect(
      getConnectionWebhookRegistrationPurpose({
        triggers: deliverySetup,
        authCredentialsIsManaged: false
      })
    ).toBe('delivery_setup');
    expect(
      getConnectionWebhookRegistrationPurpose({
        triggers: manual,
        authCredentialsIsManaged: false
      })
    ).toBe('webhook_receiver');
    expect(
      getConnectionWebhookRegistrationPurpose({
        triggers: automatic,
        authCredentialsIsManaged: false
      })
    ).toBeNull();
  });

  it('only asks for a webhook receiver in the provider panel for manual providers', () => {
    expect(providerNeedsWebhookReceiver(manual)).toBe(true);
    expect(providerNeedsWebhookReceiver(legacyManual)).toBe(true);
    expect(providerNeedsWebhookReceiver(deliverySetup)).toBe(false);
    expect(providerNeedsWebhookReceiver(automatic)).toBe(false);
    expect(providerNeedsWebhookReceiver(disabled)).toBe(false);
  });

  it('keeps the webhook receiver wording unchanged', () => {
    let copy = WEBHOOK_REGISTRATION_COPY.webhook_receiver;

    expect(copy.createButton).toBe('Create Webhook Receiver');
    expect(copy.createTitle('Slack')).toBe('Set Up Slack Webhook Receiver');
    expect(copy.createName('Slack')).toBe('Slack Webhook Receiver');
    expect(copy.boxTitle).toBe('Inbound Event Setup');
    expect(copy.emptyTitle).toBe('Action Required to Receive Events');
    expect(copy.tableHeaders).toEqual(['Receiver', 'Receive URL']);
    expect(copy.activeBadge).toBeNull();

    expect(copy.urlTitle).toBe('Receive URL');
    expect(copy.urlDescription).toBe("Paste this URL into the provider's webhook settings.");
    expect(copy.setupIncomplete).toBe(
      'Finish the provider instructions to start receiving webhooks at this URL.'
    );
    expect(copy.settingsTitle).toBe('Receiver Settings');
    expect(copy.deleteButton).toBe('Delete Receiver');
    expect(copy.deleteDescription).toBe(
      'Metorial tears down the receiver on the provider and stops accepting webhooks at this URL. This cannot be undone.'
    );
    expect(copy.deleteConfirm('Slack Webhook Receiver')).toBe(
      'Are you sure you want to delete Slack Webhook Receiver?'
    );
  });

  it("words a delivery setup's own pages as a delivery setup", () => {
    let copy = WEBHOOK_REGISTRATION_COPY.delivery_setup;

    expect(copy.urlTitle).toBe('Push Endpoint');
    expect(copy.urlDescription).toBe(
      'Use this URL as the push endpoint and audience of your Pub/Sub subscription.'
    );
    expect(copy.settingsTitle).toBe('Delivery Setup');
    expect(copy.deleteButton).toBe('Delete Delivery Setup');
    expect(copy.deleteConfirm('Gmail Delivery Setup')).toBe(
      'Events stop being delivered in real time for connections that use this Google OAuth app until a new setup is saved.'
    );

    let pageCopy = [
      copy.urlTitle,
      copy.urlDescription,
      copy.urlMissing,
      copy.setupIncomplete,
      copy.eventsEmpty,
      copy.settingsTitle,
      copy.settingsDescription,
      copy.deleteButton,
      copy.deleteDescription,
      copy.deleteConfirm('Gmail Delivery Setup')
    ];
    for (let text of pageCopy) expect(text).not.toMatch(/receiver|webhook/i);
  });
});

describe('delivery setup state', () => {
  it('is missing until a registration exists', () => {
    expect(getDeliverySetupState([])).toBe('missing');
    expect(getDeliverySetupState([{ status: 'archived' }])).toBe('missing');
  });

  it('is pending while the only registration awaits setup', () => {
    expect(getDeliverySetupState([{ status: 'awaiting_setup' }])).toBe('pending');
  });

  it('is complete once any registration is active', () => {
    expect(getDeliverySetupState([{ status: 'awaiting_setup' }, { status: 'active' }])).toBe(
      'complete'
    );
  });
});
