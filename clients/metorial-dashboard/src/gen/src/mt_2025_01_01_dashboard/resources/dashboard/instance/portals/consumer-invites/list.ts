import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstancePortalsConsumerInvitesListOutput = {
  items: {
    object: 'consumer.invite';
    id: string;
    status: 'pending' | 'accepted';
    portalUrl: string | null;
    consumerProfile: {
      object: 'consumer.profile#preview';
      id: string;
      name: string;
      email: string;
    };
    invitedBy: {
      object: 'organization.actor#preview';
      id: string;
      name: string;
      email: string | null;
    };
    message: string | null;
    acceptedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstancePortalsConsumerInvitesListOutput =
  mtMap.object<DashboardInstancePortalsConsumerInvitesListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          portalUrl: mtMap.objectField('portal_url', mtMap.passthrough()),
          consumerProfile: mtMap.objectField(
            'consumer_profile',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              email: mtMap.objectField('email', mtMap.passthrough())
            })
          ),
          invitedBy: mtMap.objectField(
            'invited_by',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              email: mtMap.objectField('email', mtMap.passthrough())
            })
          ),
          message: mtMap.objectField('message', mtMap.passthrough()),
          acceptedAt: mtMap.objectField('accepted_at', mtMap.date()),
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

export type DashboardInstancePortalsConsumerInvitesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  status?: 'pending' | 'accepted' | ('pending' | 'accepted')[] | undefined;
};

export let mapDashboardInstancePortalsConsumerInvitesListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      search: mtMap.objectField('search', mtMap.passthrough()),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      )
    })
  )
]);

