import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  identityCredentialService,
  identityDelegationConfigService,
  identityService
} from '@metorial-subspace/module-identity';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { identityCredentialPresenter } from '@metorial/presenters';

let identityCredentialGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.identityCredentialId) {
    throw new ServiceError(
      badRequestError({
        message: 'identityCredentialId is required',
        description: 'The identityCredentialId path parameter is required.'
      })
    );
  }

  let identityCredential = await identityCredentialService.getIdentityCredentialById({
    instance: ctx.instance,
    identityCredentialId: ctx.params.identityCredentialId,
    allowDeleted: false
  });

  return { identityCredential };
});

export let identityCredentialController = Controller.create(
  {
    name: 'Identity Credentials',
    description:
      'Identity credentials bind an identity to concrete provider deployment, config, and auth resources.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('identity-credentials', 'identities.credentials.list'), {
        name: 'List identity credentials',
        description: 'Returns a paginated list of identity credentials for the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .outputList(identityCredentialPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ]),
              {
                description: 'Filter by one or more credential statuses.'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by identity credential ID or IDs.',
              examples: ['icr_8vBnM4xZa2cDf7gH']
            }),
            agent_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by owner agent ID or IDs.',
              examples: ['agt_4mNoPq8rSt2uVx6y']
            }),
            actor_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by owner actor ID or IDs.',
              examples: ['iac_6wQpLk2mZa8nYx4b']
            }),
            identity_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by identity ID or IDs.',
              examples: ['idn_5gHjKlMnPqRsTuVw']
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID or IDs.',
              examples: ['pro_5gHjKlMnPqRsTuVw']
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider deployment ID or IDs.',
              examples: ['pdp_4dEfGhJkLmNpQrSt']
            }),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider config ID or IDs.',
              examples: ['pcf_7dEfGhJkLmNpQrSt']
            }),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider auth config ID or IDs.',
              examples: ['pac_3nOpRsTuVwXyZaBc']
            }),
            created_at: dateFilterValidator('identity credential creation time'),
            updated_at: dateFilterValidator('identity credential last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await identityCredentialService.listIdentityCredentials({
          instance: ctx.instance,
          allowDeleted: true,

          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          agentIds: normalizeArrayParam(ctx.query.agent_id),
          actorIds: normalizeArrayParam(ctx.query.actor_id),
          identityIds: normalizeArrayParam(ctx.query.identity_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, identityCredential =>
          identityCredentialPresenter.present({ identityCredential })
        );
      }),

    get: identityCredentialGroup
      .get(
        instancePath(
          'identity-credentials/:identityCredentialId',
          'identities.credentials.get'
        ),
        {
          name: 'Get identity credential',
          description: 'Retrieves a specific identity credential by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(identityCredentialPresenter)
      .do(async ctx =>
        identityCredentialPresenter.present({ identityCredential: ctx.identityCredential })
      ),

    create: instanceGroup
      .post(instancePath('identity-credentials', 'identities.credentials.create'), {
        name: 'Create identity credential',
        description: 'Creates a new credential and attaches it to an identity.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .body(
        'default',
        v.object({
          identity_id: v.string({
            description: 'Identity that will own the new credential.',
            examples: ['idn_5gHjKlMnPqRsTuVw']
          }),
          deployment_id: v.optional(
            v.string({
              description: 'Provider deployment to attach to the credential.',
              examples: ['pdp_4dEfGhJkLmNpQrSt']
            })
          ),
          config_id: v.optional(
            v.string({
              description: 'Provider config to attach to the credential.',
              examples: ['pcf_7dEfGhJkLmNpQrSt']
            })
          ),
          auth_config_id: v.optional(
            v.string({
              description: 'Provider auth config to attach to the credential.',
              examples: ['pac_3nOpRsTuVwXyZaBc']
            })
          ),
          delegation_config_id: v.optional(
            v.string({
              description: 'Delegation config to apply to the credential.',
              examples: ['idc_2mNpQrStUvWxYzAb']
            })
          )
        })
      )
      .output(identityCredentialPresenter)
      .do(async ctx => {
        let identity = await identityService.getIdentityById({
          instance: ctx.instance,
          identityId: ctx.body.identity_id
        });
        let identityCredential = await identityCredentialService.createIdentityCredential({
          instance: ctx.instance,
          identity,
          input: {
            deploymentId: ctx.body.deployment_id,
            configId: ctx.body.config_id,
            authConfigId: ctx.body.auth_config_id,
            delegationConfigId: ctx.body.delegation_config_id
          }
        });

        return identityCredentialPresenter.present({ identityCredential });
      }),

    update: identityCredentialGroup
      .patch(
        instancePath(
          'identity-credentials/:identityCredentialId',
          'identities.credentials.update'
        ),
        {
          name: 'Update identity credential',
          description: 'Updates the delegation config attached to an identity credential.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .body(
        'default',
        v.object({
          delegation_config_id: v.string({
            description: 'Delegation config to apply to the credential.',
            examples: ['idc_2mNpQrStUvWxYzAb']
          })
        })
      )
      .output(identityCredentialPresenter)
      .do(async ctx => {
        let delegationConfig =
          await identityDelegationConfigService.getIdentityDelegationConfigById({
            instance: ctx.instance,
            identityDelegationConfigId: ctx.body.delegation_config_id
          });
        let identityCredential = await identityCredentialService.updateIdentityCredential({
          instance: ctx.instance,
          identityCredential: ctx.identityCredential,
          input: { delegationConfig }
        });

        return identityCredentialPresenter.present({ identityCredential });
      }),

    delete: identityCredentialGroup
      .delete(
        instancePath(
          'identity-credentials/:identityCredentialId',
          'identities.credentials.delete'
        ),
        {
          name: 'Delete identity credential',
          description: 'Archives an identity credential.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['identity-management', 'paid-identity']))
      .output(identityCredentialPresenter)
      .do(async ctx => {
        let identityCredential = await identityCredentialService.archiveIdentityCredential({
          instance: ctx.instance,
          identityCredential: ctx.identityCredential
        });

        return identityCredentialPresenter.present({ identityCredential });
      })
  }
);
