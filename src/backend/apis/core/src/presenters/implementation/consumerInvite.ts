import { v } from '@lowerdeck/validation';
import { portalService } from '@metorial/module-portal';
import { Presenter } from '@metorial/presenter';
import { consumerInviteType } from '../types';

export let v1ConsumerInvitePresenter = Presenter.create(consumerInviteType)
  .presenter(async ({ consumerInvite }, opts) => ({
    object: 'consumer.invite' as const,
    id: consumerInvite.id,
    status: consumerInvite.status,
    portal_url: consumerInvite.surface.portal
      ? portalService.getPortalHost({ portal: consumerInvite.surface.portal }).host
      : null,
    consumer_profile: {
      object: 'consumer.profile#preview' as const,
      id: consumerInvite.consumerProfile.id,
      name: consumerInvite.consumerProfile.name,
      email: consumerInvite.consumerProfile.email
    },
    invited_by: {
      object: 'organization.actor#preview' as const,
      id: consumerInvite.invitedBy.id,
      name: consumerInvite.invitedBy.name,
      email: consumerInvite.invitedBy.email
    },
    accepted_at: consumerInvite.acceptedAt,
    created_at: consumerInvite.createdAt,
    updated_at: consumerInvite.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.invite'),
      id: v.string(),
      status: v.enumOf(['pending', 'accepted']),
      portal_url: v.nullable(v.string()),
      consumer_profile: v.object({
        object: v.literal('consumer.profile#preview'),
        id: v.string(),
        name: v.string(),
        email: v.string()
      }),
      invited_by: v.object({
        object: v.literal('organization.actor#preview'),
        id: v.string(),
        name: v.string(),
        email: v.nullable(v.string())
      }),
      accepted_at: v.nullable(v.date()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
