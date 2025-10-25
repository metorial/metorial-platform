import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules before importing
vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: vi.fn(),
  SendEmailCommand: vi.fn()
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn()
  }
}));

vi.mock('@metorial/config', () => ({
  getConfig: vi.fn()
}));

describe('send', () => {
  let mockSESClient: any;
  let mockSMTPTransport: any;
  let getConfig: any;
  let send: any;
  let setSenderOverride: any;

  beforeEach(async () => {
    vi.resetModules();

    // Clear mocks
    vi.clearAllMocks();

    mockSESClient = {
      send: vi.fn()
    };

    mockSMTPTransport = {
      sendMail: vi.fn()
    };

    // Setup mocks
    (SESClient as any).mockImplementation(() => mockSESClient);
    const nodemailer = await import('nodemailer');
    (nodemailer.default.createTransport as any).mockReturnValue(mockSMTPTransport);

    getConfig = (await import('@metorial/config')).getConfig;
  });

  describe('SES transport', () => {
    beforeEach(async () => {
      (getConfig as any).mockReturnValue({
        env: 'production',
        email: {
          type: 'ses',
          fromEmail: 'noreply@example.com',
          fromName: 'Example',
          aws: {
            region: 'us-east-1',
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret'
          }
        }
      });

      // Re-import to get fresh instance with new config
      const sendModule = await import('../src/lib/send');
      send = sendModule.send;
      setSenderOverride = sendModule.setSenderOverride;
    });

    it('should send email via SES with correct parameters', async () => {
      const mockResult = { MessageId: 'ses-msg-123' };
      mockSESClient.send.mockResolvedValue(mockResult);

      const result = await send({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test Text',
        identity: {
          fromEmail: 'sender@example.com',
          fromName: 'Sender Name',
          subjectMarker: undefined
        } as any
      });

      expect(SendEmailCommand).toHaveBeenCalledWith({
        Destination: {
          ToAddresses: ['user@example.com']
        },
        Message: {
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: '<p>Test HTML</p>'
            },
            Text: {
              Charset: 'UTF-8',
              Data: 'Test Text'
            }
          },
          Subject: {
            Charset: 'UTF-8',
            Data: 'Test Subject'
          }
        },
        Source: 'Sender Name <sender@example.com>'
      });

      expect(mockSESClient.send).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should add subject marker when provided', async () => {
      const mockResult = { MessageId: 'ses-msg-456' };
      mockSESClient.send.mockResolvedValue(mockResult);

      await send({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
        text: 'Test',
        identity: {
          fromEmail: 'sender@example.com',
          fromName: 'Sender',
          subjectMarker: '[IMPORTANT] '
        } as any
      });

      expect(SendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Message: expect.objectContaining({
            Subject: expect.objectContaining({
              Data: '[IMPORTANT] Test Subject'
            })
          })
        })
      );
    });

    it('should add [STAGING] prefix in staging environment', async () => {
      (getConfig as any).mockReturnValue({
        env: 'staging',
        email: {
          type: 'ses',
          fromEmail: 'noreply@example.com',
          fromName: 'Example'
        }
      });

      const sendModule = await import('../src/lib/send');
      const stagingSend = sendModule.send;

      mockSESClient.send.mockResolvedValue({ MessageId: 'test' });

      await stagingSend({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
        identity: {
          fromEmail: 'sender@example.com',
          fromName: 'Sender'
        } as any
      });

      expect(SendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Message: expect.objectContaining({
            Subject: expect.objectContaining({
              Data: '[STAGING] Test'
            })
          })
        })
      );
    });

    it('should add [DEV] prefix in development environment', async () => {
      (getConfig as any).mockReturnValue({
        env: 'development',
        email: {
          type: 'ses',
          fromEmail: 'noreply@example.com',
          fromName: 'Example'
        }
      });

      const sendModule = await import('../src/lib/send');
      const devSend = sendModule.send;

      mockSESClient.send.mockResolvedValue({ MessageId: 'test' });

      await devSend({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
        identity: {
          fromEmail: 'sender@example.com',
          fromName: 'Sender'
        } as any
      });

      expect(SendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Message: expect.objectContaining({
            Subject: expect.objectContaining({
              Data: '[DEV] Test'
            })
          })
        })
      );
    });
  });

  describe('SMTP transport', () => {
    beforeEach(async () => {
      (getConfig as any).mockReturnValue({
        env: 'production',
        email: {
          type: 'smtp',
          fromEmail: 'noreply@example.com',
          fromName: 'Example',
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: {
            user: 'smtp-user',
            pass: 'smtp-pass'
          }
        }
      });

      const sendModule = await import('../src/lib/send');
      send = sendModule.send;
      setSenderOverride = sendModule.setSenderOverride;
    });

    it('should send email via SMTP with correct parameters', async () => {
      const mockResult = {
        messageId: 'smtp-msg-123',
        response: '250 OK',
        rejected: []
      };
      mockSMTPTransport.sendMail.mockResolvedValue(mockResult);

      const result = await send({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test Text',
        identity: {
          fromEmail: 'sender@example.com',
          fromName: 'Sender Name',
          subjectMarker: undefined
        } as any
      });

      expect(mockSMTPTransport.sendMail).toHaveBeenCalledWith({
        from: 'Sender Name <sender@example.com>',
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test Text'
      });

      expect(result).toEqual({
        messageId: 'smtp-msg-123',
        response: '250 OK',
        rejected: []
      });
    });

    it('should handle SMTP errors', async () => {
      const error = new Error('SMTP connection failed');
      mockSMTPTransport.sendMail.mockRejectedValue(error);

      await expect(
        send({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
          identity: {
            fromEmail: 'sender@example.com',
            fromName: 'Sender'
          } as any
        })
      ).rejects.toThrow('SMTP connection failed');
    });

    it('should add subject marker for SMTP', async () => {
      mockSMTPTransport.sendMail.mockResolvedValue({
        messageId: 'test',
        response: '250 OK',
        rejected: []
      });

      await send({
        to: 'user@example.com',
        subject: 'Important',
        html: '<p>Test</p>',
        text: 'Test',
        identity: {
          fromEmail: 'sender@example.com',
          fromName: 'Sender',
          subjectMarker: '[URGENT] '
        } as any
      });

      expect(mockSMTPTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '[URGENT] Important'
        })
      );
    });
  });

  describe('sender override', () => {
    beforeEach(async () => {
      (getConfig as any).mockReturnValue({
        env: 'production',
        email: {
          type: 'ses',
          fromEmail: 'noreply@example.com',
          fromName: 'Example'
        }
      });

      const sendModule = await import('../src/lib/send');
      send = sendModule.send;
      setSenderOverride = sendModule.setSenderOverride;
    });

    it('should use sender override when set', async () => {
      const overrideFn = vi.fn().mockResolvedValue(undefined);
      setSenderOverride(overrideFn);

      await send({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
        identity: {
          fromEmail: 'sender@example.com',
          fromName: 'Sender'
        } as any
      });

      expect(overrideFn).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      });

      // Ensure actual transport was not used
      expect(mockSESClient.send).not.toHaveBeenCalled();
    });

    it('should apply environment prefix before override', async () => {
      (getConfig as any).mockReturnValue({
        env: 'development',
        email: {
          type: 'ses',
          fromEmail: 'noreply@example.com',
          fromName: 'Example'
        }
      });

      const sendModule = await import('../src/lib/send');
      const devSend = sendModule.send;
      const devSetOverride = sendModule.setSenderOverride;

      const overrideFn = vi.fn().mockResolvedValue(undefined);
      devSetOverride(overrideFn);

      await devSend({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
        identity: {
          fromEmail: 'sender@example.com',
          fromName: 'Sender'
        } as any
      });

      expect(overrideFn).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '[DEV] Test'
        })
      );
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      (getConfig as any).mockReturnValue({
        env: 'production',
        email: {
          type: 'smtp',
          fromEmail: 'noreply@example.com',
          fromName: 'Example',
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: {
            user: 'smtp-user',
            pass: 'smtp-pass'
          }
        }
      });

      const sendModule = await import('../src/lib/send');
      send = sendModule.send;
    });

    it('should handle empty subject marker', async () => {
      mockSMTPTransport.sendMail.mockResolvedValue({
        messageId: 'test',
        response: '250 OK',
        rejected: []
      });

      await send({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
        identity: {
          fromEmail: 'sender@example.com',
          fromName: 'Sender',
          subjectMarker: ''
        } as any
      });

      expect(mockSMTPTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Test'
        })
      );
    });

    it('should handle special characters in email content', async () => {
      mockSMTPTransport.sendMail.mockResolvedValue({
        messageId: 'test',
        response: '250 OK',
        rejected: []
      });

      await send({
        to: 'user@example.com',
        subject: 'Test & <Special> "Characters"',
        html: '<p>Test & <b>HTML</b> "content"</p>',
        text: 'Test & text "content"',
        identity: {
          fromEmail: 'sender@example.com',
          fromName: 'Sender'
        } as any
      });

      expect(mockSMTPTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Test & <Special> "Characters"',
          html: '<p>Test & <b>HTML</b> "content"</p>',
          text: 'Test & text "content"'
        })
      );
    });
  });
});
