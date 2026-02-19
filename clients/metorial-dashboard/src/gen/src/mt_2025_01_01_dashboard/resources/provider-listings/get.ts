import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderListingsGetOutput = {
  object: 'provider.listing';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  imageUrl: string | null;
  readme: string | null;
  skills: string[];
  flags: {
    isPublic: boolean;
    isCustomized: boolean;
    isMetorial: boolean;
    isVerified: boolean;
    isOfficial: boolean;
  };
  providerId: string | null;
  categories: {
    object: 'provider.category';
    id: string;
    name: string;
    description: string | null;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  collections: {
    object: 'provider.collection';
    id: string;
    name: string;
    description: string | null;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  groups: {
    object: 'provider.group';
    id: string;
    name: string;
    description: string | null;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapProviderListingsGetOutput = mtMap.object<ProviderListingsGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  name: mtMap.objectField('name', mtMap.passthrough()),
  description: mtMap.objectField('description', mtMap.passthrough()),
  slug: mtMap.objectField('slug', mtMap.passthrough()),
  imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
  readme: mtMap.objectField('readme', mtMap.passthrough()),
  skills: mtMap.objectField('skills', mtMap.array(mtMap.passthrough())),
  flags: mtMap.objectField(
    'flags',
    mtMap.object({
      isPublic: mtMap.objectField('is_public', mtMap.passthrough()),
      isCustomized: mtMap.objectField('is_customized', mtMap.passthrough()),
      isMetorial: mtMap.objectField('is_metorial', mtMap.passthrough()),
      isVerified: mtMap.objectField('is_verified', mtMap.passthrough()),
      isOfficial: mtMap.objectField('is_official', mtMap.passthrough())
    })
  ),
  providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
  categories: mtMap.objectField(
    'categories',
    mtMap.array(
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    )
  ),
  collections: mtMap.objectField(
    'collections',
    mtMap.array(
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    )
  ),
  groups: mtMap.objectField(
    'groups',
    mtMap.array(
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    )
  ),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  updatedAt: mtMap.objectField('updated_at', mtMap.date())
});
