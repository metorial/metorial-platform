import { base62 } from '@lowerdeck/base62';
import { createHono, type Context } from '@lowerdeck/hono';
import { db, verifyToolCallAttachmentToken } from '@metorial-subspace/db';
import { signSlateAttachmentId } from '../attachmentSignature';
import { env } from '../env';

let PREFER_URL_REQUEST_HEADER = 'metorial-prefer-url';
let ROUTER_SECRET_HEADER = 'metorial-tool-attachment-router-secret';

let hasValidRouterSecret = (c: Context) => {
  let configured = env.secrets.TOOL_ATTACHMENT_ROUTER_SECRET;
  if (!configured) return true;
  return c.req.header(ROUTER_SECRET_HEADER) === configured;
};

export let toolCallArtifactApp = createHono().get('/:urlKey', async c => {
  let urlKey = c.req.param('urlKey');
  let token = c.req.query('token');

  if (!token || !(await verifyToolCallAttachmentToken({ urlKey, token }))) {
    return c.text('Tool call artifact link is invalid or has expired', 403);
  }

  if (env.service.TOOL_CALL_ROUTER_URL && !hasValidRouterSecret(c)) {
    let routerUrl = new URL(`/attachments/${urlKey}`, env.service.TOOL_CALL_ROUTER_URL);
    routerUrl.searchParams.set('token', token);
    return c.redirect(routerUrl.toString());
  }

  let attachment = await db.toolCallAttachment.findFirst({
    where: { urlKey }
  });
  if (!attachment) return c.text('Tool call artifact not found', 404);

  if (attachment.expiresAt && attachment.expiresAt < new Date()) {
    return c.text('Tool call artifact has expired', 410);
  }

  let preferUrl = !!c.req.header(PREFER_URL_REQUEST_HEADER);
  let respond = (url: string) => (preferUrl ? c.json({ url }) : c.redirect(url));

  if (attachment.slateAttachmentId) {
    let { ts, sig } = await signSlateAttachmentId(attachment.slateAttachmentId);
    let slateUrl = new URL(
      `${env.service.SLATES_HUB_PUBLIC_URL}/integration-attachment/${attachment.slateAttachmentId}`
    );
    slateUrl.searchParams.set('ts', String(ts));
    slateUrl.searchParams.set('sig', sig);
    return respond(slateUrl.toString());
  }

  if (!attachment.url) return c.text('Tool call artifact not found', 404);

  if (env.files.TOOL_CALL_ATTACHMENT_CAMO_URL) {
    let camoUrl = new URL(env.files.TOOL_CALL_ATTACHMENT_CAMO_URL);
    camoUrl.pathname = base62.encode(
      JSON.stringify({
        url: attachment.url,
        ts: Date.now() / 1000,
        ex: attachment.expiresAt ? attachment.expiresAt.getTime() / 1000 : undefined
      })
    );
    return respond(camoUrl.toString());
  }

  return respond(attachment.url);
});
