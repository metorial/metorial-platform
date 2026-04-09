import { mtMap } from '@metorial/util-resource-mapper';

export type PortalsConsumerInvitesGetOutput = {
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

export let mapPortalsConsumerInvitesGetOutput =
  mtMap.object<PortalsConsumerInvitesGetOutput>({
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
  });

