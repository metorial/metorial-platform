import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceIdentityDelegationConfigService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { identityDelegationConfigPresenter } from '../../presenters';

let identityDelegationConfigGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.identityDelegationConfigId) {
    throw new ServiceError(
      badRequestError({
        message: 'identityDelegationConfigId is required',
        description: 'The identityDelegationConfigId path parameter is required.'
      })
    );
  }

  let identityDelegationConfig = await subspaceIdentityDelegationConfigService.get({
    instance: ctx.instance,
    identityDelegationConfigId: ctx.params.identityDelegationConfigId,
    allowDeleted: false
  });

  return { identityDelegationConfig };
});

export let identityDelegationConfigController = Controller.create(
  {
    name: 'Identity Delegation Configs',
    description:
      'Delegation configs define the default policy for sub-delegation behavior and delegation depth.'
  },
  {
    list: instanceGroup
      .get(instancePath('identity-delegation-configs', 'identities.delegationConfigs.list'), {
        name: 'List identity delegation configs',
        description: 'Returns a paginated list of identity delegation configs.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .outputList(identityDelegationConfigPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(
              v.string({
                description: 'Filter configs by name or description.',
                examples: ['default']
              })
            ),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ]),
              {
                description: 'Filter by one or more config statuses.'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by config ID or IDs.',
              examples: ['idc_2mNpQrStUvWxYzAb']
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceIdentityDelegationConfigService.list({
          instance: ctx.instance,
          allowDeleted: false,

          search: ctx.query.search,

          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, identityDelegationConfig =>
          identityDelegationConfigPresenter.present({ identityDelegationConfig })
        );
      }),

    get: identityDelegationConfigGroup
      .get(
        instancePath(
          'identity-delegation-configs/:identityDelegationConfigId',
          'identities.delegationConfigs.get'
        ),
        {
          name: 'Get identity delegation config',
          description: 'Retrieves a specific identity delegation config by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(identityDelegationConfigPresenter)
      .do(async ctx =>
        identityDelegationConfigPresenter.present({
          identityDelegationConfig: ctx.identityDelegationConfig
        })
      ),

    create: instanceGroup
      .post(
        instancePath('identity-delegation-configs', 'identities.delegationConfigs.create'),
        {
          name: 'Create identity delegation config',
          description: 'Creates a new identity delegation config.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description: 'Optional display name for the delegation config.',
              examples: ['Default External Sharing Policy']
            })
          ),
          description: v.optional(
            v.string({
              description: 'Optional description of the delegation policy.',
              examples: ['Allows one level of reviewed sub-delegation']
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Additional metadata to store on the delegation config.',
              examples: [{ team: 'security', policy_version: '2026-02' }]
            })
          ),
          sub_delegation_behavior: v.enumOf(['allow', 'deny', 'require_consent'], {
            description: 'How sub-delegations should be handled.'
          }),
          sub_delegation_depth: v.optional(
            v.number({
              description: 'Maximum allowed sub-delegation depth.',
              examples: [1]
            })
          )
        })
      )
      .output(identityDelegationConfigPresenter)
      .do(async ctx => {
        let identityDelegationConfig = await subspaceIdentityDelegationConfigService.create({
          instance: ctx.instance,

          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,

          subDelegationBehavior: ctx.body.sub_delegation_behavior,
          subDelegationDepth: ctx.body.sub_delegation_depth
        });

        return identityDelegationConfigPresenter.present({ identityDelegationConfig });
      }),

    update: identityDelegationConfigGroup
      .patch(
        instancePath(
          'identity-delegation-configs/:identityDelegationConfigId',
          'identities.delegationConfigs.update'
        ),
        {
          name: 'Update identity delegation config',
          description: 'Updates mutable fields on an existing identity delegation config.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description: 'Updated display name for the delegation config.',
              examples: ['Updated Sharing Policy']
            })
          ),
          description: v.optional(
            v.string({
              description: 'Updated description for the delegation config.',
              examples: ['Updated reviewed sub-delegation policy']
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Updated metadata for the delegation config.',
              examples: [{ team: 'security', change_ticket: 'SEC-1234' }]
            })
          ),
          sub_delegation_behavior: v.optional(
            v.enumOf(['allow', 'deny', 'require_consent'], {
              description: 'How sub-delegations should be handled.'
            })
          ),
          sub_delegation_depth: v.optional(
            v.number({
              description: 'Maximum allowed sub-delegation depth.',
              examples: [1]
            })
          )
        })
      )
      .output(identityDelegationConfigPresenter)
      .do(async ctx => {
        let identityDelegationConfig = await subspaceIdentityDelegationConfigService.update({
          instance: ctx.instance,
          identityDelegationConfigId: ctx.identityDelegationConfig.id,
          allowDeleted: false,

          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,

          subDelegationBehavior: ctx.body.sub_delegation_behavior,
          subDelegationDepth: ctx.body.sub_delegation_depth
        });

        return identityDelegationConfigPresenter.present({ identityDelegationConfig });
      }),

    delete: identityDelegationConfigGroup
      .delete(
        instancePath(
          'identity-delegation-configs/:identityDelegationConfigId',
          'identities.delegationConfigs.delete'
        ),
        {
          name: 'Delete identity delegation config',
          description: 'Archives an identity delegation config.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(identityDelegationConfigPresenter)
      .do(async ctx => {
        let identityDelegationConfig = await subspaceIdentityDelegationConfigService.delete({
          instance: ctx.instance,
          identityDelegationConfigId: ctx.identityDelegationConfig.id,
          allowDeleted: false
        });

        return identityDelegationConfigPresenter.present({ identityDelegationConfig });
      })
  }
);
