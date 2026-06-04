import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderSpecificationChangeNotificationsListOutput =
  {
    items: {
      object: 'provider.specification_change_notification';
      id: string;
      providerId: string;
      providerVersionId: string;
      fromSpecification: {
        object: 'provider.capabilities.specification#preview';
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      toSpecification: {
        object: 'provider.capabilities.specification#preview';
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      fromProviderVersion: {
        object: 'provider.version#preview';
        id: string;
        version: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      toProviderVersion: {
        object: 'provider.version#preview';
        id: string;
        version: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      createdAt: Date;
    }[];
    pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
  };

export let mapManagementInstanceProviderSpecificationChangeNotificationsListOutput =
  mtMap.object<ManagementInstanceProviderSpecificationChangeNotificationsListOutput>(
    {
      items: mtMap.objectField(
        'items',
        mtMap.array(
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
            providerVersionId: mtMap.objectField(
              'provider_version_id',
              mtMap.passthrough()
            ),
            fromSpecification: mtMap.objectField(
              'from_specification',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            ),
            toSpecification: mtMap.objectField(
              'to_specification',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            ),
            fromProviderVersion: mtMap.objectField(
              'from_provider_version',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                version: mtMap.objectField('version', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            ),
            toProviderVersion: mtMap.objectField(
              'to_provider_version',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                version: mtMap.objectField('version', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
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
    }
  );

export type ManagementInstanceProviderSpecificationChangeNotificationsListQuery =
  {
    limit?: number | undefined;
    after?: string | undefined;
    before?: string | undefined;
    cursor?: string | undefined;
    order?: 'asc' | 'desc' | undefined;
  } & {
    id?: string | string[] | undefined;
    target?:
      | 'version'
      | 'deployment_config_pair'
      | ('version' | 'deployment_config_pair')[]
      | undefined;
    providerId?: string | string[] | undefined;
    providerVersionId?: string | string[] | undefined;
    providerSpecificationId?: string | string[] | undefined;
    createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  };

export let mapManagementInstanceProviderSpecificationChangeNotificationsListQuery =
  mtMap.union([
    mtMap.unionOption(
      'object',
      mtMap.object({
        limit: mtMap.objectField('limit', mtMap.passthrough()),
        after: mtMap.objectField('after', mtMap.passthrough()),
        before: mtMap.objectField('before', mtMap.passthrough()),
        cursor: mtMap.objectField('cursor', mtMap.passthrough()),
        order: mtMap.objectField('order', mtMap.passthrough()),
        id: mtMap.objectField(
          'id',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        ),
        target: mtMap.objectField(
          'target',
          mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
        ),
        providerId: mtMap.objectField(
          'provider_id',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        ),
        providerVersionId: mtMap.objectField(
          'provider_version_id',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        ),
        providerSpecificationId: mtMap.objectField(
          'provider_specification_id',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        ),
        createdAt: mtMap.objectField(
          'created_at',
          mtMap.object({
            gt: mtMap.objectField('gt', mtMap.date()),
            lt: mtMap.objectField('lt', mtMap.date())
          })
        )
      })
    )
  ]);

