import { describe, expect, it } from 'bun:test';

process.env.DATABASE_URL ??= 'postgresql://localhost/test';
process.env.INTEGRATIONS_API_URL ??= 'https://integrations.example.com';
process.env.SLATE_ATTACHMENT_SIGNING_SECRET ??= 'test-tool-call-attachment-secret';

let {
  getRawToolCallAttachmentsFromOutput,
  presentToolCallAttachment,
  replaceToolCallAttachmentsInOutput
} = await import('./toolCallAttachment');
let { verifyToolCallAttachmentToken } = await import('./toolCallAttachmentToken');

describe('tool call attachment URLs', () => {
  it('includes a typed token bound to the attachment url key', async () => {
    let presented = await presentToolCallAttachment({
      urlKey: 'tca_link_example',
      mimeType: 'image/png'
    });
    let url = new URL(presented.url);
    let token = url.searchParams.get('token');

    expect(url.pathname).toBe('/tool-call-attachments/tca_link_example');
    expect(token).toStartWith('tool_call_attachment_v1_');
    expect(presented.urlExpiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(presented.urlExpiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 5 * 60_000);
    expect(
      await verifyToolCallAttachmentToken({
        urlKey: 'tca_link_example',
        token: token!
      })
    ).toBe(true);
    expect(
      await verifyToolCallAttachmentToken({
        urlKey: 'tca_link_different',
        token: token!
      })
    ).toBe(false);
  });

  it('rejects a tampered token', async () => {
    let presented = await presentToolCallAttachment({ urlKey: 'tca_link_example' });
    let token = new URL(presented.url).searchParams.get('token')!;
    let tamperedToken = `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`;

    expect(
      await verifyToolCallAttachmentToken({
        urlKey: 'tca_link_example',
        token: tamperedToken
      })
    ).toBe(false);
  });
});

describe('getRawToolCallAttachmentsFromOutput', () => {
  it('records slateAttachmentId from proxied attachment output', () => {
    let attachments = getRawToolCallAttachmentsFromOutput({
      type: 'tool.result',
      data: {
        $attachments: [
          {
            type: 'url',
            attachmentId: 'shsa_123',
            url: 'https://slates-hub.example/integration-attachment/shsa_123?ts=1&sig=abc',
            mimeType: 'image/png',
            urlExpiresAt: '2026-01-01T00:00:00.000Z'
          }
        ]
      }
    } as PrismaJson.SessionMessageOutput);

    expect(attachments).toEqual([
      {
        slateAttachmentId: 'shsa_123',
        mimeType: 'image/png',
        expiresAt: new Date('2026-01-01T00:00:00.000Z')
      }
    ]);
  });

  it('does not retain an attachment URL when the hub omitted attachmentId', () => {
    let output = {
      type: 'tool.result',
      data: {
        $attachments: [
          {
            type: 'url',
            url: 'https://slates-hub.example/integration-attachment/shsa_123',
            mimeType: 'image/png'
          }
        ]
      }
    } as PrismaJson.SessionMessageOutput;
    let attachments = getRawToolCallAttachmentsFromOutput(output);

    expect(attachments).toEqual([]);
    expect(replaceToolCallAttachmentsInOutput(output, [])).toEqual({
      type: 'tool.result',
      data: { $attachments: [] }
    });
  });
});
