import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationServiceAccountsCredentialsListOutput = {
  items: {
    object: 'machine_access.service_account_credential';
    id: string;
    status: 'active' | 'revoked';
    serviceAccountId: string;
    scopes: { identifier: string; name: string; description: string }[];
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
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationServiceAccountsCredentialsListOutput =
  mtMap.object<ManagementOrganizationServiceAccountsCredentialsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          serviceAccountId: mtMap.objectField(
            'service_account_id',
            mtMap.passthrough()
          ),
          scopes: mtMap.objectField(
            'scopes',
            mtMap.array(
              mtMap.object({
                identifier: mtMap.objectField(
                  'identifier',
                  mtMap.passthrough()
                ),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                )
              })
            )
          ),
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
                        createdAt: mtMap.objectField(
                          'created_at',
                          mtMap.date()
                        ),
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
                  firstName: mtMap.objectField(
                    'first_name',
                    mtMap.passthrough()
                  ),
                  lastName: mtMap.objectField('last_name', mtMap.passthrough()),
                  imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              )
            })
          ),
          lastUsedAt: mtMap.objectField('last_used_at', mtMap.date()),
          revokedAt: mtMap.objectField('revoked_at', mtMap.date()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type ManagementOrganizationServiceAccountsCredentialsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { status?: 'active' | 'revoked' | ('active' | 'revoked')[] | undefined };

export let mapManagementOrganizationServiceAccountsCredentialsListQuery =
  mtMap.union([
    mtMap.unionOption(
      'object',
      mtMap.object({
        limit: mtMap.objectField('limit', mtMap.passthrough()),
        after: mtMap.objectField('after', mtMap.passthrough()),
        before: mtMap.objectField('before', mtMap.passthrough()),
        cursor: mtMap.objectField('cursor', mtMap.passthrough()),
        order: mtMap.objectField('order', mtMap.passthrough()),
        status: mtMap.objectField(
          'status',
          mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
        )
      })
    )
  ]);

