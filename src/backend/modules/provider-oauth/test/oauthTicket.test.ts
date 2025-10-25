import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Instance, Organization, ProviderOAuthConnection } from '@metorial/db';

// Mock dependencies
vi.mock('@metorial/tokens', () => ({
  Tokens: vi.fn().mockImplementation(() => ({
    sign: vi.fn(async (data) => `signed-token-${data.data.clientId}`),
    verify: vi.fn(async (opts) => {
      if (opts.token.startsWith('invalid')) {
        return { verified: false };
      }
      if (opts.token.startsWith('wrong-client')) {
        return {
          verified: true,
          data: {
            type: 'oauth.authenticate',
            clientId: 'wrong-client-id',
            redirectUri: 'https://example.com/callback'
          }
        };
      }
      if (opts.token.startsWith('wrong-type')) {
        return {
          verified: true,
          data: {
            type: 'wrong.type',
            clientId: 'client-123',
            redirectUri: 'https://example.com/callback'
          }
        };
      }
      return {
        verified: true,
        data: {
          type: 'oauth.authenticate',
          clientId: 'client-123',
          redirectUri: 'https://example.com/callback',
          immediate: false
        }
      };
    })
  }))
}));

vi.mock('../src/env', () => ({
  env: {
    ticket: {
      PROVIDER_OAUTH_TICKET_SECRET: 'test-secret',
      PROVIDER_OAUTH_URL: 'https://oauth.example.com'
    }
  }
}));

import { providerOauthTicketService } from '../src/services/oauthTicket';

describe('oauthTicket service', () => {
  const mockInstance: Instance = {
    id: 'instance-1',
    oid: 1n,
    createdAt: new Date(),
    updatedAt: new Date()
  } as any;

  const mockOrganization: Organization = {
    id: 'org-1',
    oid: 1n,
    name: 'Test Org',
    createdAt: new Date(),
    updatedAt: new Date()
  } as any;

  const mockConnection: ProviderOAuthConnection = {
    id: 'connection-1',
    oid: 1n,
    metorialClientId: 'client-123',
    name: 'Test Connection',
    createdAt: new Date(),
    updatedAt: new Date()
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTicket', () => {
    it('should create ticket with required fields', async () => {
      const ticket = await providerOauthTicketService.createTicket({
        instance: mockInstance,
        connection: mockConnection,
        redirectUri: 'https://example.com/callback'
      });

      expect(ticket).toBeDefined();
      expect(typeof ticket).toBe('string');
      expect(ticket).toContain('client-123');
    });

    it('should create ticket with immediate flag', async () => {
      const ticket = await providerOauthTicketService.createTicket({
        instance: mockInstance,
        connection: mockConnection,
        redirectUri: 'https://example.com/callback',
        immediate: true
      });

      expect(ticket).toBeDefined();
      expect(typeof ticket).toBe('string');
    });

    it('should create ticket without immediate flag', async () => {
      const ticket = await providerOauthTicketService.createTicket({
        instance: mockInstance,
        connection: mockConnection,
        redirectUri: 'https://example.com/callback',
        immediate: false
      });

      expect(ticket).toBeDefined();
    });

    it('should include connection client ID in ticket', async () => {
      const ticket = await providerOauthTicketService.createTicket({
        instance: mockInstance,
        connection: mockConnection,
        redirectUri: 'https://example.com/callback'
      });

      expect(ticket).toContain(mockConnection.metorialClientId);
    });

    it('should handle different redirect URIs', async () => {
      const ticket1 = await providerOauthTicketService.createTicket({
        instance: mockInstance,
        connection: mockConnection,
        redirectUri: 'https://app1.example.com/callback'
      });

      const ticket2 = await providerOauthTicketService.createTicket({
        instance: mockInstance,
        connection: mockConnection,
        redirectUri: 'https://app2.example.com/callback'
      });

      expect(ticket1).toBeDefined();
      expect(ticket2).toBeDefined();
    });
  });

  describe('verifyTicket', () => {
    it('should verify valid ticket', async () => {
      const ticket = 'valid-token-client-123';

      const result = await providerOauthTicketService.verifyTicket({
        ticket,
        clientId: 'client-123',
        type: 'oauth.authenticate'
      });

      expect(result).toBeDefined();
      expect(result.type).toBe('oauth.authenticate');
      expect(result.clientId).toBe('client-123');
    });

    it('should throw error for invalid ticket', async () => {
      const ticket = 'invalid-token';

      await expect(
        providerOauthTicketService.verifyTicket({
          ticket,
          clientId: 'client-123',
          type: 'oauth.authenticate'
        })
      ).rejects.toThrow('Invalid ticket');
    });

    it('should throw error for mismatched client ID', async () => {
      const ticket = 'wrong-client-token';

      await expect(
        providerOauthTicketService.verifyTicket({
          ticket,
          clientId: 'client-123',
          type: 'oauth.authenticate'
        })
      ).rejects.toThrow('Invalid ticket');
    });

    it('should throw error for mismatched ticket type', async () => {
      const ticket = 'wrong-type-token';

      await expect(
        providerOauthTicketService.verifyTicket({
          ticket,
          clientId: 'client-123',
          type: 'oauth.authenticate'
        })
      ).rejects.toThrow('Invalid ticket');
    });

    it('should return ticket data when valid', async () => {
      const ticket = 'valid-token-client-123';

      const result = await providerOauthTicketService.verifyTicket({
        ticket,
        clientId: 'client-123',
        type: 'oauth.authenticate'
      });

      expect(result.redirectUri).toBeDefined();
      expect(result.immediate).toBeDefined();
    });

    it('should validate client ID strictly', async () => {
      const ticket = 'valid-token-client-123';

      await expect(
        providerOauthTicketService.verifyTicket({
          ticket,
          clientId: 'different-client-id',
          type: 'oauth.authenticate'
        })
      ).rejects.toThrow();
    });
  });

  describe('getAuthenticationUrl', () => {
    it('should generate authentication URL', async () => {
      const url = await providerOauthTicketService.getAuthenticationUrl({
        connection: mockConnection,
        redirectUri: 'https://example.com/callback',
        instance: mockInstance,
        organization: mockOrganization
      });

      expect(url).toBeDefined();
      expect(url).toContain('https://oauth.example.com');
      expect(url).toContain('/provider-oauth/');
      expect(url).toContain(mockOrganization.id);
      expect(url).toContain('ticket=');
      expect(url).toContain('client_id=');
    });

    it('should include organization ID in URL', async () => {
      const url = await providerOauthTicketService.getAuthenticationUrl({
        connection: mockConnection,
        redirectUri: 'https://example.com/callback',
        instance: mockInstance,
        organization: mockOrganization
      });

      expect(url).toContain(mockOrganization.id);
    });

    it('should include client ID in URL', async () => {
      const url = await providerOauthTicketService.getAuthenticationUrl({
        connection: mockConnection,
        redirectUri: 'https://example.com/callback',
        instance: mockInstance,
        organization: mockOrganization
      });

      expect(url).toContain(`client_id=${mockConnection.metorialClientId}`);
    });

    it('should include ticket in URL', async () => {
      const url = await providerOauthTicketService.getAuthenticationUrl({
        connection: mockConnection,
        redirectUri: 'https://example.com/callback',
        instance: mockInstance,
        organization: mockOrganization
      });

      expect(url).toMatch(/ticket=signed-token-/);
    });

    it('should support immediate parameter', async () => {
      const url = await providerOauthTicketService.getAuthenticationUrl({
        connection: mockConnection,
        redirectUri: 'https://example.com/callback',
        instance: mockInstance,
        organization: mockOrganization,
        immediate: true
      });

      expect(url).toBeDefined();
      expect(url).toContain('ticket=');
    });

    it('should generate different URLs for different connections', async () => {
      const connection2: ProviderOAuthConnection = {
        ...mockConnection,
        id: 'connection-2',
        metorialClientId: 'client-456'
      };

      const url1 = await providerOauthTicketService.getAuthenticationUrl({
        connection: mockConnection,
        redirectUri: 'https://example.com/callback',
        instance: mockInstance,
        organization: mockOrganization
      });

      const url2 = await providerOauthTicketService.getAuthenticationUrl({
        connection: connection2,
        redirectUri: 'https://example.com/callback',
        instance: mockInstance,
        organization: mockOrganization
      });

      expect(url1).not.toBe(url2);
      expect(url1).toContain('client-123');
      expect(url2).toContain('client-456');
    });
  });

  describe('edge cases', () => {
    it('should handle URL-encoded redirect URIs', async () => {
      const ticket = await providerOauthTicketService.createTicket({
        instance: mockInstance,
        connection: mockConnection,
        redirectUri: 'https://example.com/callback?state=123&code=456'
      });

      expect(ticket).toBeDefined();
    });

    it('should handle connections with different client IDs', async () => {
      const connection1 = { ...mockConnection, metorialClientId: 'client-aaa' };
      const connection2 = { ...mockConnection, metorialClientId: 'client-bbb' };

      const ticket1 = await providerOauthTicketService.createTicket({
        instance: mockInstance,
        connection: connection1,
        redirectUri: 'https://example.com/callback'
      });

      const ticket2 = await providerOauthTicketService.createTicket({
        instance: mockInstance,
        connection: connection2,
        redirectUri: 'https://example.com/callback'
      });

      expect(ticket1).toContain('client-aaa');
      expect(ticket2).toContain('client-bbb');
    });

    it('should handle organizations with special characters in ID', async () => {
      const orgWithSpecialId = {
        ...mockOrganization,
        id: 'org-with-special-chars_123'
      };

      const url = await providerOauthTicketService.getAuthenticationUrl({
        connection: mockConnection,
        redirectUri: 'https://example.com/callback',
        instance: mockInstance,
        organization: orgWithSpecialId
      });

      expect(url).toContain('org-with-special-chars_123');
    });
  });
});
