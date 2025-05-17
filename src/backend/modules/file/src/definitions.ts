import { ensureFilePurpose } from '@metorial/db';

export let purposes = {
  user_image: ensureFilePurpose(() => ({
    name: 'User Image',
    slug: 'user_image',
    ownerType: 'user'
  })),

  organization_image: ensureFilePurpose(() => ({
    name: 'Organization Image',
    slug: 'organization_image',
    ownerType: 'organization'
  }))
};

export let purposeSlugs = Object.keys(purposes);
