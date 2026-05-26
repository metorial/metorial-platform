import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsKeyProvidersErrorsListOutput = {
  items: {
    object: 'key_provider_error';
    id: string;
    day: Date;
    operation:
      | 'create_system_provider'
      | 'validate_provider'
      | 'generate_data_key'
      | 'decrypt_data_key';
    code: string;
    count: number;
    sampleMessage: string | null;
    firstSeenAt: Date;
    lastSeenAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardProjectsKeyProvidersErrorsListOutput =
  mtMap.object<DashboardProjectsKeyProvidersErrorsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          day: mtMap.objectField('day', mtMap.date()),
          operation: mtMap.objectField('operation', mtMap.passthrough()),
          code: mtMap.objectField('code', mtMap.passthrough()),
          count: mtMap.objectField('count', mtMap.passthrough()),
          sampleMessage: mtMap.objectField(
            'sample_message',
            mtMap.passthrough()
          ),
          firstSeenAt: mtMap.objectField('first_seen_at', mtMap.date()),
          lastSeenAt: mtMap.objectField('last_seen_at', mtMap.date())
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

export type DashboardProjectsKeyProvidersErrorsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardProjectsKeyProvidersErrorsListQuery = mtMap.union([
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

