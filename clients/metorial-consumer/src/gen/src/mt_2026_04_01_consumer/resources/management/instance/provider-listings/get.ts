import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderListingsGetOutput = {
  object: 'provider.listing';
  id: string;
  attributes: {
    isPublic: boolean;
    isCustomized: boolean;
    isMetorial: boolean;
    isVerified: boolean;
    isOfficial: boolean;
  };
  name: string;
  description: string | null;
  slug: string;
  imageUrl: string;
  readme: string | null;
  skills: string[];
  provider: {
    object: 'provider';
    id: string;
    access: 'public' | 'tenant';
    status: 'active' | 'archived' | 'deleted';
    publisher: {
      object: 'provider.publisher';
      id: string;
      name: string;
      description: string | null;
      imageUrl: string;
      createdAt: Date;
      updatedAt: Date;
    };
    currentVersion: {
      object: 'provider.version';
      id: string;
      version: string;
      providerId: string;
      isCurrent: boolean;
      name: string;
      description: string | null;
      metadata: Record<string, any> | null;
      specificationId: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    oauth: {
      status: 'enabled' | 'disabled';
      callbackUrl: string | null;
      autoRegistration: { status: 'supported' | 'unsupported' };
    } | null;
    identifier: string;
    name: string;
    description: string | null;
    slug: string;
    metadata: Record<string, any> | null;
    createdAt: Date;
    updatedAt: Date;
  };
  categories: {
    object: 'provider.listing_category';
    id: string;
    name: string;
    description: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  collections: {
    object: 'provider.listing_collection';
    id: string;
    name: string;
    description: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  groups: {
    object: 'provider.listing_group';
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

export let mapManagementInstanceProviderListingsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderListingsGetOutput>(
    [
      [
        'attributes',
        0,
        [
          1,
          [
            'is_public',
            'is_customized',
            'is_metorial',
            'is_verified',
            'is_official'
          ]
        ]
      ],
      'image_url',
      [
        'provider',
        0,
        [
          1,
          [
            ['publisher', 0, [1, ['image_url', 'created_at', 'updated_at']]],
            [
              'current_version',
              1,
              [
                1,
                [
                  'provider_id',
                  'is_current',
                  'specification_id',
                  'created_at',
                  'updated_at'
                ]
              ]
            ],
            ['oauth', 0, [1, ['callback_url', 'auto_registration']]],
            'created_at',
            'updated_at'
          ]
        ]
      ],
      ['categories', 0, [2, 8]],
      ['collections', 0, [2, 8]],
      ['groups', 0, [2, 8]],
      'created_at',
      'updated_at'
    ],
    1
  );
