import { oauthDiscoveryService } from '@metorial/module-oauth';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { apiGroup } from '../../middleware/apiGroup';
import { providerOauthDiscoveryPresenter } from '../../presenters';

export let dashboardOauthDiscoveryController = Controller.create(
  {
    name: 'OAuth Connection Template',
    description: 'Get OAuth connection template information'
  },
  {
    get: apiGroup
      .post(Path('provider-oauth-discovery', 'provider_oauth.discover'), {
        name: 'Discover OAuth Configuration',
        description: 'Discover OAuth configuration from a discovery URL'
      })
      .body(
        'default',
        v.object({
          discovery_url: v.string({ modifiers: [v.url()] })
        })
      )
      .output(providerOauthDiscoveryPresenter)
      .do(async ctx => {
        let discovery = await oauthDiscoveryService.discoverOauthConfig({
          discoveryUrl: ctx.body.discovery_url
        });

        return providerOauthDiscoveryPresenter.present({
          providerOauthDiscoveryDocument: discovery
        });
      })
  }
);
