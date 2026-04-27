import { createHono } from '@lowerdeck/hono';
import { db } from '@metorial-subspace/db';

export let toolCallArtifactApp = createHono().get('/:urlKey', async c => {
  let urlKey = c.req.param('urlKey');

  let attachment = await db.toolCallAttachment.findFirst({
    where: { urlKey }
  });
  if (!attachment) return c.text('Tool call artifact not found', 404);

  if (attachment.expiresAt && attachment.expiresAt < new Date()) {
    return c.text('Tool call artifact has expired', 410);
  }

  return c.redirect(attachment.url);
});
