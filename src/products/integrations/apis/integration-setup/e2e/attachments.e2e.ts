import { uniqueId, useMcpTestServer, useOrganization } from '@metorial/e2e';
import { presentToolCallAttachment } from '@metorial-subspace/db';
import { StampedSignature, Tokens } from '@lowerdeck/tokens';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  attachmentToken,
  createAttachment,
  createToolCall,
  integrationsApi
} from './_fixtures';

let INVALID_LINK = 'Tool call artifact link is invalid or has expired';

describe('api-integrations tool call attachments', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let toolCall: Awaited<ReturnType<typeof createToolCall>>;
  let otherToolCall: Awaited<ReturnType<typeof createToolCall>>;

  beforeAll(async () => {
    toolCall = await createToolCall(org, server.url);
    otherToolCall = await createToolCall(otherOrg, server.url);
  }, 120_000);

  let open = (urlKey: string, token?: string, headers: Record<string, string> = {}) =>
    integrationsApi().get(`/tool-call-attachments/${urlKey}`, {
      query: { token },
      headers
    });

  it('presents a link that redirects to the stored url or returns it as JSON', async () => {
    let target = `https://files.example.com/${uniqueId('file')}.png`;
    let attachment = await createAttachment(toolCall, { url: target, mimeType: 'image/png' });

    let presented = await presentToolCallAttachment(attachment);
    let link = new URL(presented.url);
    expect(link.pathname).toBe(`/tool-call-attachments/${attachment.urlKey}`);
    expect(link.origin).toBe(new URL(process.env.INTEGRATIONS_API_URL!).origin);
    expect(presented).toMatchObject({ type: 'url', id: attachment.id, mimeType: 'image/png' });

    let token = link.searchParams.get('token')!;

    let redirect = await open(attachment.urlKey, token);
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('location')).toBe(target);

    let preferred = await open(attachment.urlKey, token, { 'metorial-prefer-url': '1' });
    expect(preferred).toMatchObject({ status: 200, body: { url: target } });

    let legacy = await integrationsApi().get(`/tool-call-artifacts/${attachment.urlKey}`, {
      query: { token }
    });
    expect(legacy.status).toBe(302);
    expect(legacy.headers.get('location')).toBe(target);
  });

  it('signs slate attachment redirects with a fresh stamped signature', async () => {
    let slateAttachmentId = uniqueId('slatt');
    let attachment = await createAttachment(toolCall, { slateAttachmentId });

    let before = Date.now();
    let response = await open(attachment.urlKey, await attachmentToken(attachment.urlKey));
    expect(response.status).toBe(302);

    let location = new URL(response.headers.get('location')!);
    let hub = new URL(process.env.SLATES_HUB_PUBLIC_URL!);
    expect(location.origin).toBe(hub.origin);
    expect(location.pathname).toBe(`/integration-attachment/${slateAttachmentId}`);

    let ts = Number(location.searchParams.get('ts'));
    let sig = location.searchParams.get('sig')!;
    expect(ts).toBeGreaterThanOrEqual(before - 1_000);
    expect(ts).toBeLessThanOrEqual(Date.now() + 1_000);

    let stamp = new StampedSignature({ secret: process.env.SLATE_ATTACHMENT_SIGNING_SECRET! });
    expect(await stamp.verify(slateAttachmentId, ts, sig, 60_000)).toBe(true);
    expect(await stamp.verify(uniqueId('slatt'), ts, sig, 60_000)).toBe(false);

    let preferred = await open(attachment.urlKey, await attachmentToken(attachment.urlKey), {
      'metorial-prefer-url': 'true'
    });
    expect(preferred.status).toBe(200);
    expect(new URL(preferred.body.url).pathname).toBe(
      `/integration-attachment/${slateAttachmentId}`
    );
  });

  it('rejects missing, malformed, tampered, expired and foreign-type tokens', async () => {
    let attachment = await createAttachment(toolCall, {
      url: `https://files.example.com/${uniqueId('file')}`
    });
    let valid = await attachmentToken(attachment.urlKey);
    let signature = valid.split('_').pop()!;
    let flipped = signature.at(-1) == 'A' ? 'B' : 'A';

    let forgedSecret = new Tokens({ secret: uniqueId('not-the-secret') });
    let realSecret = new Tokens({ secret: process.env.SLATE_ATTACHMENT_SIGNING_SECRET! });
    let farFuture = new Date(Date.now() + 60 * 60 * 1000);

    let tokens: Record<string, string | undefined> = {
      missing: undefined,
      empty: '',
      garbage: 'not-a-token',
      'tampered signature': `${valid.slice(0, -1)}${flipped}`,
      'payload swapped': valid.replace(
        valid.split('_').at(-2)!,
        (await attachmentToken(uniqueId('tca_link_'))).split('_').at(-2)!
      ),
      expired: await attachmentToken(attachment.urlKey, new Date(Date.now() - 1_000)),
      'signed with another secret': await forgedSecret.sign({
        type: 'tool_call_attachment',
        data: { urlKey: attachment.urlKey },
        expiresAt: farFuture
      }),
      'another token type': await realSecret.sign({
        type: 'tool_call_attachment_admin',
        data: { urlKey: attachment.urlKey },
        expiresAt: farFuture
      })
    };

    for (let [name, token] of Object.entries(tokens)) {
      let response = await open(attachment.urlKey, token);
      expect({ status: response.status, text: response.text }, name).toEqual({
        status: 403,
        text: INVALID_LINK
      });
      expect(response.headers.get('location'), name).toBeNull();
    }

    expect((await open(attachment.urlKey, valid)).status).toBe(302);
  });

  it("does not open another tenant's attachment with a token minted for a different link", async () => {
    let own = await createAttachment(toolCall, {
      url: `https://files.example.com/${uniqueId('own')}`
    });
    let foreign = await createAttachment(otherToolCall, {
      url: `https://files.example.com/${uniqueId('foreign')}`
    });
    let ownToken = await attachmentToken(own.urlKey);

    let crossTenant = await open(foreign.urlKey, ownToken);
    expect(crossTenant).toMatchObject({ status: 403, text: INVALID_LINK });

    let unknown = await open(uniqueId('tca_link_'), ownToken);
    expect(unknown).toMatchObject({ status: 403, text: INVALID_LINK });

    let foreignResponse = await open(foreign.urlKey, await attachmentToken(foreign.urlKey));
    expect(foreignResponse.headers.get('location')).toBe(foreign.url);
  });

  it('distinguishes unknown, expired and empty attachments behind a valid token', async () => {
    let missingKey = `tca_link_${uniqueId('missing')}`;
    let missing = await open(missingKey, await attachmentToken(missingKey));
    expect(missing).toMatchObject({ status: 404, text: 'Tool call artifact not found' });

    let expired = await createAttachment(toolCall, {
      url: `https://files.example.com/${uniqueId('expired')}`,
      expiresAt: new Date(Date.now() - 1_000)
    });
    let gone = await open(expired.urlKey, await attachmentToken(expired.urlKey));
    expect(gone).toMatchObject({ status: 410, text: 'Tool call artifact has expired' });
    expect(gone.headers.get('location')).toBeNull();

    let presented = await presentToolCallAttachment(expired);
    expect(presented.urlExpiresAt.getTime()).toBe(expired.expiresAt!.getTime());

    let empty = await createAttachment(toolCall, {});
    let emptyResponse = await open(empty.urlKey, await attachmentToken(empty.urlKey));
    expect(emptyResponse).toMatchObject({ status: 404, text: 'Tool call artifact not found' });
  });
});
