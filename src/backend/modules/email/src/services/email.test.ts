import { withTransaction } from '@metorial/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmailQueue } from '../queue/sendEmail';
import { emailService } from './email';

vi.mock('@metorial/db', () => ({
  ID: { generateIdSync: vi.fn(() => 'generated-email-id') },
  withTransaction: vi.fn()
}));
vi.mock('@metorial/service', () => ({
  Service: { create: vi.fn((_name: string, factory: any) => ({ build: factory })) }
}));
vi.mock('../definitions', () => ({
  defaultEmailIdentity: Promise.resolve({ oid: 'identity-oid' })
}));
vi.mock('../queue/sendEmail', () => ({
  sendEmailQueue: { add: vi.fn() }
}));

describe('EmailService', () => {
  let dbMock: any;

  beforeEach(() => {
    dbMock = {
      outgoingEmail: {
        create: vi.fn(async ({ data }: any) => ({
          ...data,
          oid: 'email-oid',
          id: 'generated-email-id'
        }))
      },
      outgoingEmailContent: {
        createMany: vi.fn(async () => undefined)
      },
      outgoingEmailDestination: {
        createMany: vi.fn(async () => undefined)
      }
    };

    // @ts-ignore
    (withTransaction as unknown as vi.Mock).mockImplementation(async (fn: any) => fn(dbMock));
    // @ts-ignore
    (sendEmailQueue.add as vi.Mock).mockClear();
  });

  it('should create outgoing email, content, destinations, and enqueue email', async () => {
    const input = {
      type: 'email',
      to: ['user1@example.com', 'user2@example.com'],
      template: { foo: 'bar' },
      content: {
        subject: 'Test Subject',
        html: '<p>Hello</p>',
        text: 'Hello'
      }
    };

    const result = await emailService.sendEmail(input as any);

    expect(dbMock.outgoingEmail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'generated-email-id',
        numberOfDestinations: 2,
        numberOfDestinationsCompleted: 0,
        values: input.template,
        subject: input.content.subject,
        identityId: 'identity-oid'
      })
    });

    expect(dbMock.outgoingEmailContent.createMany).toHaveBeenCalledWith({
      data: {
        subject: input.content.subject,
        html: input.content.html,
        text: input.content.text,
        emailId: 'email-oid'
      }
    });

    expect(dbMock.outgoingEmailDestination.createMany).toHaveBeenCalledWith({
      data: [
        { status: 'pending', destination: 'user1@example.com', emailId: 'email-oid' },
        { status: 'pending', destination: 'user2@example.com', emailId: 'email-oid' }
      ]
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'generated-email-id',
        oid: 'email-oid',
        numberOfDestinations: 2,
        subject: 'Test Subject'
      })
    );
  });
});
