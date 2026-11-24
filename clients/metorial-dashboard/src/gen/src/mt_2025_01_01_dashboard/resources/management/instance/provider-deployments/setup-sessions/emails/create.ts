import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderDeploymentsSetupSessionsEmailsCreateOutput =
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

export let mapManagementInstanceProviderDeploymentsSetupSessionsEmailsCreateOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceProviderDeploymentsSetupSessionsEmailsCreateOutput>(
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

export type ManagementInstanceProviderDeploymentsSetupSessionsEmailsCreateBody =
  {
    emails?: string[] | undefined;
    organizationMemberIds?: string[] | undefined;
  };

export let mapManagementInstanceProviderDeploymentsSetupSessionsEmailsCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderDeploymentsSetupSessionsEmailsCreateBody>(
    ['organization_member_ids']
  );
