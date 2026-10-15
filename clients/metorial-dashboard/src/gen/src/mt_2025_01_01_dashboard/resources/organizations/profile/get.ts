import { mapObject } from '@metorial/util-resource-mapper/compact';

export type OrganizationsProfileGetOutput = {
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

export let mapOrganizationsProfileGetOutput =
  /* @__PURE__ */ mapObject<OrganizationsProfileGetOutput>(
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
