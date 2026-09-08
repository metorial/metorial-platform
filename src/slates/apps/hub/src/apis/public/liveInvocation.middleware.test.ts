import { describe, expect, it, vi } from 'vitest';

vi.mock('../../db', () => ({
  db: {
    slateInvocation: { findFirst: vi.fn() },
    slateAttachmentUpload: { create: vi.fn() }
  }
}));

vi.mock('../../storage', () => ({
  invocationsBucketRecord: { bucket: 'invocations' },
  storage: { getPublicURL: vi.fn() }
}));

vi.mock('../../lib/invocation/liveToken', () => ({
  resolveLiveInvocationToken: vi.fn().mockResolvedValue(null),
  reserveAttachmentBudget: vi.fn(),
  releaseAttachmentBudget: vi.fn()
}));

vi.mock('../../env', () => ({
  env: {
    storage: { MAX_ATTACHMENT_SIZE_BYTES: undefined }
  }
}));

process.env.SLATE_ATTACHMENT_SIGNING_SECRET ??= 'test-signing-secret';

let { liveInvocationApp } = await import('./liveInvocation');

describe('live invocation auth middleware', () => {
  it('does not intercept unrelated paths such as /ping', async () => {
    let response = await liveInvocationApp.request('/ping');

    expect(response.status).not.toBe(401);
    expect(await response.json().catch(() => null)).not.toEqual({
      error: 'invalid_or_expired_token'
    });
  });

  it('still rejects live-invocation routes without a bearer token', async () => {
    let response = await liveInvocationApp.request('/slates-hub/live-invocation/attachments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ attachments: [] })
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'invalid_or_expired_token' });
  });
});
