import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { aiGatewayProviderConnectionService } from '@metorial/module-ai-gateway';
import { aiGatewayProviderConnectionPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { requireParam } from '../../../lib/requireParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import {
  aiGatewayInstanceGroup,
  aiGatewayReadScopes,
  aiGatewayWriteScopes
} from './_middleware';
import {
  pricingOverrideValidator,
  toGatewayPricingOverride
} from './providerConnectionPricing';

let connectionStatuses = ['pending', 'valid', 'invalid', 'disabled'] as const;

export let aiGatewayProviderConnectionGroup = aiGatewayInstanceGroup.use(async ctx => {
  let connection = await aiGatewayProviderConnectionService.get({
    instance: ctx.instance,
    connectionId: requireParam(ctx.params, 'connectionId')
  });

  return { connection };
});

let nameValidator = v.string({
  description: 'A name for the connection',
  modifiers: [v.minLength(1), v.maxLength(200)]
});

let descriptionValidator = v.nullable(
  v.string({
    description: 'A description of the connection',
    modifiers: [v.maxLength(2000)]
  })
);

let priorityValidator = v.number({
  description:
    'Connections with a higher priority are tried first when several connections can serve a request. Between -1000 and 1000, defaults to 0.',
  modifiers: [v.integer(), v.minValue(-1000), v.maxValue(1000)]
});

let credentialsValidator = v.record(v.string({ modifiers: [v.maxLength(8192)] }), {
  description:
    'The credentials for the provider, e.g. { "apiKey": "sk-..." }. Checked with the provider before they are saved, and never returned.'
});

let configValidator = v.record(v.union([v.string(), v.number(), v.boolean()]), {
  description:
    'Provider-specific settings that are not secret, e.g. { "resourceName": "my-resource" } for Azure'
});

let featuresValidator = v.object(
  {
    zdr: v.optional(
      v.boolean({
        description:
          'Whether the provider account does not retain prompts or completions. Requests that require zero data retention only route to connections with it enabled.'
      })
    )
  },
  {
    description:
      'Capabilities of the provider account behind the connection. Replaces the existing features when updated.'
  }
);

let toGatewayFeatures = (
  features: { zdr?: boolean } | undefined
): Record<string, boolean> | undefined => {
  if (!features) return undefined;

  return features.zdr === undefined ? {} : { zdr: features.zdr };
};

export let aiGatewayProviderConnectionController = Controller.create(
  {
    name: 'AI gateway provider connections',
    description:
      'Your own credentials for an upstream provider such as OpenAI or Anthropic. The gateway routes requests through them, so the provider bills you directly.'
  },
  {
    list: aiGatewayInstanceGroup
      .get(
        instancePath('ai-gateway/provider-connections', 'aiGateway.providerConnections.list'),
        {
          name: 'List AI gateway provider connections',
          description:
            'Returns a paginated list of provider connections. Deleted connections are not included.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .outputList(aiGatewayProviderConnectionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider: v.optional(
              v.string({
                description: 'Only connections to the provider with this slug, e.g. openai'
              })
            ),
            status: v.optional(
              v.union([v.enumOf(connectionStatuses), v.array(v.enumOf(connectionStatuses))]),
              { description: 'Only connections with one of these statuses' }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = aiGatewayProviderConnectionService.list({
          instance: ctx.instance,
          providerSlug: ctx.query.provider,
          statuses: normalizeArrayParam(ctx.query.status)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, connection =>
          aiGatewayProviderConnectionPresenter.present({ connection })
        );
      }),

    get: aiGatewayProviderConnectionGroup
      .get(
        instancePath(
          'ai-gateway/provider-connections/:connectionId',
          'aiGateway.providerConnections.get'
        ),
        {
          name: 'Get AI gateway provider connection',
          description:
            'Retrieves a provider connection by ID. The credentials are never returned.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .output(aiGatewayProviderConnectionPresenter)
      .do(async ctx =>
        aiGatewayProviderConnectionPresenter.present({ connection: ctx.connection })
      ),

    create: aiGatewayInstanceGroup
      .post(
        instancePath(
          'ai-gateway/provider-connections',
          'aiGateway.providerConnections.create'
        ),
        {
          name: 'Create AI gateway provider connection',
          description:
            'Connects a provider with your own credentials. The credentials are checked with the provider first, and the request fails if the provider rejects them.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .body(
        'default',
        v.object({
          provider: v.string({
            description: 'The slug of the provider to connect, e.g. openai or anthropic'
          }),
          name: nameValidator,
          description: v.optional(descriptionValidator),
          priority: v.optional(priorityValidator),
          credentials: credentialsValidator,
          config: v.optional(configValidator),
          features: v.optional(featuresValidator),
          pricing_override: v.optional(pricingOverrideValidator)
        })
      )
      .output(aiGatewayProviderConnectionPresenter)
      .do(async ctx => {
        let connection = await aiGatewayProviderConnectionService.create({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          input: {
            providerSlug: ctx.body.provider,
            name: ctx.body.name,
            description: ctx.body.description,
            priority: ctx.body.priority,
            credentials: ctx.body.credentials,
            config: ctx.body.config,
            features: toGatewayFeatures(ctx.body.features),
            pricingOverride: toGatewayPricingOverride(ctx.body.pricing_override)
          }
        });

        return aiGatewayProviderConnectionPresenter.present({ connection });
      }),

    update: aiGatewayProviderConnectionGroup
      .patch(
        instancePath(
          'ai-gateway/provider-connections/:connectionId',
          'aiGateway.providerConnections.update'
        ),
        {
          name: 'Update AI gateway provider connection',
          description:
            'Updates a provider connection. New credentials or config are checked with the provider first, and the request fails if the provider rejects them.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .body(
        'default',
        v.object({
          name: v.optional(nameValidator),
          description: v.optional(descriptionValidator),
          priority: v.optional(priorityValidator),
          credentials: v.optional(credentialsValidator, {
            description:
              'New credentials that replace the stored ones. Checked with the provider before they are saved, and never returned.'
          }),
          config: v.optional(configValidator),
          features: v.optional(featuresValidator),
          pricing_override: v.optional(pricingOverrideValidator)
        })
      )
      .output(aiGatewayProviderConnectionPresenter)
      .do(async ctx => {
        let connection = await aiGatewayProviderConnectionService.update({
          instance: ctx.instance,
          connection: ctx.connection,
          auditScope: ctx.auditScope,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            priority: ctx.body.priority,
            credentials: ctx.body.credentials,
            config: ctx.body.config,
            features: toGatewayFeatures(ctx.body.features),
            pricingOverride: toGatewayPricingOverride(ctx.body.pricing_override)
          }
        });

        return aiGatewayProviderConnectionPresenter.present({ connection });
      }),

    delete: aiGatewayProviderConnectionGroup
      .delete(
        instancePath(
          'ai-gateway/provider-connections/:connectionId',
          'aiGateway.providerConnections.delete'
        ),
        {
          name: 'Delete AI gateway provider connection',
          description:
            'Deletes a provider connection. Requests are no longer routed through it and its credentials are discarded.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .output(aiGatewayProviderConnectionPresenter)
      .do(async ctx => {
        let connection = await aiGatewayProviderConnectionService.archive({
          instance: ctx.instance,
          connection: ctx.connection,
          auditScope: ctx.auditScope
        });

        return aiGatewayProviderConnectionPresenter.present({ connection });
      }),

    check: aiGatewayProviderConnectionGroup
      .post(
        instancePath(
          'ai-gateway/provider-connections/:connectionId/check',
          'aiGateway.providerConnections.check'
        ),
        {
          name: 'Check AI gateway provider connection',
          description:
            'Checks the credentials with the provider now and updates the status. Disabled connections cannot be checked.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .output(aiGatewayProviderConnectionPresenter)
      .do(async ctx => {
        let connection = await aiGatewayProviderConnectionService.check({
          instance: ctx.instance,
          connection: ctx.connection
        });

        return aiGatewayProviderConnectionPresenter.present({ connection });
      }),

    enable: aiGatewayProviderConnectionGroup
      .post(
        instancePath(
          'ai-gateway/provider-connections/:connectionId/enable',
          'aiGateway.providerConnections.enable'
        ),
        {
          name: 'Enable AI gateway provider connection',
          description:
            'Turns a disabled connection back on and checks its credentials with the provider.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .output(aiGatewayProviderConnectionPresenter)
      .do(async ctx => {
        let connection = await aiGatewayProviderConnectionService.setEnabled({
          instance: ctx.instance,
          connection: ctx.connection,
          auditScope: ctx.auditScope,
          enabled: true
        });

        return aiGatewayProviderConnectionPresenter.present({ connection });
      }),

    disable: aiGatewayProviderConnectionGroup
      .post(
        instancePath(
          'ai-gateway/provider-connections/:connectionId/disable',
          'aiGateway.providerConnections.disable'
        ),
        {
          name: 'Disable AI gateway provider connection',
          description:
            'Turns a connection off without deleting it. Requests are not routed through it and its credentials are not checked until it is enabled again.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .output(aiGatewayProviderConnectionPresenter)
      .do(async ctx => {
        let connection = await aiGatewayProviderConnectionService.setEnabled({
          instance: ctx.instance,
          connection: ctx.connection,
          auditScope: ctx.auditScope,
          enabled: false
        });

        return aiGatewayProviderConnectionPresenter.present({ connection });
      })
  }
);
