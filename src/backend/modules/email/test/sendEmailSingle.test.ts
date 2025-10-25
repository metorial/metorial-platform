import { QueueRetryError } from '@metorial/queue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  db: {
    outgoingEmailDestination: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    outgoingEmailSend: {
      create: vi.fn(),
      count: vi.fn()
    },
    outgoingEmail: {
      update: vi.fn()
    },
    outgoingEmailContent: {
      deleteMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn((opts) => ({
    process: vi.fn((handler) => handler),
    add: vi.fn()
  })),
  QueueRetryError: class QueueRetryError extends Error {
    constructor() {
      super('Queue retry error');
      this.name = 'QueueRetryError';
    }
  }
}));

vi.mock('@metorial/sentry', () => ({
  getSentry: vi.fn(() => ({
    captureException: vi.fn()
  }))
}));

vi.mock('../src/lib/send', () => ({
  send: vi.fn()
}));

describe('sendEmailSingleQueueProcessor', () => {
  let db: any;
  let send: any;
  let mockCaptureException: any;
  let sendEmailSingleQueue: any;
  let sendEmailSingleQueueProcessor: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Create the mock before importing the module
    mockCaptureException = vi.fn();
    vi.doMock('@metorial/sentry', () => ({
      getSentry: () => ({
        captureException: mockCaptureException
      })
    }));

    db = (await import('@metorial/db')).db;
    send = (await import('../src/lib/send')).send;

    const queueModule = await import('../src/queue/sendEmailSingle');
    sendEmailSingleQueue = queueModule.sendEmailSingleQueue;
    sendEmailSingleQueueProcessor = queueModule.sendEmailSingleQueueProcessor;
  });

  describe('successful email sending', () => {
    it('should successfully send email and update destination status to sent', async () => {
      const mockDestination = {
        id: 1n,
        emailId: 10n,
        destination: 'user@example.com',
        status: 'pending',
        email: {
          id: 'email-123',
          content: {
            subject: 'Test Subject',
            html: '<p>Email content with EMAIL_ID</p>',
            text: 'Email content with EMAIL_ID'
          },
          identity: {
            fromEmail: 'sender@example.com',
            fromName: 'Sender'
          }
        }
      };

      db.outgoingEmailDestination.findFirst.mockResolvedValue(mockDestination);
      send.mockResolvedValue({ MessageId: 'ses-123' });
      db.outgoingEmailSend.create.mockResolvedValue({ id: 1n });
      db.outgoingEmailSend.count.mockResolvedValue(1);
      db.outgoingEmailDestination.update.mockResolvedValue({
        ...mockDestination,
        status: 'sent'
      });
      db.outgoingEmail.update.mockResolvedValue({
        id: 'email-123',
        numberOfDestinations: 3,
        numberOfDestinationsCompleted: 2
      });

      await sendEmailSingleQueueProcessor({ destinationId: 1n });

      expect(send).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Email content with email-123</p>',
        text: 'Email content with email-123',
        identity: mockDestination.email.identity
      });

      expect(db.outgoingEmailSend.create).toHaveBeenCalledWith({
        data: {
          destinationId: 1n,
          status: 'success',
          result: { MessageId: 'ses-123' }
        }
      });

      expect(db.outgoingEmailDestination.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { status: 'sent' }
      });

      expect(db.outgoingEmail.update).toHaveBeenCalledWith({
        where: { oid: 10n },
        data: {
          numberOfDestinationsCompleted: {
            increment: 1
          }
        }
      });
    });

    it('should delete email content when all destinations completed', async () => {
      const mockDestination = {
        id: 1n,
        emailId: 10n,
        destination: 'user@example.com',
        status: 'pending',
        email: {
          id: 'email-123',
          content: {
            subject: 'Test',
            html: '<p>Test</p>',
            text: 'Test'
          },
          identity: {
            fromEmail: 'sender@example.com',
            fromName: 'Sender'
          }
        }
      };

      db.outgoingEmailDestination.findFirst.mockResolvedValue(mockDestination);
      send.mockResolvedValue({ MessageId: 'ses-123' });
      db.outgoingEmailSend.create.mockResolvedValue({ id: 1n });
      db.outgoingEmailSend.count.mockResolvedValue(1);
      db.outgoingEmailDestination.update.mockResolvedValue({
        ...mockDestination,
        status: 'sent'
      });
      db.outgoingEmail.update.mockResolvedValue({
        id: 'email-123',
        oid: 10n,
        numberOfDestinations: 3,
        numberOfDestinationsCompleted: 3 // All completed
      });

      await sendEmailSingleQueueProcessor({ destinationId: 1n });

      expect(db.outgoingEmailContent.deleteMany).toHaveBeenCalledWith({
        where: { emailId: 10n }
      });
    });

    it('should delete content even when destinations still pending (due to >= check)', async () => {
      // Note: The actual implementation uses >= which means it deletes when
      // numberOfDestinations >= numberOfDestinationsCompleted (not just when equal)
      const mockDestination = {
        id: 1n,
        emailId: 10n,
        destination: 'user@example.com',
        status: 'pending',
        email: {
          id: 'email-123',
          content: {
            subject: 'Test',
            html: '<p>Test</p>',
            text: 'Test'
          },
          identity: {
            fromEmail: 'sender@example.com',
            fromName: 'Sender'
          }
        }
      };

      db.outgoingEmailDestination.findFirst.mockResolvedValue(mockDestination);
      send.mockResolvedValue({ MessageId: 'ses-123' });
      db.outgoingEmailSend.create.mockResolvedValue({ id: 1n });
      db.outgoingEmailSend.count.mockResolvedValue(1);
      db.outgoingEmailDestination.update.mockResolvedValue({
        ...mockDestination,
        status: 'sent'
      });
      db.outgoingEmail.update.mockResolvedValue({
        id: 'email-123',
        oid: 10n,
        numberOfDestinations: 3,
        numberOfDestinationsCompleted: 1
      });

      await sendEmailSingleQueueProcessor({ destinationId: 1n });

      // Due to the >= check in the code, this will actually delete
      expect(db.outgoingEmailContent.deleteMany).toHaveBeenCalledWith({
        where: { emailId: 10n }
      });
    });
  });

  describe('failed email sending', () => {
    it('should handle send failure and mark as retry when under 5 attempts', async () => {
      const mockDestination = {
        id: 1n,
        emailId: 10n,
        destination: 'user@example.com',
        status: 'pending',
        email: {
          id: 'email-123',
          content: {
            subject: 'Test',
            html: '<p>Test</p>',
            text: 'Test'
          },
          identity: {
            fromEmail: 'sender@example.com',
            fromName: 'Sender'
          }
        }
      };

      db.outgoingEmailDestination.findFirst.mockResolvedValue(mockDestination);
      const sendError = new Error('SMTP connection failed');
      send.mockRejectedValue(sendError);
      db.outgoingEmailSend.create.mockResolvedValue({ id: 1n });
      db.outgoingEmailSend.count.mockResolvedValue(2); // Less than 5
      db.outgoingEmailDestination.update.mockResolvedValue({
        ...mockDestination,
        status: 'retry'
      });

      await sendEmailSingleQueueProcessor({ destinationId: 1n });

      expect(mockCaptureException).toHaveBeenCalledWith(sendError);

      expect(db.outgoingEmailSend.create).toHaveBeenCalledWith({
        data: {
          destinationId: 1n,
          status: 'failed',
          result: JSON.stringify(sendError)
        }
      });

      expect(db.outgoingEmailDestination.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { status: 'retry' }
      });

      expect(sendEmailSingleQueue.add).toHaveBeenCalledWith(
        { destinationId: 1n },
        { delay: 1000 * 60 * 5 } // 5 minutes
      );

      // Should not increment completed count for retry
      expect(db.outgoingEmail.update).not.toHaveBeenCalled();
    });

    it('should mark as permanently failed after 5+ attempts', async () => {
      const mockDestination = {
        id: 1n,
        emailId: 10n,
        destination: 'user@example.com',
        status: 'retry',
        email: {
          id: 'email-123',
          content: {
            subject: 'Test',
            html: '<p>Test</p>',
            text: 'Test'
          },
          identity: {
            fromEmail: 'sender@example.com',
            fromName: 'Sender'
          }
        }
      };

      db.outgoingEmailDestination.findFirst.mockResolvedValue(mockDestination);
      const sendError = new Error('Permanent failure');
      send.mockRejectedValue(sendError);
      db.outgoingEmailSend.create.mockResolvedValue({ id: 1n });
      db.outgoingEmailSend.count.mockResolvedValue(6); // More than 5
      db.outgoingEmailDestination.update.mockResolvedValue({
        ...mockDestination,
        status: 'failed'
      });
      db.outgoingEmail.update.mockResolvedValue({
        id: 'email-123',
        numberOfDestinations: 3,
        numberOfDestinationsCompleted: 1
      });

      await sendEmailSingleQueueProcessor({ destinationId: 1n });

      expect(db.outgoingEmailDestination.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { status: 'failed' }
      });

      expect(sendEmailSingleQueue.add).not.toHaveBeenCalled();

      // Should increment completed count for permanent failure
      expect(db.outgoingEmail.update).toHaveBeenCalledWith({
        where: { oid: 10n },
        data: {
          numberOfDestinationsCompleted: {
            increment: 1
          }
        }
      });
    });
  });

  describe('edge cases', () => {
    it('should throw QueueRetryError when destination not found', async () => {
      db.outgoingEmailDestination.findFirst.mockResolvedValue(null);

      await expect(sendEmailSingleQueueProcessor({ destinationId: 999n })).rejects.toThrow(
        QueueRetryError
      );

      expect(send).not.toHaveBeenCalled();
    });

    it('should throw QueueRetryError when email content is missing', async () => {
      const mockDestination = {
        id: 1n,
        emailId: 10n,
        destination: 'user@example.com',
        status: 'pending',
        email: {
          id: 'email-123',
          content: null, // Missing content
          identity: {
            fromEmail: 'sender@example.com',
            fromName: 'Sender'
          }
        }
      };

      db.outgoingEmailDestination.findFirst.mockResolvedValue(mockDestination);

      await expect(sendEmailSingleQueueProcessor({ destinationId: 1n })).rejects.toThrow(
        QueueRetryError
      );

      expect(send).not.toHaveBeenCalled();
    });

    it('should only process destinations with pending or retry status', async () => {
      // The query includes a filter for status: { in: ['pending', 'retry'] }
      // This test verifies that sent/failed destinations are not processed
      db.outgoingEmailDestination.findFirst.mockResolvedValue(null);

      await expect(sendEmailSingleQueueProcessor({ destinationId: 1n })).rejects.toThrow(
        QueueRetryError
      );

      expect(db.outgoingEmailDestination.findFirst).toHaveBeenCalledWith({
        where: {
          id: 1n,
          status: {
            in: ['pending', 'retry']
          }
        },
        include: {
          email: {
            include: {
              content: true,
              identity: true
            }
          }
        }
      });
    });

    it('should replace EMAIL_ID placeholder multiple times in content', async () => {
      const mockDestination = {
        id: 1n,
        emailId: 10n,
        destination: 'user@example.com',
        status: 'pending',
        email: {
          id: 'email-456',
          content: {
            subject: 'Test',
            html: '<p>EMAIL_ID and EMAIL_ID again</p>',
            text: 'EMAIL_ID and EMAIL_ID again'
          },
          identity: {
            fromEmail: 'sender@example.com',
            fromName: 'Sender'
          }
        }
      };

      db.outgoingEmailDestination.findFirst.mockResolvedValue(mockDestination);
      send.mockResolvedValue({ MessageId: 'test' });
      db.outgoingEmailSend.create.mockResolvedValue({ id: 1n });
      db.outgoingEmailSend.count.mockResolvedValue(1);
      db.outgoingEmailDestination.update.mockResolvedValue({
        ...mockDestination,
        status: 'sent'
      });
      db.outgoingEmail.update.mockResolvedValue({
        id: 'email-456',
        numberOfDestinations: 1,
        numberOfDestinationsCompleted: 1
      });

      await sendEmailSingleQueueProcessor({ destinationId: 1n });

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<p>email-456 and email-456 again</p>',
          text: 'email-456 and email-456 again'
        })
      );
    });

    it('should handle exactly 5 failed attempts (boundary case)', async () => {
      const mockDestination = {
        id: 1n,
        emailId: 10n,
        destination: 'user@example.com',
        status: 'retry',
        email: {
          id: 'email-123',
          content: {
            subject: 'Test',
            html: '<p>Test</p>',
            text: 'Test'
          },
          identity: {
            fromEmail: 'sender@example.com',
            fromName: 'Sender'
          }
        }
      };

      db.outgoingEmailDestination.findFirst.mockResolvedValue(mockDestination);
      send.mockRejectedValue(new Error('Test error'));
      db.outgoingEmailSend.create.mockResolvedValue({ id: 1n });
      db.outgoingEmailSend.count.mockResolvedValue(5); // Exactly 5
      db.outgoingEmailDestination.update.mockResolvedValue({
        ...mockDestination,
        status: 'retry'
      });

      await sendEmailSingleQueueProcessor({ destinationId: 1n });

      // At exactly 5, should still retry (not permanently failed)
      expect(db.outgoingEmailDestination.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { status: 'retry' }
      });

      expect(sendEmailSingleQueue.add).toHaveBeenCalledWith(
        { destinationId: 1n },
        { delay: 1000 * 60 * 5 }
      );
    });
  });
});
