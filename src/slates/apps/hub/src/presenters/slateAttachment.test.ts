import { describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  signedIntegrationAttachmentUrl: vi.fn(
    async (attachmentId: string) =>
      `https://slates.example.com/integration-attachment/${attachmentId}?ts=1&sig=2`
  )
}));

vi.mock('../db', () => ({ db: {} }));
vi.mock('../lib/attachmentSignature', () => ({
  signedIntegrationAttachmentUrl: mocks.signedIntegrationAttachmentUrl
}));

import { slateStoredAttachmentPresenter } from './slateAttachment';

describe('slateStoredAttachmentPresenter', () => {
  it('delegates stored objects through their Slate attachment ID', async () => {
    let expiresAt = new Date('2026-09-15T19:00:49.943Z');
    let result = await slateStoredAttachmentPresenter({
      id: 'shsa_123',
      targetUrl: null,
      storageBucket: 'attachments',
      storageKey: 'uploads/shau_123',
      expiresAt
    } as any);

    expect(result).toEqual({
      type: 'url',
      attachmentId: 'shsa_123',
      url: 'https://slates.example.com/integration-attachment/shsa_123?ts=1&sig=2',
      urlExpiresAt: expiresAt
    });
  });

  it('delegates proxied URLs through their Slate attachment ID', async () => {
    let expiresAt = new Date('2026-09-15T19:00:49.943Z');
    let result = await slateStoredAttachmentPresenter({
      id: 'shsa_456',
      targetUrl: 'https://provider.example.com/file',
      storageBucket: null,
      storageKey: null,
      expiresAt
    } as any);

    expect(result.url).toBe(
      'https://slates.example.com/integration-attachment/shsa_456?ts=1&sig=2'
    );
    expect(result.attachmentId).toBe('shsa_456');
  });
});
