import { v } from '@lowerdeck/validation';
import { aiGatewayConfigService } from '@metorial/module-ai-gateway';
import { aiGatewayConfigPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import {
  aiGatewayInstanceGroup,
  aiGatewayReadScopes,
  aiGatewayWriteScopes
} from './_middleware';
import { limitsValidator } from './_validators';

let settingsValidator = v.object(
  {
    content_logging: v.optional(
      v.object({
        enabled: v.optional(
          v.boolean({
            description: 'Store request and response bodies with inference logs'
          })
        ),
        retention_days: v.optional(
          v.number({
            description: 'How many days stored bodies are kept, from 1 to 90. Defaults to 7.',
            modifiers: [v.integer(), v.minValue(1), v.maxValue(90)]
          })
        )
      }),
      {
        description:
          'Storing prompts and responses. Applies to requests made after the change.'
      }
    ),
    metorial_provider: v.optional(
      v.object({
        enabled: v.optional(
          v.boolean({
            description:
              "Allow requests to be served with Metorial's own provider accounts, billed by Metorial. Your own provider connections are always tried first."
          })
        )
      }),
      { description: 'The Metorial provider' }
    ),
    fallbacks: v.optional(
      v.object({
        enabled: v.optional(
          v.boolean({
            description:
              'Retry a failed request with the next provider that serves the model. When disabled, only the first candidate is tried.'
          })
        )
      }),
      { description: 'Provider fallbacks' }
    ),
    zero_data_retention: v.optional(
      v.object({
        required: v.optional(
          v.boolean({
            description:
              'Only route requests to providers that do not retain prompts or responses. Models without such a provider become unavailable.'
          })
        )
      }),
      { description: 'Zero data retention' }
    )
  },
  { description: 'The settings to change. Fields you omit keep their current value.' }
);

export let aiGatewayConfigController = Controller.create(
  {
    name: 'AI gateway configuration',
    description:
      'Settings, limits and log retention for every request made through the AI gateway in this instance.'
  },
  {
    get: aiGatewayInstanceGroup
      .get(instancePath('ai-gateway/config', 'aiGateway.config.get'), {
        name: 'Get AI gateway configuration',
        description:
          "Retrieves the instance's AI gateway settings and limits, along with the limits and restrictions of your plan."
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .output(aiGatewayConfigPresenter)
      .do(async ctx => {
        let config = await aiGatewayConfigService.get({ instance: ctx.instance });

        return aiGatewayConfigPresenter.present({ config });
      }),

    update: aiGatewayInstanceGroup
      .patch(instancePath('ai-gateway/config', 'aiGateway.config.update'), {
        name: 'Update AI gateway configuration',
        description:
          'Updates the log retention, settings or limits. Fields you omit keep their current value.'
      })
      .use(checkAccess({ possibleScopes: [...aiGatewayWriteScopes] }))
      .body(
        'default',
        v.object({
          log_retention_days: v.optional(
            v.number({
              description:
                'How many days inference logs are kept, from 1 to 400. Usage timelines reach back no further. Applies to requests made after the change.',
              modifiers: [v.integer(), v.minValue(1), v.maxValue(400)]
            })
          ),
          settings: v.optional(settingsValidator),
          limits: v.optional(limitsValidator)
        })
      )
      .output(aiGatewayConfigPresenter)
      .do(async ctx => {
        let settings = ctx.body.settings;

        let config = await aiGatewayConfigService.update({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          input: {
            logRetentionDays: ctx.body.log_retention_days,
            settings: settings && {
              contentLogging: settings.content_logging && {
                enabled: settings.content_logging.enabled,
                retentionDays: settings.content_logging.retention_days
              },
              metorialProvider: settings.metorial_provider && {
                enabled: settings.metorial_provider.enabled
              },
              fallbacks: settings.fallbacks && { enabled: settings.fallbacks.enabled },
              zeroDataRetention: settings.zero_data_retention && {
                required: settings.zero_data_retention.required
              }
            },
            limits: ctx.body.limits
          }
        });

        return aiGatewayConfigPresenter.present({ config });
      })
  }
);
