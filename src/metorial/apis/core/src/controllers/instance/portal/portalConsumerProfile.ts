import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerProfileService } from '@metorial/module-consumer';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { consumerProfilePresenter } from '@metorial/presenters';
import { portalGroup } from './portal';

export let consumerProfileGroup = portalGroup.use(async ctx => {
  if (!ctx.params.consumerProfileId) {
    throw new ServiceError(
      badRequestError({
        message: 'consumerProfileId is required',
        description: 'The consumerProfileId path parameter is required.'
      })
    );
  }

  let consumerProfile = ctx.consumerProfile
    ? await consumerProfileService.getConsumerProfileVisibleToConsumer({
        consumerSurface: ctx.portal.surface,
        consumerProfile: ctx.consumerProfile,
        consumerGroups: ctx.consumerGroups ?? [],
        consumerProfileId: ctx.params.consumerProfileId
      })
    : await consumerProfileService.getConsumerProfileById({
        consumerSurface: ctx.portal.surface,
        consumerProfileId: ctx.params.consumerProfileId
      });

  return { consumerProfile };
});

export let portalConsumerProfileController = Controller.create(
  {
    name: 'Portal Consumer Profiles',
    description: 'Manage the consumers and effective group assignments for a portal.'
  },
  {
    list: portalGroup
      .get(
        instancePath('portals/:portalId/consumer-profile', 'portals.consumerProfiles.list'),
        {
          name: 'List portal consumer profiles',
          description: 'Returns a paginated list of consumer profiles for a portal.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.consumers:read', 'consumer#instance.profile:read']
        })
      )
      .use(hasFlags(['paid-portals', 'portals-access']))
      .outputList(consumerProfilePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            email: v.optional(
              v.union([
                v.string({ modifiers: [v.email()] }),
                v.array(v.string({ modifiers: [v.email()] }))
              ])
            ),
            consumer_group_id: v.optional(v.string()),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'invited']),
                v.array(v.enumOf(['active', 'invited']))
              ])
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = ctx.consumerProfile
          ? await consumerProfileService.listConsumerProfilesVisibleToConsumer({
              consumerSurface: ctx.portal.surface,
              consumerProfile: ctx.consumerProfile,
              consumerGroups: ctx.consumerGroups ?? [],
              search: ctx.query.search,
              emails: normalizeArrayParam(ctx.query.email),
              consumerGroupId: ctx.query.consumer_group_id,
              statuses: normalizeArrayParam(ctx.query.status)
            })
          : await consumerProfileService.listConsumerProfiles({
              consumerSurface: ctx.portal.surface,
              search: ctx.query.search,
              emails: normalizeArrayParam(ctx.query.email),
              consumerGroupId: ctx.query.consumer_group_id,
              statuses: normalizeArrayParam(ctx.query.status)
            });
        let list = await paginator.run(ctx.query);
        let assignedConsumerGroupsByProfileId =
          await consumerProfileService.getStoredGroupsForProfiles({
            consumerSurface: ctx.portal.surface,
            consumerProfiles: list.items
          });

        return Paginator.present(list, consumerProfile =>
          consumerProfilePresenter.present({
            consumerProfile,
            instanceConsumer: consumerProfile.instanceConsumer,
            assignedConsumerGroups: assignedConsumerGroupsByProfileId[consumerProfile.id] ?? []
          })
        );
      }),

    get: consumerProfileGroup
      .get(
        instancePath(
          'portals/:portalId/consumer-profile/:consumerProfileId',
          'portals.consumerProfiles.get'
        ),
        {
          name: 'Get portal consumer profile',
          description: 'Retrieves a portal consumer profile by ID.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.consumers:read', 'consumer#instance.profile:read']
        })
      )
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerProfilePresenter)
      .do(async ctx => {
        let assignedConsumerGroups = await consumerProfileService.getGroupsForProfile({
          consumerProfile: ctx.consumerProfile
        });

        return consumerProfilePresenter.present({
          consumerProfile: ctx.consumerProfile,
          instanceConsumer: ctx.consumerProfile.instanceConsumer,
          assignedConsumerGroups
        });
      }),

    create: portalGroup
      .post(
        instancePath('portals/:portalId/consumer-profile', 'portals.consumerProfiles.create'),
        {
          name: 'Create portal consumer profile',
          description: 'Creates a new portal consumer profile.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          email: v.string({ modifiers: [v.email()] }),
          name: v.string()
        })
      )
      .output(consumerProfilePresenter)
      .do(async ctx => {
        let consumerProfile = await consumerProfileService.createConsumerProfile({
          surface: ctx.portal.surface,
          email: ctx.body.email,
          name: ctx.body.name
        });

        return consumerProfilePresenter.present({
          consumerProfile,
          instanceConsumer: consumerProfile.instanceConsumer,
          assignedConsumerGroups: []
        });
      }),

    delete: consumerProfileGroup
      .delete(
        instancePath(
          'portals/:portalId/consumer-profile/:consumerProfileId',
          'portals.consumerProfiles.delete'
        ),
        {
          name: 'Delete portal consumer profile',
          description: 'Soft-deletes a portal consumer profile.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerProfilePresenter)
      .do(async ctx => {
        let consumerProfile = await consumerProfileService.deleteConsumerProfile({
          consumerProfile: ctx.consumerProfile
        });

        return consumerProfilePresenter.present({
          consumerProfile,
          instanceConsumer: consumerProfile.instanceConsumer,
          assignedConsumerGroups: []
        });
      }),

    assignGroups: consumerProfileGroup
      .post(
        instancePath(
          'portals/:portalId/consumer-profile/:consumerProfileId/assign-groups',
          'portals.consumerProfiles.assignGroups'
        ),
        {
          name: 'Assign portal consumer profile groups',
          description: 'Assigns one or more groups to a portal consumer profile.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          group_ids: v.array(v.string())
        })
      )
      .output(consumerProfilePresenter)
      .do(async ctx => {
        let consumerProfile = await consumerProfileService.assignToGroups({
          consumerProfile: ctx.consumerProfile,
          groupIds: ctx.body.group_ids
        });
        let assignedConsumerGroups = await consumerProfileService.getGroupsForProfile({
          consumerProfile: ctx.consumerProfile
        });

        return consumerProfilePresenter.present({
          consumerProfile,
          instanceConsumer: consumerProfile.instanceConsumer,
          assignedConsumerGroups
        });
      }),

    unassignGroups: consumerProfileGroup
      .post(
        instancePath(
          'portals/:portalId/consumer-profile/:consumerProfileId/unassign-groups',
          'portals.consumerProfiles.unassignGroups'
        ),
        {
          name: 'Unassign portal consumer profile groups',
          description: 'Removes one or more groups from a portal consumer profile.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          group_ids: v.array(v.string())
        })
      )
      .output(consumerProfilePresenter)
      .do(async ctx => {
        let consumerProfile = await consumerProfileService.removeFromGroups({
          consumerProfile: ctx.consumerProfile,
          groupIds: ctx.body.group_ids
        });
        let assignedConsumerGroups = await consumerProfileService.getGroupsForProfile({
          consumerProfile: ctx.consumerProfile
        });

        return consumerProfilePresenter.present({
          consumerProfile,
          instanceConsumer: consumerProfile.instanceConsumer,
          assignedConsumerGroups
        });
      })
  }
);
