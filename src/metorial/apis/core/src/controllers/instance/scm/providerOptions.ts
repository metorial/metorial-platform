import { v } from '@lowerdeck/validation';
import { PresentableType, Presenter, declarePresenter } from '@metorial/presenter';
import { scmProviderService } from '@metorial-subspace/module-custom-provider';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';

let optionsType = PresentableType.create<{
  options: Awaited<ReturnType<typeof scmProviderService.getProviderOptions>>;
}>()('scm.provider_options');

let optionsPresenter = Presenter.create(optionsType)
  .presenter(async ({ options }) => ({
    object: 'scm.provider_options' as const,
    items: options.map(option => ({
      type: option.type,
      label: option.label,
      allowed_domains: option.allowedDomains
    }))
  }))
  .schema(
    v.object({
      object: v.literal('scm.provider_options'),
      items: v.array(
        v.object({
          type: v.enumOf(
            [
              'github',
              'github_enterprise',
              'gitlab',
              'gitlab_selfhosted',
              'bitbucket',
              'bitbucket_data_center'
            ],
            { description: 'SCM provider type accepted by this installation' }
          ),
          label: v.string({ description: 'Provider display name' }),
          allowed_domains: v.nullable(
            v.array(v.string({ description: 'An allowed provider hostname' }))
          )
        })
      )
    })
  )
  .build();

let presenter = declarePresenter(optionsType, {
  mt_2025_01_01_dashboard: optionsPresenter,
  mt_2026_01_01_magnetar: optionsPresenter
});

export let scmProviderOptionsController = Controller.create(
  {
    name: 'SCM Provider Options',
    description: 'Available source control provider setup options'
  },
  {
    list: instanceGroup
      .get(instancePath('scm/provider-options', 'scm.provider_options.list'), {
        name: 'List SCM provider options',
        description: 'Lists enabled provider types and installation domain restrictions.'
      })
      .use(checkAccess({ possibleScopes: ['instance.scm.installation:read'] }))
      .output(presenter)
      .do(async ctx => ({
        options: await scmProviderService.getProviderOptions({ instance: ctx.instance })
      }))
  }
);
