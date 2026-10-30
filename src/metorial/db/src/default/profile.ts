import { branding } from '@metorial/branding';
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
  slug: 'system',
  type: 'system',
  isMetorial: true,
  isOfficial: true,
  isVerified: true,
  image: {
    type: 'url',
    url: branding.logoUrl
  },
  attributes: {}
}));
