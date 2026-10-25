import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderDeploymentsSetupSessionsEmailsListOutput =
  {
    items: ({
      object: 'provider.setup_session.email';
      id: string;
      deduplicated: boolean;
      setupSessionId: string;
      recipientEmail: string | null;
      organizationMemberId: string | null;
      createdAt: Date;
    } & {
      sender: { organizationActorId: string | null; name: string } | null;
    })[];
    pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
  };

export let mapDashboardInstanceProviderDeploymentsSetupSessionsEmailsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderDeploymentsSetupSessionsEmailsListOutput>(
    [
      7,
      [
        3,
        [
          [
            0,
            [
              1,
              [
                'setup_session_id',
                'recipient_email',
                'organization_member_id',
                'created_at',
                ['sender', 0, [1, ['organization_actor_id']]]
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type DashboardInstanceProviderDeploymentsSetupSessionsEmailsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceProviderDeploymentsSetupSessionsEmailsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceProviderDeploymentsSetupSessionsEmailsListQuery>(
    0
  );
