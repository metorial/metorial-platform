import { createHono } from '@mtsrc/hono';

export let pingApp = createHono()
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'));
