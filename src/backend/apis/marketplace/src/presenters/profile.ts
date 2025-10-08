import { getImageUrl, Profile } from '@metorial/db';

export let profilePresenter = async (profile: Profile) => ({
  object: 'marketplace*profile',

  id: profile.id,
  identifier: profile.slug,
  name: profile.name,
  description: profile.description,

  imageUrl: await getImageUrl(profile),

  attributes: profile.attributes,

  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt
});
