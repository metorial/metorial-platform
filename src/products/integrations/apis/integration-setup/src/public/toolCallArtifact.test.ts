import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  verifyToolCallAttachmentToken: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    toolCallAttachment: {
      findFirst: mocks.findFirst
    }
  },
  verifyToolCallAttachmentToken: mocks.verifyToolCallAttachmentToken
}));

process.env.INTEGRATIONS_API_URL ??= 'https://integrations.example.com';
process.env.INTEGRATIONS_UI_URL ??= 'https://integrations-ui.example.com';
process.env.SLATES_HUB_PUBLIC_URL ??= 'https://slates.example.com';
process.env.SLATE_ATTACHMENT_SIGNING_SECRET ??= 'test-tool-call-attachment-secret';

let { toolCallArtifactApp } = await import('./toolCallArtifact');

describe('tool call artifact endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a missing token before looking up the attachment', async () => {
    let response = await toolCallArtifactApp.request('/tca_link_example');

    expect(response.status).toBe(403);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a token that is not valid for the url key', async () => {
    mocks.verifyToolCallAttachmentToken.mockResolvedValue(false);

    let response = await toolCallArtifactApp.request('/tca_link_example?token=invalid');

    expect(response.status).toBe(403);
    expect(mocks.verifyToolCallAttachmentToken).toHaveBeenCalledWith({
      urlKey: 'tca_link_example',
      token: 'invalid'
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('serves an attachment when its url-key token is valid', async () => {
    mocks.verifyToolCallAttachmentToken.mockResolvedValue(true);
    mocks.findFirst.mockResolvedValue({
      urlKey: 'tca_link_example',
      url: 'https://provider.example/file',
      slateAttachmentId: null,
      expiresAt: null
    });

    let response = await toolCallArtifactApp.request('/tca_link_example?token=valid');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://provider.example/file');
  });
});
