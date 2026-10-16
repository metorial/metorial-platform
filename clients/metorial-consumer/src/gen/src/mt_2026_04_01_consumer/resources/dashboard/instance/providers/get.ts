import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProvidersGetOutput = {
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

export let mapDashboardInstanceProvidersGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProvidersGetOutput>(
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
    ],
    1
  );
