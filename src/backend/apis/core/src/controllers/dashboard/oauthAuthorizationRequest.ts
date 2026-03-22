import { v } from '@lowerdeck/validation';
import { oauthAuthorizationService } from '@metorial/module-machine-access';
import { Controller, Path } from '@metorial/rest';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { userGroup } from '../../middleware/userGroup';
import { oauthAuthorizationRequestPresenter } from '../../presenters';

export let dashboardOAuthAuthorizationRequestController = Controller.create(
  {
    name: 'OAuth Authorization Request',
    description: 'Read and approve oauth authorization requests'
  },
  {
    get: userGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/oauth/authorization-requests/:urlToken',
          'dashboard.oauth.authorizationRequests.get'
        ),
        {
          name: 'Get OAuth authorization request',
          description: 'Get an oauth authorization request by its url token'
        }
      )
      .output(oauthAuthorizationRequestPresenter)
      .do(async ctx => {
        let oauthAuthorizationRequest =
          await oauthAuthorizationService.getOAuthAuthorizationRequestByUrlToken({
            urlToken: ctx.params.urlToken
          });

        return oauthAuthorizationRequestPresenter.present({
          oauthAuthorizationRequest
        });
      }),

    approve: userGroup
      .use(isDashboardGroup())
      .post(
        Path(
          '/dashboard/oauth/authorization-requests/:urlToken/approve',
          'dashboard.oauth.authorizationRequests.approve'
        ),
        {
          name: 'Approve OAuth authorization request',
          description: 'Approve an oauth authorization request for an organization'
        }
      )
      .body(
        'default',
        v.object({
          organization_id: v.string()
        })
      )
      .output(oauthAuthorizationRequestPresenter)
      .do(async ctx => {
        let oauthAuthorizationRequest =
          await oauthAuthorizationService.getOAuthAuthorizationRequestByUrlToken({
            urlToken: ctx.params.urlToken
          });

        let result = await oauthAuthorizationService.acceptOAuthAuthorizationRequest({
          oauthAuthorizationRequest,
          user: ctx.user,
          organizationId: ctx.body.organization_id,
          context: ctx.context
        });

        return oauthAuthorizationRequestPresenter.present({
          oauthAuthorizationRequest: result.oauthAuthorizationRequest
        });
      }),

    reject: userGroup
      .use(isDashboardGroup())
      .post(
        Path(
          '/dashboard/oauth/authorization-requests/:urlToken/reject',
          'dashboard.oauth.authorizationRequests.reject'
        ),
        {
          name: 'Reject OAuth authorization request',
          description: 'Reject an oauth authorization request'
        }
      )
      .body(
        'default',
        v.object({
          organization_id: v.optional(v.string())
        })
      )
      .output(oauthAuthorizationRequestPresenter)
      .do(async ctx => {
        let oauthAuthorizationRequest =
          await oauthAuthorizationService.getOAuthAuthorizationRequestByUrlToken({
            urlToken: ctx.params.urlToken
          });

        let result = await oauthAuthorizationService.rejectOAuthAuthorizationRequest({
          user: ctx.user,
          oauthAuthorizationRequest,
          organizationId: ctx.body.organization_id,
          context: ctx.context
        });

        return oauthAuthorizationRequestPresenter.present({
          oauthAuthorizationRequest: result
        });
      })
  }
);
