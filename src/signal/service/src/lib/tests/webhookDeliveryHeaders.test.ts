import { describe, expect, it } from 'vitest';
import { buildWebhookDeliveryHeaders } from '../webhookDeliveryHeaders';

let deliveryHeaders = (eventHeaders: [string, string][]) =>
  buildWebhookDeliveryHeaders({
    eventHeaders,
    webhookId: 'wh_1',
    notificationId: 'ntf_1',
    eventId: 'evt_1',
    signature: 't=100,v1=trusted',
    attemptNumber: 2,
    sender: 'Test Sender (snd_1)'
  });

describe('webhook delivery headers', () => {
  it('forwards event headers while preserving transport and Metorial authority', () => {
    let headers = deliveryHeaders([
      ['x-provider-request-id', 'provider-request-1'],
      ['metorial-trigger-id', 'trigger-1'],
      ['content-type', 'text/plain'],
      ['host', 'attacker.example'],
      ['metorial-signature', 't=1,v1=spoofed'],
      ['METORIAL-NOTIFICATION-ID', 'spoofed-notification']
    ]);

    expect(headers).toMatchObject({
      'x-provider-request-id': 'provider-request-1',
      'metorial-trigger-id': 'trigger-1',
      'Content-Type': 'application/json',
      'Metorial-Notification-Id': 'ntf_1',
      'Metorial-Signature': 't=100,v1=trusted'
    });
    expect(Object.keys(headers).map(name => name.toLowerCase())).not.toContain('host');
    expect(
      Object.entries(headers).filter(([name]) => name.toLowerCase() === 'metorial-signature')
    ).toEqual([['Metorial-Signature', 't=100,v1=trusted']]);
  });
});
