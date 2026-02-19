import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCustomProvidersVersionsListOutput = {
  items: {
    object: 'custom_provider.version';
    id: string;
    status: string | null;
    index: number | null;
    identifier: string | null;
    deployment: {
      object: 'custom_provider.deployment';
      id: string;
      status: string | null;
      trigger: string | null;
      customProviderId: string;
      providerId: string | null;
      customProviderVersionId: string | null;
      commit: {
        id: string;
        type: string | null;
        message: string | null;
        createdAt: Date;
      } | null;
      actor: {
        id: string;
        name: string | null;
        type: string | null;
        organizationActorId: string | null;
      } | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    environments: {
      object: 'custom_provider.environment';
      id: string;
      isCurrentVersionForEnvironment: boolean | null;
      environment: {
        object: 'custom_provider.environment';
        id: string;
        customProviderId: string;
        providerId: string | null;
        currentProviderVersionId: string | null;
        instanceId: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
    }[];
    customProviderId: string;
    providerId: string | null;
    actor: {
      id: string;
      name: string | null;
      type: string | null;
      organizationActorId: string | null;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceCustomProvidersVersionsListOutput =
  mtMap.object<DashboardInstanceCustomProvidersVersionsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          index: mtMap.objectField('index', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          deployment: mtMap.objectField(
            'deployment',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              trigger: mtMap.objectField('trigger', mtMap.passthrough()),
              customProviderId: mtMap.objectField('custom_provider_id', mtMap.passthrough()),
              providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
              customProviderVersionId: mtMap.objectField(
                'custom_provider_version_id',
                mtMap.passthrough()
              ),
              commit: mtMap.objectField(
                'commit',
                mtMap.object({
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  message: mtMap.objectField('message', mtMap.passthrough()),
                  createdAt: mtMap.objectField('created_at', mtMap.date())
                })
              ),
              actor: mtMap.objectField(
                'actor',
                mtMap.object({
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  organizationActorId: mtMap.objectField(
                    'organization_actor_id',
                    mtMap.passthrough()
                  )
                })
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          environments: mtMap.objectField(
            'environments',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                isCurrentVersionForEnvironment: mtMap.objectField(
                  'is_current_version_for_environment',
                  mtMap.passthrough()
                ),
                environment: mtMap.objectField(
                  'environment',
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    customProviderId: mtMap.objectField(
                      'custom_provider_id',
                      mtMap.passthrough()
                    ),
                    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
                    currentProviderVersionId: mtMap.objectField(
                      'current_provider_version_id',
                      mtMap.passthrough()
                    ),
                    instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                )
              })
            )
          ),
          customProviderId: mtMap.objectField('custom_provider_id', mtMap.passthrough()),
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          actor: mtMap.objectField(
            'actor',
            mtMap.object({
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              type: mtMap.objectField('type', mtMap.passthrough()),
              organizationActorId: mtMap.objectField(
                'organization_actor_id',
                mtMap.passthrough()
              )
            })
          ),
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

export type DashboardInstanceCustomProvidersVersionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?: string | string[] | undefined;
  ids?: string | string[] | undefined;
};

export let mapDashboardInstanceCustomProvidersVersionsListQuery = mtMap.union([
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
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      ids: mtMap.objectField(
        'ids',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      )
    })
  )
]);
