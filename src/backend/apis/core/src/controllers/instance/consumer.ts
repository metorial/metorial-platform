import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  consumerProfileService,
  consumerService,
  consumerSurfaceService
} from '@metorial/module-consumer';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import {
  consumerAndProfilePresenter,
  consumerPresenter,
  consumerProfilePresenter
} from '../../presenters';

let getAssignedConsumerGroupsByProfileId = async (d: {
  consumerProfiles: Awaited<
    ReturnType<typeof consumerProfileService.getConsumerProfileById>
  >[];
}) => {
  let groupsByProfileId: Record<
    string,
    Awaited<ReturnType<typeof consumerProfileService.getGroupsForProfile>>
  > = {};
  let consumerProfilesBySurfaceId = new Map<string, typeof d.consumerProfiles>();

  for (let consumerProfile of d.consumerProfiles) {
    let current = consumerProfilesBySurfaceId.get(consumerProfile.surface.id) ?? [];
    current.push(consumerProfile);
    consumerProfilesBySurfaceId.set(consumerProfile.surface.id, current);
  }

  for (let consumerProfiles of consumerProfilesBySurfaceId.values()) {
    let assignedByProfileId = await consumerProfileService.getStoredGroupsForProfiles({
      consumerSurface: consumerProfiles[0].surface,
      consumerProfiles
    });

    Object.assign(groupsByProfileId, assignedByProfileId);
  }

  return groupsByProfileId;
};

export let consumerGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.consumerId) {
    throw new ServiceError(
      badRequestError({
        message: 'consumerId is required',
        description: 'The consumerId path parameter is required.'
      })
    );
  }

  let consumer = await consumerService.getConsumerById({
    instance: ctx.instance,
    consumerId: ctx.params.consumerId
  });

  return { consumer };
});

export let consumerProfileGroup = consumerGroup.use(async ctx => {
  if (!ctx.params.consumerProfileId) {
    throw new ServiceError(
      badRequestError({
        message: 'consumerProfileId is required',
        description: 'The consumerProfileId path parameter is required.'
      })
    );
  }

  let consumerProfile = await consumerProfileService.getConsumerProfileByIdForConsumer({
    consumer: ctx.consumer,
    consumerProfileId: ctx.params.consumerProfileId
  });

  return { consumerProfile };
});

export let consumerController = Controller.create(
  {
    name: 'Consumers',
    description:
      'Manage instance consumers independently from portals and inspect the profiles linked to each consumer.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('consumers', 'consumers.list'), {
        name: 'List consumers',
        description: 'Returns a paginated list of consumers for an instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .outputList(consumerPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await consumerService.listConsumers({
          instance: ctx.instance,
          search: ctx.query.search,
          id: ctx.query.id
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumer => consumerPresenter.present({ consumer }));
      }),

    get: consumerGroup
      .get(instancePath('consumers/:consumerId', 'consumers.get'), {
        name: 'Get consumer',
        description: 'Retrieves a consumer by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(consumerPresenter)
      .do(async ctx => consumerPresenter.present({ consumer: ctx.consumer })),

    create: instanceGroup
      .post(instancePath('consumers', 'consumers.create'), {
        name: 'Create consumer',
        description: 'Creates or links a consumer for an instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .body(
        'default',
        v.object({
          name: v.string(),
          email: v.string({ modifiers: [v.email()] })
        })
      )
      .output(consumerPresenter)
      .do(async ctx => {
        let consumer = await consumerService.createConsumer({
          organization: ctx.organization,
          instance: ctx.instance,
          input: {
            name: ctx.body.name,
            email: ctx.body.email
          }
        });

        return consumerPresenter.present({ consumer });
      }),

    getMemberConsumer: instanceGroup
      .post(instancePath('get-member-consumer', 'consumers.getMemberConsumer'), {
        name: 'Get member consumer',
        description:
          'Upserts and returns the consumer for the authenticated organization member.',
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .body(
        'default',
        v.object({
          surface_identifier: v.optional(v.enumOf(['cli']))
        })
      )
      .output(consumerAndProfilePresenter)
      .do(async ctx => {
        let user =
          ctx.auth.type === 'user' || ctx.auth.type === 'machine' ? ctx.auth.user : undefined;
        if (!ctx.member || !user) {
          throw new ServiceError(
            forbiddenError({
              message:
                'This endpoint requires an authenticated organization member and is not available for API access.'
            })
          );
        }

        if (
          ctx.auth.type === 'machine' &&
          ctx.auth.oauthToken?.oauthAuthorization.oauthApplication.type === 'cli_auth' &&
          !ctx.body.surface_identifier
        ) {
          ctx.body.surface_identifier = 'cli';
        }

        if (!ctx.body.surface_identifier) {
          throw new ServiceError(
            badRequestError({
              message: 'surface_identifier is required',
              description: 'The surface_identifier field is required in the request body.'
            })
          );
        }

        let consumerSurface = await consumerSurfaceService.ensureInternalConsumerSurface({
          instance: ctx.instance,
          identifier: ctx.body.surface_identifier,
          name: 'CLI'
        });

        let consumerProfile = await consumerProfileService.ensureConsumerProfile({
          surface: consumerSurface,
          email: user.email,
          name: user.name,
          member: ctx.member
        });

        let consumer = await consumerService.getConsumerById({
          instance: ctx.instance,
          consumerId: consumerProfile.consumer.id
        });

        let assignedConsumerGroups = await consumerProfileService.getGroupsForProfile({
          consumerProfile
        });

        return consumerAndProfilePresenter.present({
          consumer,
          consumerProfile,
          assignedConsumerGroups
        });
      }),

    update: consumerGroup
      .patch(instancePath('consumers/:consumerId', 'consumers.update'), {
        name: 'Update consumer',
        description: 'Updates a consumer for an instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          email: v.optional(v.string({ modifiers: [v.email()] }))
        })
      )
      .output(consumerPresenter)
      .do(async ctx => {
        let consumer = await consumerService.updateConsumer({
          consumer: ctx.consumer,
          input: {
            name: ctx.body.name,
            email: ctx.body.email
          }
        });

        return consumerPresenter.present({ consumer });
      }),

    listProfiles: consumerGroup
      .get(instancePath('consumers/:consumerId/profiles', 'consumers.profiles.list'), {
        name: 'List consumer profiles',
        description: 'Returns a paginated list of profiles for a consumer in an instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .outputList(consumerProfilePresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await consumerProfileService.listConsumerProfilesForConsumer({
          consumer: ctx.consumer
        });
        let list = await paginator.run(ctx.query);
        let assignedConsumerGroupsByProfileId = await getAssignedConsumerGroupsByProfileId({
          consumerProfiles: list.items
        });

        return Paginator.present(list, consumerProfile =>
          consumerProfilePresenter.present({
            consumerProfile,
            assignedConsumerGroups: assignedConsumerGroupsByProfileId[consumerProfile.id] ?? []
          })
        );
      }),

    getProfile: consumerProfileGroup
      .get(
        instancePath(
          'consumers/:consumerId/profiles/:consumerProfileId',
          'consumers.profiles.get'
        ),
        {
          name: 'Get consumer profile',
          description: 'Retrieves a consumer profile by ID for a consumer.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(consumerProfilePresenter)
      .do(async ctx => {
        let assignedConsumerGroups = await consumerProfileService.getGroupsForProfile({
          consumerProfile: ctx.consumerProfile
        });

        return consumerProfilePresenter.present({
          consumerProfile: ctx.consumerProfile,
          assignedConsumerGroups
        });
      })
  }
);
