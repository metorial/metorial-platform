import { consumerProfileService } from '@metorial/module-consumer';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { consumerProfilePresenter } from '../../presenters';
import { portalGroup } from './portal';

export let consumerProfileGroup = portalGroup.use(async ctx => {
  if (!ctx.params.consumerProfileId) throw new Error('consumerProfileId is required');

  let consumerProfile = await consumerProfileService.getConsumerProfileById({
    consumerSurface: ctx.portal.surface,
    consumerProfileId: ctx.params.consumerProfileId
  });

  return { consumerProfile };
});

export let portalConsumerProfileController = Controller.create(
  {
    name: 'Portal Consumer Groups',
    description: 'Connect Magic MCP Groups to Portals to control access to your marketplaces.'
  },
  {
    list: portalGroup
      .get(
        instancePath('portals/:portalId/consumer-profile', 'portals.consumerProfiles.list'),
        {
          name: 'List Portal',
          description: 'Returns a paginated list of portals.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.consumers:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .outputList(consumerProfilePresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await consumerProfileService.listConsumerProfiles({
          consumerSurface: ctx.portal.surface
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerProfile =>
          consumerProfilePresenter.present({
            consumerProfile,
            assignedConsumerGroups: undefined
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
          name: 'Get Portal Consumer Group by ID',
          description: 'Retrieves details for a specific portal by its ID.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.consumers:read']
        })
      )
      .use(hasFlags(['paid-portals']))
      .output(consumerProfilePresenter)
      .do(async ctx => {
        let assignedConsumerGroups = await consumerProfileService.getGroupsForProfile({
          consumerProfile: ctx.consumerProfile
        });

        return consumerProfilePresenter.present({
          consumerProfile: ctx.consumerProfile,
          assignedConsumerGroups
        });
      }),

    assignGroups: consumerProfileGroup
      .post(
        instancePath(
          'portals/:portalId/consumer-profile/:consumerProfileId/assign-groups',
          'portals.consumerProfiles.assignGroups'
        ),
        {
          name: 'Create Portal Consumer Group',
          description: 'Creates a new sso tenant for the instance.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.consumers:write']
        })
      )
      .use(hasFlags(['paid-portals']))
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

        return consumerProfilePresenter.present({ consumerProfile, assignedConsumerGroups });
      }),

    unassignGroups: consumerProfileGroup
      .post(
        instancePath(
          'portals/:portalId/consumer-profile/:consumerProfileId/unassign-groups',
          'portals.consumerProfiles.unassignGroups'
        ),
        {
          name: 'Remove Portal Consumer Profile from Group',
          description: 'Removes a consumer profile from a consumer group.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.portal.consumers:write']
        })
      )
      .use(hasFlags(['paid-portals']))
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

        return consumerProfilePresenter.present({ consumerProfile, assignedConsumerGroups });
      })
  }
);
