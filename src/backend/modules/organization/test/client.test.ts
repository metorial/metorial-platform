import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationClient } from '../src/email/client';

vi.mock('@metorial/module-email', () => {
  let MockEmailClient = vi.fn(function (this: any) {
    this.send = vi.fn();
  });
  return { EmailClient: MockEmailClient };
});

describe('Email Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notificationClient', () => {
    it('should be an instance of EmailClient', () => {
      expect(notificationClient).toBeDefined();
      expect(notificationClient).toHaveProperty('send');
    });

    it('should have send method available', () => {
      expect(typeof (notificationClient as any).send).toBe('function');
    });
  });
});
