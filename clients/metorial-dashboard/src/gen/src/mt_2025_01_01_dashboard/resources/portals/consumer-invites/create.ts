import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type PortalsConsumerInvitesCreateOutput = {
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

export let mapPortalsConsumerInvitesCreateOutput =
  /* @__PURE__ */ mapObject<PortalsConsumerInvitesCreateOutput>(
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

export type PortalsConsumerInvitesCreateBody = {
  name: string;
  email: string;
  message?: string | undefined;
};

export let mapPortalsConsumerInvitesCreateBody =
  /* @__PURE__ */ createMapper<PortalsConsumerInvitesCreateBody>(0);
