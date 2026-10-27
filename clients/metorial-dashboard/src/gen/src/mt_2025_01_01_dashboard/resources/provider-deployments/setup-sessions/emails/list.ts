import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProviderDeploymentsSetupSessionsEmailsListOutput = {
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

export let mapProviderDeploymentsSetupSessionsEmailsListOutput =
  /* @__PURE__ */ createMapper<ProviderDeploymentsSetupSessionsEmailsListOutput>(
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

export type ProviderDeploymentsSetupSessionsEmailsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapProviderDeploymentsSetupSessionsEmailsListQuery =
  /* @__PURE__ */ createMapper<ProviderDeploymentsSetupSessionsEmailsListQuery>(
    0
  );
