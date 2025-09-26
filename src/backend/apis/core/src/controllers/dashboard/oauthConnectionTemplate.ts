import { providerOauthTemplateService } from '@metorial/module-provider-oauth';
import { Paginator } from '@metorial/pagination';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { apiGroup } from '../../middleware/apiGroup';
import { isDashboardGroup } from '../../middleware/isDashboard';
import {
  providerOauthConnectionTemplateEvaluationPresenter,
  providerOauthConnectionTemplatePresenter
} from '../../presenters';

export let oauthTemplateGroup = apiGroup.use(async ctx => {
  if (!ctx.params.oauthTemplateId) throw new Error('oauthTemplateId is required');

  let oauthTemplate = await providerOauthTemplateService.getTemplateById({
    templateId: ctx.params.oauthTemplateId
  });

  return { oauthTemplate };
});

export let dashboardOauthConnectionTemplateController = Controller.create(
  {
    name: 'OAuth Connection Template',
    description: 'Get OAuth connection template information'
  },
  {
    list: apiGroup

      .get(
        Path(
          '/dashboard/organizations/:organizationId/provider-oauth-connection-template',
          'provider_oauth.connection_template.list'
        ),
        {
          name: 'List oauth connection templates',
          description: 'List all oauth connection templates'
        }
      )
      .use(isDashboardGroup())
      .outputList(providerOauthConnectionTemplatePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            profile_id: v.optional(v.union([v.array(v.string()), v.string()]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await providerOauthTemplateService.listTemplates({
          profileIds: normalizeArrayParam(ctx.query.profile_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, providerOauthConnectionTemplate =>
          providerOauthConnectionTemplatePresenter.present({ providerOauthConnectionTemplate })
        );
      }),

    get: oauthTemplateGroup
      .get(
        Path(
          '/dashboard/organizations/:organizationId/provider-oauth-connection-template/:oauthTemplateId',
          'provider_oauth.connection_template.get'
        ),
        {
          name: 'Get oauth connection template',
          description: 'Get the information of a specific oauth connection template'
        }
      )
      .use(isDashboardGroup())
      .output(providerOauthConnectionTemplatePresenter)
      .do(async ctx => {
        return providerOauthConnectionTemplatePresenter.present({
          providerOauthConnectionTemplate: ctx.oauthTemplate
        });
      }),

    evaluate: oauthTemplateGroup
      .post(
        Path(
          'provider-oauth-connection-template/:oauthTemplateId/evaluate',
          'provider_oauth.connection_template.evaluate'
        ),
        {
          name: 'Evaluate oauth connection template',
          description: 'Evaluate the configuration of an oauth connection template'
        }
      )
      .body(
        'default',
        v.object({
          data: v.record(v.any())
        })
      )
      .use(isDashboardGroup())
      .output(providerOauthConnectionTemplateEvaluationPresenter)
      .do(async ctx => {
        let output = await providerOauthTemplateService.evaluateTemplateConfig({
          template: ctx.oauthTemplate,
          data: ctx.body.data
        });

        return providerOauthConnectionTemplateEvaluationPresenter.present({
          providerOauthConnectionTemplate: ctx.oauthTemplate,
          input: ctx.body.data,
          output
        });
      })
  }
);
