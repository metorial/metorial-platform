import { badRequestError, ServiceError } from '@metorial/error';
import { providerOauthTakeoutService } from '@metorial/module-provider-oauth';
import { serverOAuthSessionService } from '@metorial/module-session';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerOauthTakeoutPresenter } from '../../presenters';

export let takeoutGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.takeoutId) throw new Error('takeoutId is required');

  let takeout = await providerOauthTakeoutService.getTakeout({
    takeoutId: ctx.params.takeoutId,
    instance: ctx.instance
  });

  return { takeout };
});

export let providerOauthTakeoutController = Controller.create(
  {
    name: 'OAuth Takeout',
    description: 'Manage provider OAuth takeout information',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('provider-oauth/takeouts', 'provider_oauth.takeouts.list'), {
        name: 'List provider OAuth takeouts',
        description: 'List all provider OAuth takeouts'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.takeout:read'] }))
      .outputList(providerOauthTakeoutPresenter)
      .query('default', Paginator.validate(v.object({})))
      .use(hasFlags(['metorial-gateway-enabled']))
      .do(async ctx => {
        let paginator = await providerOauthTakeoutService.listTakeouts({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, providerOauthTakeout =>
          providerOauthTakeoutPresenter.present({
            providerOauthTakeout,
            includeSensitiveData: false
          })
        );
      }),

    create: instanceGroup
      .post(instancePath('provider-oauth/takeouts', 'provider_oauth.takeouts.create'), {
        name: 'Create provider OAuth takeout',
        description: 'Create a new provider OAuth takeout'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.takeout:write'] }))
      .body(
        'default',
        v.object({
          note: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          oauth_session_id: v.string()
        })
      )
      .use(hasFlags(['metorial-gateway-enabled']))
      .output(providerOauthTakeoutPresenter)
      .do(async ctx => {
        let session = await serverOAuthSessionService.getServerOAuthSessionById({
          serverOAuthSessionId: ctx.body.oauth_session_id,
          instance: ctx.instance
        });
        if (!session.tokenReferenceOid || session.status != 'completed') {
          throw new ServiceError(
            badRequestError({
              message: 'OAuth session must be completed'
            })
          );
        }

        let providerOauthTakeout = await providerOauthTakeoutService.createOauthTakeout({
          instance: ctx.instance,
          context: ctx.context,
          from: {
            type: 'reference',
            referenceOid: session.tokenReferenceOid!
          },
          input: {
            note: ctx.body.note,
            metadata: ctx.body.metadata
          }
        });

        return providerOauthTakeoutPresenter.present({
          providerOauthTakeout,
          includeSensitiveData: true
        });
      }),

    get: takeoutGroup
      .get(instancePath('provider-oauth/takeouts/:takeoutId', 'provider_oauth.takeouts.get'), {
        name: 'Get provider OAuth takeout',
        description: 'Get information for a specific provider OAuth takeout'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.takeout:read'] }))
      .output(providerOauthTakeoutPresenter)
      .use(hasFlags(['metorial-gateway-enabled']))
      .do(async ctx => {
        return providerOauthTakeoutPresenter.present({
          providerOauthTakeout: ctx.takeout,
          includeSensitiveData: false
        });
      })
  }
);
