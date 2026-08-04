import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { portalService } from '@metorial/module-consumer';
import { Presenter } from '@metorial/presenter';
import { bootType } from '../../types';
import { v1InstancePresenter } from '../organization/instance';
import { v1OrganizationPresenter } from '../organization/organization';
import { v1OrganizationMemberPresenter } from '../organization/organizationMember';
import { v1ProjectPresenter } from '../organization/project';
import { v1UserPresenter } from '../organization/user';

export let v1BootPresenter = Presenter.create(bootType)
  .presenter(async ({ user, organizations, instances, projects, consumers }, opts) => ({
    object: 'metorial.boot',

    user: await v1UserPresenter.present({ user }, opts).run(),
    organizations: await Promise.all(
      organizations.map(async organization => ({
        ...(await v1OrganizationPresenter.present({ organization }, opts).run()),
        member: organization.member
          ? await v1OrganizationMemberPresenter
              .present(
                { organizationMember: { ...organization.member, user, organization } },
                opts
              )
              .run()
          : null
      }))
    ),
    projects: await Promise.all(
      projects.map(async project => ({
        ...(await v1ProjectPresenter.present({ project }, opts).run()),
        organization: await v1OrganizationPresenter
          .present({ organization: project.organization }, opts)
          .run()
      }))
    ),
    instances: await Promise.all(
      instances.map(async instance => ({
        ...(await v1InstancePresenter.present({ instance }, opts).run()),
        organization: await v1OrganizationPresenter
          .present({ organization: instance.organization }, opts)
          .run()
      }))
    ),

    consumers: await Promise.all(
      consumers.map(async consumer => ({
        object: 'consumer#boot' as const,

        id: consumer.id,
        name: consumer.name,
        email: consumer.email,
        isOrganizationMember: consumer.isOrganizationMember,
        isPortalConsumer: consumer.isPortalConsumer,
        isManuallyCreated: consumer.isManuallyCreated,
        isPending: consumer.isPending,
        createdAt: consumer.createdAt,
        updatedAt: consumer.updatedAt,

        profiles: await Promise.all(
          consumer.profiles.map(async profile => ({
            profile: {
              object: 'consumer.profile#boot' as const,
              id: profile.id,
              name: profile.name,
              email: profile.email,
              image_url: await getImageUrl({
                id: consumer.id,
                name: profile.name,
                email: profile.email,
                image: null
              }),
              consumer_id: consumer.id,
              status:
                profile.inviteStatus == 'invited' ? ('invited' as const) : ('active' as const),
              created_at: profile.createdAt,
              updated_at: profile.updatedAt
            },

            surface: {
              object: 'consumer.surface' as const,
              id: profile.surface.id,
              status: profile.surface.status,
              name: profile.surface.name,
              description: profile.surface.description,

              created_at: profile.surface.createdAt,
              updated_at: profile.surface.updatedAt
            },

            portal: profile.surface.portal
              ? {
                  object: 'portal' as const,

                  id: profile.surface.portal.id,
                  status: profile.surface.portal.status,
                  name: profile.surface.portal.name,
                  slug: profile.surface.portal.slug,
                  description: profile.surface.portal.description,

                  urls: [
                    {
                      type: 'default' as const,
                      url: (
                        await portalService.getPortalHost({
                          portal: profile.surface.portal
                        })
                      ).host
                    }
                  ],

                  created_at: profile.surface.portal.createdAt,
                  updated_at: profile.surface.portal.updatedAt
                }
              : null
          }))
        )
      }))
    )
  }))
  .schema(
    v.object({
      object: v.literal('metorial.boot', {
        description: "String representing the object's type"
      }),

      user: v1UserPresenter.schema,
      organizations: v.array(
        v.intersection([
          v1OrganizationPresenter.schema,
          v.object({
            member: v1OrganizationMemberPresenter.schema
          })
        ]),
        {
          name: 'organizations',
          description: `The user's organizations`
        }
      ),
      projects: v.array(
        v.intersection([
          v1ProjectPresenter.schema,
          v.object({
            organization: v1OrganizationPresenter.schema
          })
        ]),
        {
          name: 'projects',
          description: `The user's projects`
        }
      ),
      instances: v.array(
        v.intersection([
          v1InstancePresenter.schema,
          v.object({
            organization: v1OrganizationPresenter.schema
          })
        ]),
        {
          name: 'instances',
          description: `The user's instances`
        }
      ),

      consumers: v.array(
        v.object({
          object: v.literal('consumer#boot'),
          id: v.string(),
          name: v.string(),
          email: v.string(),
          isOrganizationMember: v.boolean(),
          isPortalConsumer: v.boolean(),
          isManuallyCreated: v.boolean(),
          isPending: v.boolean(),
          createdAt: v.date(),
          updatedAt: v.date(),

          profiles: v.array(
            v.object({
              profile: v.object({
                object: v.literal('consumer.profile#boot'),
                id: v.string(),
                name: v.string(),
                email: v.string(),
                image_url: v.string(),
                consumer_id: v.string(),
                status: v.enumOf(['active', 'invited']),
                created_at: v.date(),
                updated_at: v.date()
              }),

              surface: v.object({
                object: v.literal('consumer.surface'),
                id: v.string(),
                status: v.enumOf(['active', 'archived', 'deleted']),
                name: v.string(),
                description: v.nullable(v.string()),
                created_at: v.date(),
                updated_at: v.date()
              }),

              portal: v.nullable(
                v.object({
                  object: v.literal('portal'),
                  id: v.string(),
                  status: v.enumOf(['active', 'archived', 'deleted']),
                  name: v.string(),
                  slug: v.string(),
                  description: v.nullable(v.string()),
                  urls: v.array(
                    v.object({
                      type: v.enumOf(['default']),
                      url: v.string()
                    })
                  ),
                  created_at: v.date(),
                  updated_at: v.date()
                })
              )
            })
          )
        })
      )
    })
  )
  .build();
