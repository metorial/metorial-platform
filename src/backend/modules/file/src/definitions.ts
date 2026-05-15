import { ensureFilePurpose } from '@metorial/db';

export let purposes = {
  user_image: ensureFilePurpose(() => ({
    name: 'User Image',
    slug: 'user_image',
    ownerType: 'user',
    canHaveLinks: true
  })),

  organization_image: ensureFilePurpose(() => ({
    name: 'Organization Image',
    slug: 'organization_image',
    ownerType: 'organization',
    canHaveLinks: true
  })),

  project_brand_image: ensureFilePurpose(() => ({
    name: 'Project Brand Image',
    slug: 'project_brand_image',
    ownerType: 'organization',
    canHaveLinks: true
  })),

  skill_image: ensureFilePurpose(() => ({
    name: 'Skill Image',
    slug: 'skill_image',
    ownerType: 'instance',
    canHaveLinks: true
  })),

  generic: ensureFilePurpose(() => ({
    name: 'Generic',
    slug: 'generic',
    ownerType: 'instance',
    canHaveLinks: true
  }))
};

export let purposeSlugs = Object.keys(purposes);
