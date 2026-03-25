import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsAccessPoliciesVersionsOutput = {
  items: {
    object: 'management.access_policy_version';
    id: string;
    accessPolicyId: string;
    index: number;
    message: string | null;
    document: {
      access: {
        target: string;
        scopes?: string[] | undefined;
        roles?: string[] | undefined;
      }[];
    };
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsAccessPoliciesVersionsOutput =
  mtMap.object<DashboardOrganizationsAccessPoliciesVersionsOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          accessPolicyId: mtMap.objectField(
            'access_policy_id',
            mtMap.passthrough()
          ),
          index: mtMap.objectField('index', mtMap.passthrough()),
          message: mtMap.objectField('message', mtMap.passthrough()),
          document: mtMap.objectField(
            'document',
            mtMap.object({
              access: mtMap.objectField(
                'access',
                mtMap.array(
                  mtMap.object({
                    target: mtMap.objectField('target', mtMap.passthrough()),
                    scopes: mtMap.objectField(
                      'scopes',
                      mtMap.array(mtMap.passthrough())
                    ),
                    roles: mtMap.objectField(
                      'roles',
                      mtMap.array(mtMap.passthrough())
                    )
                  })
                )
              )
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date())
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

export type DashboardOrganizationsAccessPoliciesVersionsQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardOrganizationsAccessPoliciesVersionsQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

