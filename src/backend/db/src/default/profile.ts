import { db } from '../db';
import { ID } from '../id';
import { createEnsureRecord } from '../lib';

let ensureProfile = createEnsureRecord(
  db.profile,
  d => ({
    slug: d.slug
  }),
  async () => ({
    id: await ID.generateId('profile')
  })
);

export let systemProfile = ensureProfile(() => ({
  name: 'Metorial',
  slug: 'metorial',
  type: 'system',
  image: {
    type: 'url',
    url: 'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg'
  },
  attributes: {}
}));
