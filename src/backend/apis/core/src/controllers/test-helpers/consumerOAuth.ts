import { v } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import { consumerOAuthTestAuthorizationService } from '@metorial/module-consumer';
import { Controller, Path } from '@metorial/rest';
import { apiGroup } from '../../middleware/apiGroup';
import { consumerOAuthTestAuthorizationPresenter } from '../../presenters';

export let testHelperConsumerOAuthController = Controller.create(
  {
    name: 'Test Helper Consumer OAuth',
    description: 'Helpers for testing consumer OAuth flows.',
    hideInDocs: true
  },
  {
    createAuthorization: apiGroup
      .post(
        Path(
          '/test-helpers/consumer-oauth-authorizations',
          'testHelpers.consumerOAuth.authorizations.create'
        ),
        {
          name: 'Create consumer OAuth test authorization',
          description:
            'Creates a single-use test authorization token for a consumer OAuth authorize URL.',
          hideInDocs: true
        }
      )
      .body(
        'default',
        v.object({
          instance_id: v.string(),
          url: v.string({ modifiers: [v.url()] }),
          consumer_profile_id: v.string(),
          magic_mcp_endpoint_id: v.string()
        })
      )
      .output(consumerOAuthTestAuthorizationPresenter)
      .do(async ctx => {
        let { instance } = await accessService.accessInstance({
          authInfo: ctx.auth,
          instanceId: ctx.body.instance_id
        });

        let authorization =
          await consumerOAuthTestAuthorizationService.createTestAuthorization({
            instance,
            input: {
              url: ctx.body.url,
              consumerProfileId: ctx.body.consumer_profile_id,
              magicMcpEndpointId: ctx.body.magic_mcp_endpoint_id
            }
          });

        return consumerOAuthTestAuthorizationPresenter.present({
          testAuthorization: authorization.testAuthorization,
          url: authorization.url
        });
      })
  }
);
