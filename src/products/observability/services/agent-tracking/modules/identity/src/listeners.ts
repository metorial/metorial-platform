import { Events } from '@mtsrc/agent-tracking-events';
import { invalidateEntityCache } from './lib/cache';

Events.listen('entities.identifiers.released:after', async d => {
  if (!d.identifiers.length) return;

  await invalidateEntityCache(d);
});
