import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { aiGatewayConsumerService, aiGatewayTokenService } from '@metorial/module-ai-gateway';
import { aiGatewayTokenPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { requireParam } from '../../../lib/requireParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import {
  aiGatewayInstanceGroup,
  aiGatewayReadScopes,
  aiGatewayWriteScopes
} from './_middleware';
import {
  allowedModelsValidator,
  limitsValidator,
  tokenMetadataValidator
} from './_validators';

export let aiGatewayTokenGroup = aiGatewayInstanceGroup.use(async ctx => {
  let gatewayToken = await aiGatewayTokenService.get({
    instance: ctx.instance,
    gatewayTokenId: requireParam(ctx.params, 'tokenId')
  });

  return { gatewayToken };
});

let nameValidator = v.string({
  description: 'A name for the token',
  modifiers: [v.minLength(1), v.maxLength(200)]
});

export let aiGatewayTokenController = Controller.create(
  {
    name: 'AI gateway tokens',
    description:
      'API keys for the AI gateway. Each token can be limited to certain models and given its own rate and spend limits.'
  },
  {
    list: aiGatewayInstanceGroup
      .get(instancePath('ai-gateway/tokens', 'aiGateway.tokens.list'), {
        name: 'List AI gateway tokens',
        description: 'Returns a paginated list of tokens, including revoked ones.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .outputList(aiGatewayTokenPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            consumer_id: v.optional(
              v.string({ description: 'Only tokens created for this consumer' })
            )
          })
        )
      )
      .do(async ctx => {
        let consumerRef = ctx.query.consumer_id
          ? await aiGatewayConsumerService.resolveRef({
              instance: ctx.instance,
              consumerId: ctx.query.consumer_id
            })
          : undefined;

        let paginator = aiGatewayTokenService.list({ instance: ctx.instance, consumerRef });
        let list = await paginator.run(ctx.query);
        let consumers = await aiGatewayConsumerService.findForRefs({
          instance: ctx.instance,
          refs: list.items.map(gatewayToken => gatewayToken.consumerRef)
        });

        return Paginator.present(list, gatewayToken =>
          aiGatewayTokenPresenter.present({
            gatewayToken,
            consumer: consumers.get(gatewayToken.consumerRef)
          })
        );
      }),

    get: aiGatewayTokenGroup
      .get(instancePath('ai-gateway/tokens/:tokenId', 'aiGateway.tokens.get'), {
        name: 'Get AI gateway token',
        description: 'Retrieves a token by ID. The secret is never returned again.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .output(aiGatewayTokenPresenter)
      .do(async ctx => {
        let consumers = await aiGatewayConsumerService.findForRefs({
          instance: ctx.instance,
          refs: [ctx.gatewayToken.consumerRef]
        });

        return aiGatewayTokenPresenter.present({
          gatewayToken: ctx.gatewayToken,
          consumer: consumers.get(ctx.gatewayToken.consumerRef)
        });
      }),

    create: aiGatewayInstanceGroup
      .post(instancePath('ai-gateway/tokens', 'aiGateway.tokens.create'), {
        name: 'Create AI gateway token',
        description:
          'Creates a token. The response contains the secret, which is shown only this once.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .body(
        'default',
        v.object({
          name: nameValidator,
          consumer_id: v.optional(
            v.string({
              description:
                'The consumer the token is for. Requests made with it can be filtered by this consumer in inference logs and usage, and virtual model rules can route on it. Cannot be changed afterwards.'
            })
          ),
          allowed_models: v.optional(allowedModelsValidator),
          limits: v.optional(limitsValidator),
          metadata: v.optional(tokenMetadataValidator),
          expires_at: v.optional(
            v.date({ description: 'When the token stops working. Omit for no expiry.' })
          )
        })
      )
      .output(aiGatewayTokenPresenter)
      .do(async ctx => {
        let consumerRef = ctx.body.consumer_id
          ? await aiGatewayConsumerService.resolveRef({
              instance: ctx.instance,
              consumerId: ctx.body.consumer_id
            })
          : undefined;

        let { secret, ...gatewayToken } = await aiGatewayTokenService.create({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          input: {
            name: ctx.body.name,
            consumerRef,
            allowedModels: ctx.body.allowed_models,
            limits: ctx.body.limits,
            metadata: ctx.body.metadata,
            expiresAt: ctx.body.expires_at
          }
        });

        let consumers = await aiGatewayConsumerService.findForRefs({
          instance: ctx.instance,
          refs: [gatewayToken.consumerRef]
        });

        return aiGatewayTokenPresenter.present({
          gatewayToken,
          secret,
          consumer: consumers.get(gatewayToken.consumerRef)
        });
      }),

    update: aiGatewayTokenGroup
      .patch(instancePath('ai-gateway/tokens/:tokenId', 'aiGateway.tokens.update'), {
        name: 'Update AI gateway token',
        description: 'Updates the name, allowed models, limits, metadata or expiry of a token.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .body(
        'default',
        v.object({
          name: v.optional(nameValidator),
          allowed_models: v.optional(allowedModelsValidator),
          limits: v.optional(limitsValidator),
          metadata: v.optional(tokenMetadataValidator),
          expires_at: v.optional(
            v.nullable(
              v.date({
                description: 'When the token stops working. Pass null to never expire.'
              })
            )
          )
        })
      )
      .output(aiGatewayTokenPresenter)
      .do(async ctx => {
        let gatewayToken = await aiGatewayTokenService.update({
          instance: ctx.instance,
          gatewayToken: ctx.gatewayToken,
          auditScope: ctx.auditScope,
          input: {
            name: ctx.body.name,
            allowedModels: ctx.body.allowed_models,
            limits: ctx.body.limits,
            metadata: ctx.body.metadata,
            expiresAt: ctx.body.expires_at
          }
        });

        let consumers = await aiGatewayConsumerService.findForRefs({
          instance: ctx.instance,
          refs: [gatewayToken.consumerRef]
        });

        return aiGatewayTokenPresenter.present({
          gatewayToken,
          consumer: consumers.get(gatewayToken.consumerRef)
        });
      }),

    revoke: aiGatewayTokenGroup
      .post(instancePath('ai-gateway/tokens/:tokenId/revoke', 'aiGateway.tokens.revoke'), {
        name: 'Revoke AI gateway token',
        description: 'Revokes a token. Requests made with it are rejected from then on.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .output(aiGatewayTokenPresenter)
      .do(async ctx => {
        let gatewayToken = await aiGatewayTokenService.revoke({
          instance: ctx.instance,
          gatewayToken: ctx.gatewayToken,
          auditScope: ctx.auditScope
        });

        let consumers = await aiGatewayConsumerService.findForRefs({
          instance: ctx.instance,
          refs: [gatewayToken.consumerRef]
        });

        return aiGatewayTokenPresenter.present({
          gatewayToken,
          consumer: consumers.get(gatewayToken.consumerRef)
        });
      })
  }
);
