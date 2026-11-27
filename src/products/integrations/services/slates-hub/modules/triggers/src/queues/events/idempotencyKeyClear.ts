import { createCron } from '@lowerdeck/cron';
import { subHours } from 'date-fns';
import { db } from '@mtsrc/slates-hub-db/db';
import { env } from '@mtsrc/slates-hub-env/env';
import { TRIGGER_RAW_EVENT_IDEMPOTENCY_KEY_TTL_HOURS } from '../trigger/_config';

export let triggerRawEventIdempotencyKeyClearCron = createCron(
  {
    name: 'shub/trg/evt/idempotencyKeyClear/1',
    redisUrl: env.service.REDIS_URL,
    cron: '0 * * * *'
  },
  async () => {
    await db.triggerRawEvent.updateMany({
      where: {
        idempotencyKey: { not: null },
        createdAt: { lt: subHours(new Date(), TRIGGER_RAW_EVENT_IDEMPOTENCY_KEY_TTL_HOURS) }
      },
      data: { idempotencyKey: null }
    });
  }
);
