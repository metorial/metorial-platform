import { Events } from '@mtsrc/agent-tracking-events';
import { maybeClassifySession } from './lib/trigger';

Events.listen('sessions.session.turn_completed:after', async d => {
  await maybeClassifySession({ sessionKey: d.sessionKey, reason: 'turn_completed' });
});

Events.listen('sessions.session.idle:after', async d => {
  for (let sessionKey of d.sessionKeys) {
    await maybeClassifySession({ sessionKey, reason: 'idle' });
  }
});
