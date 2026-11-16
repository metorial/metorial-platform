import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { introspectType, v } from '@lowerdeck/validation';
import type { AuditScope } from '@metorial/audit-scope';
import type { Instance, OrganizationMember, User } from '@metorial/db';
import { accessService } from '@metorial/module-access';
import { consumerAccessService } from '@metorial/module-consumer-access';
import { consumerActorService } from '@metorial/module-consumer-entities';
import { oauthAuthorizationService } from '@metorial/module-machine-access';
import { providerTemplateService } from '@metorial/module-magic';
import { integrationService } from '@metorial-subspace/module-integration';
import {
  consumerProfileService,
  consumerService,
  consumerSurfaceService
} from '@metorial/module-consumer-core';
import {
  consumerAndProfilePresenter,
  consumerPresenter,
  consumerProfilePresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';

let ensureMemberCliConsumer = async (d: {
  instance: Instance;
  member: OrganizationMember;
  user: User;
  auditScope: AuditScope;
}) => {
  let surface = await consumerSurfaceService.ensureInternalConsumerSurface({
    instance: d.instance,
    identifier: 'cli',
    name: 'Metorial CLI',
    type: 'cli'
  });
  return await consumerProfileService.ensureConsumerProfile({
    surface,
    email: d.user.email,
    name: d.user.name,
    member: d.member,
    user: d.user,
    auditScope: d.auditScope
  });
};

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
      .use(hasFlags(['paid-identity']))
      .outputList(consumerPresenter)
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
            id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await consumerService.listConsumers({
          instance: ctx.instance,
          search: ctx.query.search,
          emails: normalizeArrayParam(ctx.query.email),
          ids: normalizeArrayParam(ctx.query.id)
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
      .use(hasFlags(['paid-identity']))
      .output(consumerPresenter)
      .do(async ctx => consumerPresenter.present({ consumer: ctx.consumer })),

    create: instanceGroup
      .post(instancePath('consumers', 'consumers.create'), {
        name: 'Create consumer',
        description: 'Creates or links a consumer for an instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:write'] }))
      .use(hasFlags(['paid-identity']))
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
          auditScope: ctx.auditScope,
          flags: {
            isManuallyCreated: true
          },
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
      .use(hasFlags(['paid-identity']))
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

        if (ctx.auth.type === 'user' && user.type === 'system') {
          throw new ServiceError(
            forbiddenError({
              message: 'System users cannot use this endpoint',
              description:
                'The authenticated user is a system user and cannot use this endpoint.'
            })
          );
        }

        let consumerProfile = await ensureMemberCliConsumer({
          instance: ctx.instance,
          member: ctx.member,
          user,
          auditScope: ctx.auditScope
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

    createMemberSession: instanceGroup
      .post(instancePath('member-consumer-session', 'consumers.createMemberSession'), {
        name: 'Create member consumer session',
        description:
          'Exchanges a CLI sign-in for a short-lived credential for the member’s own consumer profile.',
        confidential: true,
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .use(hasFlags(['paid-identity', 'paid-integrations', 'magic-mcp-enabled']))
      .body('default', v.object({ integration_id: v.optional(v.string()) }))
      .output({
        introspect: () => ({
          name: 'member_consumer_session',
          object: introspectType(
            v.object({
              access_token: v.string(),
              catalog_item_id: v.optional(v.string())
            })
          )
        })
      })
      .do(async ctx => {
        let source = ctx.auth.type === 'machine' ? ctx.auth.oauthToken : undefined;
        let user = ctx.auth.type === 'machine' ? ctx.auth.user : undefined;
        let member = ctx.member;
        if (
          source?.oauthAuthorization.oauthApplication.type !== 'cli_auth' ||
          source.oauthAuthorization.subjectType !== 'organization_member' ||
          !member ||
          member.status !== 'active' ||
          source.oauthAuthorization.organizationMemberOid !== member.oid ||
          !user ||
          user.type === 'system' ||
          user.status !== 'active'
        ) {
          throw new ServiceError(
            forbiddenError({
              message: 'Sign in with metorial-admin as a member of a claimed organization.'
            })
          );
        }

        let integration;
        if (ctx.body.integration_id) {
          let possibleScopes = ['instance.provider.deployment:write' as const];
          await accessService.checkAccess({ authInfo: ctx.auth, possibleScopes });
          await accessService.checkTargetAccess({
            authInfo: ctx.auth,
            organization: ctx.organization,
            member,
            project: ctx.project,
            instance: ctx.instance,
            possibleScopes
          });
          integration = await integrationService.getIntegrationById({
            instance: ctx.instance,
            integrationId: ctx.body.integration_id
          });
        }

        let consumerProfile = await ensureMemberCliConsumer({
          instance: ctx.instance,
          member,
          user,
          auditScope: ctx.auditScope
        });
        await consumerActorService.ensureDefaultConsumerActor({
          instance: ctx.instance,
          consumerProfile
        });

        let catalogItemId: string | undefined;
        if (integration) {
          let providerTemplate = await providerTemplateService.createProviderTemplate({
            organization: ctx.organization,
            instance: ctx.instance,
            auditScope: ctx.auditScope,
            input: { integrationId: integration.id, name: integration.name }
          });
          await consumerAccessService.createConsumerAccess({
            organization: ctx.organization,
            consumerSurface: consumerProfile.surface,
            consumerGroup: consumerProfile.personalConsumerGroup,
            auditScope: ctx.auditScope,
            access: { type: 'provider_template', providerTemplate }
          });
          catalogItemId = providerTemplate.id;
        }

        let token = await oauthAuthorizationService.issueMemberCliConsumerToken({
          source,
          organization: ctx.organization,
          consumerProfile,
          user,
          context: ctx.context
        });
        return { access_token: token.accessToken, catalog_item_id: catalogItemId };
      }),

    update: consumerGroup
      .patch(instancePath('consumers/:consumerId', 'consumers.update'), {
        name: 'Update consumer',
        description: 'Updates a consumer for an instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:write'] }))
      .use(hasFlags(['paid-identity']))
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
          auditScope: ctx.auditScope,
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
      .use(hasFlags(['paid-identity']))
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
            instanceConsumer: consumerProfile.instanceConsumer,
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
      .use(hasFlags(['paid-identity']))
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
      })
  }
);
