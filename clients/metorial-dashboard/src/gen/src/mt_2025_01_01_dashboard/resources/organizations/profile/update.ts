import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ mapObject<OrganizationsProfileUpdateOutput>(
    [
      'image_url',
      'is_official',
      'is_metorial',
      'is_verified',
      'created_at',
      'updated_at'
    ],
    1
  );

export type OrganizationsProfileUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
};

export let mapOrganizationsProfileUpdateBody =
  /* @__PURE__ */ createMapper<OrganizationsProfileUpdateBody>(0);
