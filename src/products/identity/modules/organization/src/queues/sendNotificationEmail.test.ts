import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  send: vi.fn(),
  getSetting: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    organizationNotificationDestination: {
      findUnique: mocks.findUnique,
      update: mocks.update
    }
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(() => ({
    process: vi.fn(handler => ({ handler }))
  })),
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('../email/notification', () => ({
  sendOrganizationNotificationEmail: {
    send: mocks.send
  }
}));

vi.mock('../lib/notificationSettings', () => ({
  getOrCreateOrganizationNotificationSetting: mocks.getSetting
}));

describe('organization notification email delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores the Relay email ID after sending', async () => {
    let { sendOrganizationNotificationEmailProcessor } =
      await import('./sendNotificationEmail');
    mocks.findUnique.mockResolvedValue({
      id: 'ond_1',
      emailId: null,
      emailStatus: 'pending',
      member: {
        status: 'active',
        role: 'admin',
        actor: { email: 'member@example.com' }
      },
      notification: {
        validUntil: null,
        onlyForMemberRoles: ['admin'],
        type: { severity: 'alert' },
        organization: { id: 'org_1' }
      }
    });
    mocks.getSetting.mockResolvedValue({ emailEnabled: true });
    mocks.send.mockResolvedValue({ id: 'eml_1' });

    await (sendOrganizationNotificationEmailProcessor as any).handler({
      destinationId: 'ond_1'
    });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['member@example.com'] })
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ond_1' },
        data: expect.objectContaining({
          emailStatus: 'sent',
          emailId: 'eml_1',
          emailSentAt: expect.any(Date)
        })
      })
    );
  });

  it('does not send when the member has email disabled', async () => {
    let { sendOrganizationNotificationEmailProcessor } =
      await import('./sendNotificationEmail');
    mocks.findUnique.mockResolvedValue({
      id: 'ond_1',
      emailId: null,
      emailStatus: 'pending',
      member: {
        status: 'active',
        role: 'admin',
        actor: { email: 'member@example.com' }
      },
      notification: {
        validUntil: null,
        onlyForMemberRoles: ['admin'],
        type: { severity: 'alert' },
        organization: { id: 'org_1' }
      }
    });
    mocks.getSetting.mockResolvedValue({ emailEnabled: false });

    await (sendOrganizationNotificationEmailProcessor as any).handler({
      destinationId: 'ond_1'
    });

    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'ond_1' },
      data: {
        emailStatus: 'disabled',
        emailSendAfter: null
      }
    });
  });
});
