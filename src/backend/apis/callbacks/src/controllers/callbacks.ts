import { createHono } from '@metorial/hono';
import { callbackHandlerService } from '@metorial/module-callbacks';

export let callbacksController = createHono().all('/hook/:key/*', async c => {
  let event = await callbackHandlerService.handleWebhookCallback({
    key: c.req.param('key')!,
    url: c.req.url,
    headers: c.req.header(),
    body: await c.req.text(),
    method: c.req.method
  });

  return c.json({ event_id: event.id });
});
