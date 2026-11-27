import { generatePlainId } from '@lowerdeck/id';
import { slugify } from '@lowerdeck/slugify';
import { db } from '@mtsrc/slates-hub-db/db';
import { env } from '@mtsrc/slates-hub-env/env';
import { getId } from '@mtsrc/slates-hub-db/id';

export let hub = await db.hub.upsert({
  where: {
    internalIdentifier: 'default'
  },
  update: {},
  create: {
    ...getId('hub'),
    internalIdentifier: 'default',
    identifier: `slates::hub::${slugify(env.slates.SLATES_HUB_INSTANCE_IDENTIFIER)}::${generatePlainId(20)}`
  }
});
