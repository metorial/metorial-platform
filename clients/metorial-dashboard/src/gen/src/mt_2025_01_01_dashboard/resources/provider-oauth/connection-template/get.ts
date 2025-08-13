import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderOauthConnectionTemplateGetOutput = {
  object: 'provider_oauth.connection_template';
  id: string;
  status: 'active' | 'archived';
  slug: string;
  name: string;
  provider: { name: string; url: string; imageUrl: string };
  scopes: { id: string; identifier: string; description: string }[];
  variables: {
    id: string;
    key: string;
    type: 'string';
    label: string;
    description: string | null;
  }[];
  profile: {
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
  createdAt: Date;
  updatedAt: Date;
};

export let mapProviderOauthConnectionTemplateGetOutput =
  mtMap.object<ProviderOauthConnectionTemplateGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    provider: mtMap.objectField(
      'provider',
      mtMap.object({
        name: mtMap.objectField('name', mtMap.passthrough()),
        url: mtMap.objectField('url', mtMap.passthrough()),
        imageUrl: mtMap.objectField('image_url', mtMap.passthrough())
      })
    ),
    scopes: mtMap.objectField(
      'scopes',
      mtMap.array(
        mtMap.object({
          id: mtMap.objectField('id', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough())
        })
      )
    ),
    variables: mtMap.objectField(
      'variables',
      mtMap.array(
        mtMap.object({
          id: mtMap.objectField('id', mtMap.passthrough()),
          key: mtMap.objectField('key', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          label: mtMap.objectField('label', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough())
        })
      )
    ),
    profile: mtMap.objectField(
      'profile',
      mtMap.object({
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
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

