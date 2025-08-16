import { providerOauthDiscoveryService } from '@metorial/module-provider-oauth';
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
    discover: apiGroup
      .post(Path('provider-oauth-discovery', 'provider_oauth.discover'), {
        name: 'Discover OAuth Configuration',
        description: 'Discover OAuth configuration from a discovery URL'
      })
      .body(
        'default',
        v.object({
          discovery_url: v.string({ modifiers: [v.url()] }),
          client_name: v.string()
        })
      )
      .output(providerOauthDiscoveryPresenter)
      .do(async ctx => {
        let { discovery, autoRegistration } =
          await providerOauthDiscoveryService.discoverOauthConfig({
            discoveryUrl: ctx.body.discovery_url,
            input: {
              clientName: ctx.body.client_name
            }
          });

        return providerOauthDiscoveryPresenter.present({
          providerOauthDiscoveryDocument: discovery,
          providerOauthAutoRegistration: autoRegistration
        });
      })
  }
);
