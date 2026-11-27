import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { consumerProfileType } from '../../types';
import { v1ConsumerGroupPresenter } from './consumerGroup';
import { v1ConsumerSurfacePresenter } from './consumerSurface';

export let previewConsumerProfilePresenter = Presenter.create(consumerProfileType)
  .presenter(async ({ consumerProfile, instanceConsumer }) => ({
    object: 'consumer.profile' as const,
    id: consumerProfile.id,
    name: consumerProfile.name,
    email: consumerProfile.email,
    image_url: await getImageUrl(
      consumerProfile.consumer.user ?? {
        id: consumerProfile.consumer.id,
        name: consumerProfile.name,
        email: consumerProfile.email,
        image: null
      }
    ),
    consumer_id: instanceConsumer?.id ?? consumerProfile.consumer.id,
    user_id: consumerProfile.consumer.user?.id ?? null,
    status:
      consumerProfile.inviteStatus == 'invited' ? ('invited' as const) : ('active' as const),
    created_at: consumerProfile.createdAt,
    updated_at: consumerProfile.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.profile', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      name: v.string({ description: 'Display name.' }),
      email: v.string({ description: 'Email address.' }),
      image_url: v.string({ description: 'Avatar image URL.' }),
      consumer_id: v.string({ description: 'Consumer this profile belongs to.' }),
      user_id: v.nullable(
        v.string({ description: 'User this profile is linked to. `null` when unlinked.' })
      ),
      status: v.enumOf(['active', 'invited'], {
        description: '`invited` while the invitation is pending.'
      }),
      created_at: v.date({ description: 'Creation time.' }),
      updated_at: v.date({ description: 'Last update time.' })
    })
  )
  .build();

export let v1ConsumerProfilePresenter = Presenter.create(consumerProfileType)
  .presenter(async ({ consumerProfile, assignedConsumerGroups, instanceConsumer }, opts) => {
    let inner = await previewConsumerProfilePresenter
      .present({ consumerProfile, assignedConsumerGroups, instanceConsumer }, opts)
      .run();

    return {
      ...inner,
      groups: assignedConsumerGroups
        ? await Promise.all(
            assignedConsumerGroups.map(async group => ({
              object: 'consumer.profile.group_assignment' as const,
              group: await v1ConsumerGroupPresenter
                .present({ consumerGroup: group }, opts)
                .run(),
              assigned_via: group.assignedVia,
              sso_group_ids:
                group.assignedVia == 'sso'
                  ? group.ssoGroupIds.filter(id => consumerProfile.ssoGroupIds.includes(id))
                  : []
            }))
          )
        : null
    };
  })
  .schema(
    v.intersection([
      previewConsumerProfilePresenter.schema,
      v.object({
      groups: v.nullable(
        v.array(
          v.object(
            {
              object: v.literal('consumer.profile.group_assignment', {
                description: 'String representing the object’s type.'
              }),
              group: v1ConsumerGroupPresenter.schema,
              assigned_via: v.enumOf(['default', 'manual', 'sso', 'user'], {
                description: 'How the profile joined the group.'
              }),
              sso_group_ids: v.array(v.string(), {
                description:
                  'Identity provider group ids that placed this profile in the group. Empty unless assigned via SSO.'
              })
            },
            { description: 'Group the profile belongs to and how it joined.' }
          ),
          { description: 'Groups the profile belongs to. `null` when not loaded.' }
        )
      )
      })
    ])
  )
  .build();

export let dashboardConsumerProfilePresenter = Presenter.create(consumerProfileType)
  .presenter(async ({ consumerProfile, assignedConsumerGroups, instanceConsumer }, opts) => {
    let inner = await v1ConsumerProfilePresenter
      .present({ consumerProfile, assignedConsumerGroups, instanceConsumer }, opts)
      .run();

    return {
      ...inner,
      is_service_account: consumerProfile.consumer.isServiceAccount,
      organization_member: consumerProfile.organizationMember
        ? { id: consumerProfile.organizationMember.id }
        : null,
      surface: {
        ...(await v1ConsumerSurfacePresenter
          .present({ consumerSurface: consumerProfile.surface }, opts)
          .run()),
        type: consumerProfile.surface.type,
        portal_id: consumerProfile.surface.portal?.id ?? null
      }
    };
  })
  .schema(
    v.intersection([
      v1ConsumerProfilePresenter.schema,
      v.object({
        is_service_account: v.boolean({
          name: 'is_service_account',
          description: 'Whether this profile is the dedicated identity of a service account'
        }),
        organization_member: v.nullable(
          v.object({
            id: v.string({
              description: 'Identifier of the organization member linked to this profile.'
            })
          })
        ),
        surface: v.intersection([
          v1ConsumerSurfacePresenter.schema,
          v.object({
            type: v.enumOf(['portal', 'organization_members', 'cli'], {
              description: 'The context this consumer profile belongs to.'
            }),
            portal_id: v.nullable(
              v.string({
                description: 'The portal this profile belongs to, if any.'
              })
            )
          })
        ])
      })
    ])
  )
  .build();
