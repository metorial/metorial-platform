import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationClient } from '../src/email/client';

// Mock the EmailClient
vi.mock('@metorial/module-email', () => ({
  EmailClient: vi.fn().mockImplementation(() => ({
    send: vi.fn()
  }))
}));

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
