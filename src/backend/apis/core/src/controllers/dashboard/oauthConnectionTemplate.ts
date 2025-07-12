import { oauthTemplateService } from '@metorial/module-oauth';
import { Paginator } from '@metorial/pagination';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { apiGroup } from '../../middleware/apiGroup';
import { providerOauthConnectionTemplatePresenter } from '../../presenters';

export let oauthTemplateGroup = apiGroup.use(async ctx => {
  if (!ctx.params.oauthTemplateId) throw new Error('oauthTemplateId is required');

  let oauthTemplate = await oauthTemplateService.getTemplateById({
    templateId: ctx.params.oauthTemplateId
  });

  return { oauthTemplate };
});

export let dashboardAuthConnectionTemplateController = Controller.create(
  {
    name: 'Auth Connection Template',
    description: 'Get auth connection template information'
  },
  {
    list: apiGroup
      .get(
        Path('provider-oauth-connection-template', 'provider_oauth.connection_template.list'),
        {
          name: 'List auth connection templates',
          description: 'List all auth connection templates'
        }
      )
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
        let paginator = await oauthTemplateService.listTemplates({
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
          'provider-oauth-connection-template/:oauthTemplateId',
          'provider_oauth.connection_template.get'
        ),
        {
          name: 'Get auth connection template',
          description: 'Get the information of a specific auth connection template'
        }
      )
      .output(providerOauthConnectionTemplatePresenter)
      .do(async ctx => {
        return providerOauthConnectionTemplatePresenter.present({
          providerOauthConnectionTemplate: ctx.oauthTemplate
        });
      })
  }
);
