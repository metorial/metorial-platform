import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstancePortalsConsumerInvitesListOutput = {
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

export let mapManagementInstancePortalsConsumerInvitesListOutput =
  /* @__PURE__ */ createMapper<ManagementInstancePortalsConsumerInvitesListOutput>(
    [
      7,
      [
        1,
        [
          'portal_url',
          'consumer_profile',
          'invited_by',
          'accepted_at',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstancePortalsConsumerInvitesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  email?: string | string[] | undefined;
  status?: 'pending' | 'accepted' | ('pending' | 'accepted')[] | undefined;
};

export let mapManagementInstancePortalsConsumerInvitesListQuery =
  /* @__PURE__ */ createMapper<ManagementInstancePortalsConsumerInvitesListQuery>(
    0
  );
