import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderOauthConnectionTemplateEvaluateOutput = {
  object: 'provider_oauth.connection_template.evaluation';
  id: string;
  templateId: string;
  config: Record<string, any>;
  createdAt: Date;
};

export let mapProviderOauthConnectionTemplateEvaluateOutput =
  mtMap.object<ProviderOauthConnectionTemplateEvaluateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    templateId: mtMap.objectField('template_id', mtMap.passthrough()),
    config: mtMap.objectField('config', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

export type ProviderOauthConnectionTemplateEvaluateBody = {
  data: Record<string, any>;
};

export let mapProviderOauthConnectionTemplateEvaluateBody =
  mtMap.object<ProviderOauthConnectionTemplateEvaluateBody>({
    data: mtMap.objectField('data', mtMap.passthrough())
  });

