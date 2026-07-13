import { delay } from '@lowerdeck/delay';
import { ensureFilePurpose as ensureFilePurposeInLocalDB } from '@metorial/db';
import { cargo } from './cargo';

let ensureFilePurpose = async (d: {
  name: string;
  slug: string;
  ownerType: 'user' | 'organization' | 'instance';
  canHaveLinks: boolean;
}) => {
  let res = await ensureFilePurposeInLocalDB(() => d);

  void (async () => {
    while (true) {
      try {
        await cargo.filePurpose.upsert({
          slug: d.slug,
          name: d.name,
          ownerType: d.ownerType,
          canHaveLinks: d.canHaveLinks
        });
        return;
      } catch (error) {
        console.log('Failed to ensure file purpose in cargo ... retrying', error);
      }

      await delay(500);
    }
  })();

  return res;
};

export let purposes = {
  user_image: ensureFilePurpose({
    name: 'User Image',
    slug: 'user_image',
    ownerType: 'user',
    canHaveLinks: true
  }),

  organization_image: ensureFilePurpose({
    name: 'Organization Image',
    slug: 'organization_image',
    ownerType: 'organization',
    canHaveLinks: true
  }),

  project_brand_image: ensureFilePurpose({
    name: 'Project Brand Image',
    slug: 'project_brand_image',
    ownerType: 'organization',
    canHaveLinks: true
  }),

  skill_image: ensureFilePurpose({
    name: 'Skill Image',
    slug: 'skill_image',
    ownerType: 'instance',
    canHaveLinks: true
  }),

  skill_export: ensureFilePurpose({
    name: 'Skill Export',
    slug: 'skill_export',
    ownerType: 'instance',
    canHaveLinks: true
  }),

  generic: ensureFilePurpose({
    name: 'Generic',
    slug: 'generic',
    ownerType: 'instance',
    canHaveLinks: true
  })
};

export let purposeSlugs = Object.keys(purposes);
