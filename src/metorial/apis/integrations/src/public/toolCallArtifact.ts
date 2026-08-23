import { base62 } from '@lowerdeck/base62';
import { createHono } from '@lowerdeck/hono';
import { db } from '@metorial-subspace/db';
import { env } from '../env';

export let toolCallArtifactApp = createHono().get('/:urlKey', async c => {
  let urlKey = c.req.param('urlKey');

  let attachment = await db.toolCallAttachment.findFirst({
    where: { urlKey }
  });
  if (!attachment) return c.text('Tool call artifact not found', 404);

  if (attachment.expiresAt && attachment.expiresAt < new Date()) {
    return c.text('Tool call artifact has expired', 410);
  }

  if (env.files.TOOL_CALL_ATTACHMENT_CAMO_URL) {
    let camoUrl = new URL(env.files.TOOL_CALL_ATTACHMENT_CAMO_URL);
    camoUrl.pathname = base62.encode(
      JSON.stringify({
        url: attachment.url,
        ts: Date.now() / 1000,
        ex: attachment.expiresAt ? attachment.expiresAt.getTime() / 1000 : undefined
      })
    );
    return c.redirect(camoUrl.toString());
  }

  return c.redirect(attachment.url);
});
