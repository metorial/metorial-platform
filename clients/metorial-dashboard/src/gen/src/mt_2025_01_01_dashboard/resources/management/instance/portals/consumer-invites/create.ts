import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstancePortalsConsumerInvitesCreateOutput = {
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

export let mapManagementInstancePortalsConsumerInvitesCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstancePortalsConsumerInvitesCreateOutput>(
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

export type ManagementInstancePortalsConsumerInvitesCreateBody = {
  name: string;
  email: string;
  message?: string | undefined;
};

export let mapManagementInstancePortalsConsumerInvitesCreateBody =
  /* @__PURE__ */ createMapper<ManagementInstancePortalsConsumerInvitesCreateBody>(
    0
  );
