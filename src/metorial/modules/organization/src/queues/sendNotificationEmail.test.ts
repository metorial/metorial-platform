import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  send: vi.fn()
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
      member: { actor: { email: 'member@example.com' } },
      notification: {
        type: { sendEmail: true },
        organization: { id: 'org_1' }
      }
    });
    mocks.send.mockResolvedValue({ id: 'eml_1' });

    await (sendOrganizationNotificationEmailProcessor as any).handler({
      destinationId: 'ond_1'
    });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['member@example.com'] })
    );
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'ond_1' },
      data: { emailId: 'eml_1' }
    });
  });

  it('does not send when the type has email disabled', async () => {
    let { sendOrganizationNotificationEmailProcessor } =
      await import('./sendNotificationEmail');
    mocks.findUnique.mockResolvedValue({
      id: 'ond_1',
      emailId: null,
      member: { actor: { email: 'member@example.com' } },
      notification: {
        type: { sendEmail: false },
        organization: { id: 'org_1' }
      }
    });

    await (sendOrganizationNotificationEmailProcessor as any).handler({
      destinationId: 'ond_1'
    });

    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
