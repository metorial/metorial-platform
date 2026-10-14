import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancePortalsConsumerInvitesGetOutput = {
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
};

export let mapDashboardInstancePortalsConsumerInvitesGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstancePortalsConsumerInvitesGetOutput>(
    [
      'portal_url',
      'consumer_profile',
      'invited_by',
      'accepted_at',
      'created_at',
      'updated_at'
    ],
    1
  );
