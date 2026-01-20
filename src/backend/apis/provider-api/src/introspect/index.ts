import { createHono } from '@metorial/hono';
import { apiDefinition } from './definition';

export let introspectController = createHono()
  .get('/versions', c => {
    return c.json({
      versions: [
        {
          version: 'v1',
          displayVersion: '1.0',
          isCurrent: true
        }
      ]
    });
  })
  .get('/endpoints', c => {
    let version = c.req.query('version');

    if (!version) {
      return c.json({ error: 'Version is required' }, 400);
    }

    return c.json(apiDefinition);
  });
