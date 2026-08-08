import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  db: {
    consumerInvite: { findUnique: vi.fn() }
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    process: vi.fn(handler => handler)
  })),
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('../src/email/invite', () => ({
  sendConsumerInviteEmail: { send: vi.fn() }
}));

vi.mock('../src/services/portal', () => ({
  portalService: {
    getPortalHost: vi.fn(() => ({ host: 'https://portals-us1.metorial.com/sso-test-1' })),
    getPrimaryPortalUrl: vi.fn()
  }
}));

let portal = { oid: 1n, id: 'portal_1', slug: 'sso-test-1', name: 'SSO Test', status: 'active' };

let invite = {
  id: 'coi_1',
  status: 'pending',
  message: null,
  consumerProfile: { id: 'cop_1', name: 'Ada', email: 'ada@acme.test' },
  invitedBy: { name: 'Grace', email: 'grace@acme.test' },
  surface: { portal }
};

describe('consumer invite email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links to the portal namespace instead of the configured host template', async () => {
    let { db } = await import('@metorial/db');
    let { sendConsumerInviteEmail } = await import('../src/email/invite');
    let { portalService } = await import('../src/services/portal');
    let { consumerInviteCreatedQueueProcessor } = await import(
      '../src/queues/lifecycle/consumerInvite'
    );

    vi.mocked(db.consumerInvite.findUnique).mockResolvedValue(invite as any);
    vi.mocked(portalService.getPrimaryPortalUrl).mockResolvedValue(
      'https://sso-test-1.portals.metorial.com'
    );

    await (consumerInviteCreatedQueueProcessor as any)({ consumerInviteId: invite.id });

    expect(portalService.getPortalHost).not.toHaveBeenCalled();
    expect(portalService.getPrimaryPortalUrl).toHaveBeenCalledWith({ portal });
    expect(sendConsumerInviteEmail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          portalUrl: 'https://sso-test-1.portals.metorial.com'
        })
      })
    );
  });
});

describe('buildConsumerInviteUrl', () => {
  let params = {
    inviteId: 'coi_1',
    consumerProfileId: 'cop_1',
    email: 'ada+test@acme.test'
  };

  it('identifies the invite, the profile and the invitee', async () => {
    let { buildConsumerInviteUrl } = await import('../src/email/inviteUrl');

    let url = new URL(
      buildConsumerInviteUrl({
        portalUrl: 'https://sso-test-1.portals.metorial.com',
        ...params
      })
    );

    expect(url.searchParams.get('consumer_invite_id')).toBe('coi_1');
    expect(url.searchParams.get('consumer_profile_id')).toBe('cop_1');
    expect(url.searchParams.get('email')).toBe('ada+test@acme.test');
  });

  it('keeps the path of a shared namespace portal URL', async () => {
    let { buildConsumerInviteUrl } = await import('../src/email/inviteUrl');

    let url = buildConsumerInviteUrl({
      portalUrl: 'https://acme.portals.metorial.com/p/sso-test-1',
      ...params
    });

    expect(url).toBe(
      'https://acme.portals.metorial.com/p/sso-test-1?consumer_invite_id=coi_1&consumer_profile_id=cop_1&email=ada%2Btest%40acme.test'
    );
  });
});
