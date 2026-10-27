import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-email', async () => {
  let relayClient = await import('@metorial-platform-systems/relay-client');

  return {
    Button: relayClient.Button,
    createEmail: relayClient.createEmail,
    createTemplate: relayClient.createTemplate,
    Layout: relayClient.Layout,
    Text: relayClient.Text,
    EmailClient: class {
      createTemplate<T>(template: T) {
        return template;
      }
    }
  };
});

import { adminSetupLinkEmail } from './adminSetupLink';

let renderEmail = async (senderName: string | null) => {
  let template = adminSetupLinkEmail as unknown as {
    render: (data: unknown) => Promise<{ subject: string; html: string; text: string }>;
  };
  let rendered = await template.render({
    senderName,
    providerName: 'Microsoft Outlook',
    organizationName: 'Acme',
    setupUrl: 'https://integrations.example.com/setup-session/pas_1?client_secret=secret',
    expiresAt: new Date('2026-11-07T13:14:00Z')
  });

  return { subject: rendered.subject, html: await rendered.html, text: await rendered.text };
};

describe('adminSetupLinkEmail', () => {
  it('renders the subject, setup link and UTC expiry', async () => {
    let email = await renderEmail('Quinn');

    expect(email.subject).toBe(
      'Quinn at Acme asked you to approve Microsoft Outlook for your organization'
    );
    expect(email.html).toContain(
      'https://integrations.example.com/setup-session/pas_1?client_secret=secret'
    );
    expect(email.text).toContain('Nov 7, 2026, 1:14 PM UTC');
  });

  it('describes the setup without provider-specific consent wording', async () => {
    let email = await renderEmail('Quinn');
    let text = email.text.replace(/\s+/g, ' ');

    expect(text).toContain(
      'As an administrator, you can review Microsoft Outlook and complete its setup for your organization.'
    );
    expect(text).toContain(
      "Once you're done, people at Acme can connect Microsoft Outlook on Metorial."
    );
    expect(text).not.toContain('consent');
  });

  it('falls back to the organization when the sender is unknown', async () => {
    let email = await renderEmail(null);

    expect(email.subject).toBe(
      'Someone at Acme asked you to approve Microsoft Outlook for your organization'
    );
  });
});
