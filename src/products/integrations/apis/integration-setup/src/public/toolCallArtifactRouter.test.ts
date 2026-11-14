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
process.env.TOOL_CALL_ROUTER_URL ??= 'https://tool-attachments.example.com';
process.env.TOOL_ATTACHMENT_ROUTER_SECRET ??= 'test-router-secret';

let { toolCallArtifactApp } = await import('./toolCallArtifact');

describe('tool call artifact endpoint with the router enabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToolCallAttachmentToken.mockResolvedValue(true);
  });

  it('redirects requests without the router secret to the router url', async () => {
    let response = await toolCallArtifactApp.request('/tca_link_example_us1?token=valid');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://tool-attachments.example.com/attachments/tca_link_example_us1?token=valid'
    );
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('redirects requests with the wrong router secret to the router url', async () => {
    let response = await toolCallArtifactApp.request('/tca_link_example_us1?token=valid', {
      headers: { 'metorial-tool-attachment-router-secret': 'wrong-secret' }
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('https://tool-attachments.example.com');
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('resolves the attachment for a caller carrying the router secret', async () => {
    mocks.findFirst.mockResolvedValue({
      urlKey: 'tca_link_example_us1',
      url: 'https://provider.example/file',
      slateAttachmentId: null,
      expiresAt: null
    });

    let response = await toolCallArtifactApp.request('/tca_link_example_us1?token=valid', {
      headers: { 'metorial-tool-attachment-router-secret': 'test-router-secret' }
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://provider.example/file');
  });

  it('returns a json resolution instead of a redirect when prefer-url is set', async () => {
    mocks.findFirst.mockResolvedValue({
      urlKey: 'tca_link_example_us1',
      url: 'https://provider.example/file',
      slateAttachmentId: null,
      expiresAt: null
    });

    let response = await toolCallArtifactApp.request('/tca_link_example_us1?token=valid', {
      headers: {
        'metorial-tool-attachment-router-secret': 'test-router-secret',
        'metorial-prefer-url': '1'
      }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: 'https://provider.example/file' });
  });

  it('returns a json resolution for slate-sourced attachments when prefer-url is set', async () => {
    mocks.findFirst.mockResolvedValue({
      urlKey: 'tca_link_example_us1',
      url: null,
      slateAttachmentId: 'shsa_123',
      expiresAt: null
    });

    let response = await toolCallArtifactApp.request('/tca_link_example_us1?token=valid', {
      headers: {
        'metorial-tool-attachment-router-secret': 'test-router-secret',
        'metorial-prefer-url': '1'
      }
    });

    expect(response.status).toBe(200);
    let body = (await response.json()) as { url: string };
    expect(body.url).toContain('https://slates.example.com/integration-attachment/shsa_123');
  });
});
