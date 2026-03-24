import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsServiceAccountsListOutput = {
  items: {
    object: 'machine_access.service_account';
    id: string;
    status: 'active' | 'archived';
    name: string;
    description: string | null;
    scopes: { identifier: string; name: string; description: string }[];
    clientId: string;
    clientSecrets: {
      object: 'machine_access.oauth_application_client_secret';
      id: string;
      preview: string;
      secret: string | null;
      createdAt: Date;
      deletedAt: Date | null;
    }[];
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsServiceAccountsListOutput =
  mtMap.object<DashboardOrganizationsServiceAccountsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
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
          clientId: mtMap.objectField('client_id', mtMap.passthrough()),
          clientSecrets: mtMap.objectField(
            'client_secrets',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                preview: mtMap.objectField('preview', mtMap.passthrough()),
                secret: mtMap.objectField('secret', mtMap.passthrough()),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                deletedAt: mtMap.objectField('deleted_at', mtMap.date())
              })
            )
          ),
          organizationId: mtMap.objectField(
            'organization_id',
            mtMap.passthrough()
          ),
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

export type DashboardOrganizationsServiceAccountsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { status?: 'active' | 'archived' | ('active' | 'archived')[] | undefined };

export let mapDashboardOrganizationsServiceAccountsListQuery = mtMap.union([
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

