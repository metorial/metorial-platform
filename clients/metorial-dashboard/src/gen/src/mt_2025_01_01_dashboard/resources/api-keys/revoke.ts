import { mtMap } from '@metorial/util-resource-mapper';

export type ApiKeysRevokeOutput = {
  object: 'machine_access.api_key';
  id: string;
  status: 'active' | 'deleted';
  secretRedacted: string;
  secretRedactedLong: string;
  secret: string | null;
  type:
    | 'organization_management_token'
    | 'instance_access_token_secret'
    | 'instance_access_token_publishable';
  name: string;
  description: string | null;
  machineAccess: {
    object: 'machine_access';
    id: string;
    status: 'active' | 'deleted';
    type:
      | 'organization_management'
      | 'instance_secret'
      | 'instance_publishable';
    name: string;
    actor: {
      object: 'organization.actor';
      id: string;
      type: 'member' | 'machine_access';
      organizationId: string;
      name: string;
      email: string | null;
      imageUrl: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    instance: {
      object: 'organization.instance';
      id: string;
      status: 'active' | 'deleted';
      slug: string;
      name: string;
      type: 'development' | 'production';
      organizationId: string;
      project: {
        object: 'organization.project';
        id: string;
        status: 'active' | 'deleted';
        slug: string;
        name: string;
        organizationId: string;
        createdAt: Date;
        updatedAt: Date;
      };
      createdAt: Date;
      updatedAt: Date;
    } | null;
    organization: {
      object: 'organization';
      id: string;
      status: 'active' | 'deleted';
      type: 'default';
      slug: string;
      name: string;
      organizationId: string;
      imageUrl: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    user: {
      object: 'user';
      id: string;
      status: 'active' | 'deleted';
      type: 'user';
      email: string;
      name: string;
      firstName: string;
      lastName: string;
      imageUrl: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    deletedAt: Date;
    lastUsedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  };
  deletedAt: Date | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  revealInfo: { until: Date; forever: boolean } | null;
};

export let mapApiKeysRevokeOutput = mtMap.object<ApiKeysRevokeOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  status: mtMap.objectField('status', mtMap.passthrough()),
  secretRedacted: mtMap.objectField('secret_redacted', mtMap.passthrough()),
  secretRedactedLong: mtMap.objectField(
    'secret_redacted_long',
    mtMap.passthrough()
  ),
  secret: mtMap.objectField('secret', mtMap.passthrough()),
  type: mtMap.objectField('type', mtMap.passthrough()),
  name: mtMap.objectField('name', mtMap.passthrough()),
  description: mtMap.objectField('description', mtMap.passthrough()),
  machineAccess: mtMap.objectField(
    'machine_access',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      status: mtMap.objectField('status', mtMap.passthrough()),
      type: mtMap.objectField('type', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough()),
      actor: mtMap.objectField(
        'actor',
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          organizationId: mtMap.objectField(
            'organization_id',
            mtMap.passthrough()
          ),
          name: mtMap.objectField('name', mtMap.passthrough()),
          email: mtMap.objectField('email', mtMap.passthrough()),
          imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      ),
      instance: mtMap.objectField(
        'instance',
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          slug: mtMap.objectField('slug', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          organizationId: mtMap.objectField(
            'organization_id',
            mtMap.passthrough()
          ),
          project: mtMap.objectField(
            'project',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              organizationId: mtMap.objectField(
                'organization_id',
                mtMap.passthrough()
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      ),
      organization: mtMap.objectField(
        'organization',
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          slug: mtMap.objectField('slug', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          organizationId: mtMap.objectField(
            'organization_id',
            mtMap.passthrough()
          ),
          imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      ),
      user: mtMap.objectField(
        'user',
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          email: mtMap.objectField('email', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          firstName: mtMap.objectField('first_name', mtMap.passthrough()),
          lastName: mtMap.objectField('last_name', mtMap.passthrough()),
          imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      ),
      deletedAt: mtMap.objectField('deleted_at', mtMap.date()),
      lastUsedAt: mtMap.objectField('last_used_at', mtMap.date()),
      createdAt: mtMap.objectField('created_at', mtMap.date()),
      updatedAt: mtMap.objectField('updated_at', mtMap.date())
    })
  ),
  deletedAt: mtMap.objectField('deleted_at', mtMap.date()),
  lastUsedAt: mtMap.objectField('last_used_at', mtMap.date()),
  expiresAt: mtMap.objectField('expires_at', mtMap.date()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  updatedAt: mtMap.objectField('updated_at', mtMap.date()),
  revealInfo: mtMap.objectField(
    'reveal_info',
    mtMap.object({
      until: mtMap.objectField('until', mtMap.date()),
      forever: mtMap.objectField('forever', mtMap.passthrough())
    })
  )
});

