import { canonicalize } from '@metorial/canonicalize';
import { Presenter } from '@metorial/presenter';
import { shadowId } from '@metorial/shadow-id';
import { v } from '@metorial/validation';
import { providerOauthConnectionTemplateEvaluationType } from '../types';

export let v1ProviderOauthConnectionTemplateEvaluationPresenter = Presenter.create(
  providerOauthConnectionTemplateEvaluationType
)
  .presenter(async ({ providerOauthConnectionTemplate, input, output }, opts) => ({
    object: 'provider_oauth.connection_template.evaluation',

    id: shadowId(
      'poctev_',
      [providerOauthConnectionTemplate.id],
      [canonicalize(input), Date.now()]
    ),

    template_id: providerOauthConnectionTemplate.id,

    config: output,

    created_at: new Date()
  }))
  .schema(
    v.object({
      object: v.literal('provider_oauth.connection_template.evaluation'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier for the evaluation result'
      }),

      template_id: v.string({
        name: 'template_id',
        description: 'The unique identifier for the OAuth connection template being evaluated'
      }),

      config: v.record(v.any(), {
        name: 'config',
        description: 'The evaluated configuration based on the template and input data'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'The timestamp when the evaluation was created'
      })
    })
  )
  .build();
