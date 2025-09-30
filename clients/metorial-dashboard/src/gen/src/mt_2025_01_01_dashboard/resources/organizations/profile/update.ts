import { mtMap } from '@metorial/util-resource-mapper';

export type OrganizationsProfileUpdateOutput = {
  object: 'profile';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  imageUrl: string;
  isOfficial: boolean;
  isMetorial: boolean;
  isVerified: boolean;
  badges: { type: 'system' | 'staff'; name: string }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapOrganizationsProfileUpdateOutput =
  mtMap.object<OrganizationsProfileUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
    isOfficial: mtMap.objectField('is_official', mtMap.passthrough()),
    isMetorial: mtMap.objectField('is_metorial', mtMap.passthrough()),
    isVerified: mtMap.objectField('is_verified', mtMap.passthrough()),
    badges: mtMap.objectField(
      'badges',
      mtMap.array(
        mtMap.object({
          type: mtMap.objectField('type', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type OrganizationsProfileUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
};

export let mapOrganizationsProfileUpdateBody =
  mtMap.object<OrganizationsProfileUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough())
  });

