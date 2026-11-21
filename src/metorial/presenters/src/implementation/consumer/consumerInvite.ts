import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerInviteType } from '../../types';

export let v1ConsumerInvitePresenter = Presenter.create(consumerInviteType)
  .presenter(async ({ consumerInvite, portalUrl }, opts) => ({
    object: 'consumer.invite' as const,
    id: consumerInvite.id,
    status: consumerInvite.status,
    portal_url: consumerInvite.surface.portal ? portalUrl : null,
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
    message: consumerInvite.message,
    accepted_at: consumerInvite.acceptedAt,
    created_at: consumerInvite.createdAt,
    updated_at: consumerInvite.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.invite', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      status: v.enumOf(['pending', 'accepted'], {
        description: '`accepted` once the consumer joins.'
      }),
      portal_url: v.nullable(
        v.string({ description: 'Where the invited consumer signs up. `null` outside portals.' })
      ),
      consumer_profile: v.object(
        {
          object: v.literal('consumer.profile#preview', {
            description: 'String representing the object’s type.'
          }),
          id: v.string({ description: 'Unique ID.' }),
          name: v.string({ description: 'Display name.' }),
          email: v.string({ description: 'Email address of the consumer.' })
        },
        { description: 'Consumer the invite was sent to.' }
      ),
      invited_by: v.object(
        {
          object: v.literal('organization.actor#preview', {
            description: 'String representing the object’s type.'
          }),
          id: v.string({ description: 'Unique ID.' }),
          name: v.string({ description: 'Display name.' }),
          email: v.nullable(v.string({ description: 'Email address.' }))
        },
        { description: 'Organization member who sent the invite.' }
      ),
      message: v.nullable(v.string({ description: 'Personal message included in the invite.' })),
      accepted_at: v.nullable(
        v.date({ description: 'When the invite was accepted. `null` while pending.' })
      ),
      created_at: v.date({ description: 'Creation time.' }),
      updated_at: v.date({ description: 'Last update time.' })
    })
  )
  .build();
