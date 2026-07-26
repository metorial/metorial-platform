import { describe, expect, test } from 'vitest';
import { outgoingEmailPresenter } from './outgoingEmail';

let makeEmail = (statuses: ('pending' | 'sent' | 'retry' | 'failed')[]) =>
  ({
    oid: 1n,
    id: 'oe_1',
    numberOfDestinations: statuses.length,
    numberOfDestinationsCompleted: statuses.filter(status =>
      ['sent', 'failed'].includes(status)
    ).length,
    identityId: 1,
    fromName: 'Support',
    replyTo: 'reply@example.com',
    idempotencyKey: 'request-1',
    incomingEmailThreadOid: null,
    replyToOutgoingEmailOid: null,
    replyToIncomingEmailOid: null,
    values: {},
    subject: 'Hello',
    createdAt: new Date(),
    attachments: [],
    destinations: statuses.map((status, index) => ({
      id: BigInt(index + 1),
      status,
      emailId: 1n,
      destination: `${index}@example.com`,
      OutgoingEmailSend: []
    }))
  }) as any;

describe('outgoingEmailPresenter', () => {
  test('aggregates completed and retrying destination status', () => {
    expect(outgoingEmailPresenter(makeEmail(['sent', 'sent'])).status).toBe('sent');
    expect(outgoingEmailPresenter(makeEmail(['sent', 'failed'])).status).toBe('failed');
    expect(outgoingEmailPresenter(makeEmail(['sent', 'retry'])).status).toBe('retry');
    expect(outgoingEmailPresenter(makeEmail(['sent', 'pending'])).status).toBe('pending');
  });
});
