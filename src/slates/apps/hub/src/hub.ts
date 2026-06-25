import { generatePlainId } from '@lowerdeck/id';
import { slugify } from '@lowerdeck/slugify';
import { db } from './db';
import { env } from './env';
import { getId } from './id';

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
