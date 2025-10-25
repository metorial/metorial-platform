import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailClient } from '../src/sendWithTemplate';
import { emailService } from '../src/services';
import { ITemplate } from '../src/templates';

vi.mock('../src/services', () => ({
  emailService: {
    sendEmail: vi.fn()
  }
}));

describe('EmailClient', () => {
  let emailClient: EmailClient;

  beforeEach(() => {
    emailClient = new EmailClient();
    vi.clearAllMocks();
  });

  describe('createTemplate', () => {
    it('should create a template with send method', () => {
      const mockTemplate: ITemplate<{ name: string }> = {
        render: vi.fn().mockResolvedValue({
          subject: 'Test Subject',
          html: '<p>Hello</p>',
          text: 'Hello'
        })
      };

      const template = emailClient.createTemplate(mockTemplate);

      expect(template).toHaveProperty('send');
      expect(typeof template.send).toBe('function');
    });

    it('should render template and send email with correct parameters', async () => {
      const mockTemplate: ITemplate<{ name: string }> = {
        render: vi.fn().mockResolvedValue({
          subject: 'Hello {{name}}',
          html: '<p>Hello World</p>',
          text: 'Hello World'
        })
      };

      const mockEmailResult = { id: 'email-123', oid: 'oid-123' };
      (emailService.sendEmail as any).mockResolvedValue(mockEmailResult);

      const template = emailClient.createTemplate(mockTemplate);

      const result = await template.send({
        data: { name: 'John' },
        to: ['john@example.com', 'jane@example.com']
      });

      expect(mockTemplate.render).toHaveBeenCalledWith({ name: 'John' });
      expect(emailService.sendEmail).toHaveBeenCalledWith({
        type: 'email',
        to: ['john@example.com', 'jane@example.com'],
        template: { name: 'John' },
        content: {
          subject: 'Hello {{name}}',
          html: '<p>Hello World</p>',
          text: 'Hello World'
        }
      });
      expect(result).toEqual(mockEmailResult);
    });

    it('should handle async html and text rendering', async () => {
      const mockTemplate: ITemplate<{ count: number }> = {
        render: vi.fn().mockResolvedValue({
          subject: 'Count Update',
          html: Promise.resolve('<p>Count: 42</p>'),
          text: Promise.resolve('Count: 42')
        })
      };

      const mockEmailResult = { id: 'email-456', oid: 'oid-456' };
      (emailService.sendEmail as any).mockResolvedValue(mockEmailResult);

      const template = emailClient.createTemplate(mockTemplate);

      const result = await template.send({
        data: { count: 42 },
        to: ['user@example.com']
      });

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        type: 'email',
        to: ['user@example.com'],
        template: { count: 42 },
        content: {
          subject: 'Count Update',
          html: '<p>Count: 42</p>',
          text: 'Count: 42'
        }
      });
      expect(result).toEqual(mockEmailResult);
    });

    it('should handle empty recipient list', async () => {
      const mockTemplate: ITemplate<{}> = {
        render: vi.fn().mockResolvedValue({
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test'
        })
      };

      (emailService.sendEmail as any).mockResolvedValue({ id: 'email-789' });

      const template = emailClient.createTemplate(mockTemplate);

      const result = await template.send({
        data: {},
        to: []
      });

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: []
        })
      );
      expect(result).toBeDefined();
    });

    it('should propagate errors from template rendering', async () => {
      const mockTemplate: ITemplate<{ name: string }> = {
        render: vi.fn().mockRejectedValue(new Error('Template rendering failed'))
      };

      const template = emailClient.createTemplate(mockTemplate);

      await expect(
        template.send({
          data: { name: 'John' },
          to: ['john@example.com']
        })
      ).rejects.toThrow('Template rendering failed');

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should propagate errors from email service', async () => {
      const mockTemplate: ITemplate<{ name: string }> = {
        render: vi.fn().mockResolvedValue({
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test'
        })
      };

      (emailService.sendEmail as any).mockRejectedValue(new Error('Email service error'));

      const template = emailClient.createTemplate(mockTemplate);

      await expect(
        template.send({
          data: { name: 'John' },
          to: ['john@example.com']
        })
      ).rejects.toThrow('Email service error');
    });
  });
});
