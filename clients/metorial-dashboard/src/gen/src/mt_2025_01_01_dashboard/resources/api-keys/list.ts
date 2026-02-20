import { mtMap } from '@metorial/util-resource-mapper';

export type ApiKeysListOutput = {
  items: {
    object: 'machine_access.api_key';
    id: string;
    status: 'active' | 'deleted';
    secretRedacted: string;
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
      lastUsedAt: Date;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date;
      actor: {
        object: 'organization.actor';
        id: string;
        type: 'member' | 'machine_access';
        organizationId: string;
        name: string;
        email: string | null;
        imageUrl: string;
        teams: {
          id: string;
          name: string;
          slug: string;
          assignmentId: string;
          createdAt: Date;
          updatedAt: Date;
        }[];
        createdAt: Date;
        updatedAt: Date;
      } | null;
      instance: {
        object: 'organization.instance';
        id: string;
        slug: string;
        name: string;
        organizationId: string;
        type: 'development' | 'production';
        createdAt: Date;
        updatedAt: Date;
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
      } | null;
      organization: {
        object: 'organization';
        id: string;
        type: 'default';
        slug: string;
        name: string;
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
    };
    deletedAt: Date | null;
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapApiKeysListOutput = mtMap.object<ApiKeysListOutput>({
  items: mtMap.objectField(
    'items',
    mtMap.array(
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        secretRedacted: mtMap.objectField(
          'secret_redacted',
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
            lastUsedAt: mtMap.objectField('last_used_at', mtMap.date()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date()),
            deletedAt: mtMap.objectField('deleted_at', mtMap.date()),
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
                teams: mtMap.objectField(
                  'teams',
                  mtMap.array(
                    mtMap.object({
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      slug: mtMap.objectField('slug', mtMap.passthrough()),
                      assignmentId: mtMap.objectField(
                        'assignment_id',
                        mtMap.passthrough()
                      ),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
                  )
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            ),
            instance: mtMap.objectField(
              'instance',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                slug: mtMap.objectField('slug', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                organizationId: mtMap.objectField(
                  'organization_id',
                  mtMap.passthrough()
                ),
                type: mtMap.objectField('type', mtMap.passthrough()),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date()),
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
                )
              })
            ),
            organization: mtMap.objectField(
              'organization',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                slug: mtMap.objectField('slug', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
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
            )
          })
        ),
        deletedAt: mtMap.objectField('deleted_at', mtMap.date()),
        lastUsedAt: mtMap.objectField('last_used_at', mtMap.date()),
        expiresAt: mtMap.objectField('expires_at', mtMap.date()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    )
  ),
  pagination: mtMap.objectField(
    'pagination',
    mtMap.object({
      hasMoreBefore: mtMap.objectField('has_more_before', mtMap.passthrough()),
      hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
    })
  )
});

export type ApiKeysListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & (
  | { type: 'organization_management_token' }
  | { type: 'instance_access_token'; instanceId: string }
);

export let mapApiKeysListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      type: mtMap.objectField('type', mtMap.passthrough()),
      instanceId: mtMap.objectField('instance_id', mtMap.passthrough())
    })
  )
]);

