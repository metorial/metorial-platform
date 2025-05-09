import { mtMap } from '@metorial/util-resource-mapper';

export type ApiKeysUpdateOutput = {
  id: string;
  status: 'active' | 'deleted';
  secretRedacted: string;
  secretRedactedLong: string;
  secret: string | null;
  type:
    | 'user_auth_token'
    | 'organization_management_token'
    | 'instance_access_token_secret'
    | 'instance_access_token_publishable';
  name: string;
  description: string | null;
  machineAccess: {
    id: string;
    status: 'active' | 'deleted';
    type:
      | 'user_auth_token'
      | 'organization_management'
      | 'instance_secret'
      | 'instance_publishable';
    name: string;
    actor: {
      id: string;
      type: 'member' | 'machine_access';
      organizationId: string;
      actorId: string;
      name: string;
      email: string | null;
      imageUrl: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    instance: {
      id: string;
      status: 'active' | 'deleted';
      slug: string;
      name: string;
      type: 'development' | 'production';
      organizationId: string;
      project: {
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
    organizationId: {
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

export let mapApiKeysUpdateOutput = mtMap.object<ApiKeysUpdateOutput>({
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
      id: mtMap.objectField('id', mtMap.passthrough()),
      status: mtMap.objectField('status', mtMap.passthrough()),
      type: mtMap.objectField('type', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough()),
      actor: mtMap.objectField(
        'actor',
        mtMap.object({
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          organizationId: mtMap.objectField(
            'organization_id',
            mtMap.passthrough()
          ),
          actorId: mtMap.objectField('actor_id', mtMap.passthrough()),
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
      organizationId: mtMap.objectField(
        'organization_id',
        mtMap.object({
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

export type ApiKeysUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  expiresAt?: Date | undefined;
};

export let mapApiKeysUpdateBody = mtMap.object<ApiKeysUpdateBody>({
  name: mtMap.objectField('name', mtMap.passthrough()),
  description: mtMap.objectField('description', mtMap.passthrough()),
  expiresAt: mtMap.objectField('expiresAt', mtMap.date())
});

