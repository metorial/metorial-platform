import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { oauthAuthorizationService } from '@metorial/module-machine-access';
import { Controller, Path } from '@metorial/rest';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { userGroup } from '../../middleware/userGroup';
import {
  oauthAuthorizationRequestConsumerTargetPresenter,
  oauthAuthorizationRequestPresenter
} from '@metorial/presenters';

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
          description: 'Get an oauth authorization request by its url token',
          confidential: true
        }
      )
      .output(oauthAuthorizationRequestPresenter)
      .do(async ctx => {
        let oauthAuthorizationRequest =
          await oauthAuthorizationService.getOAuthAuthorizationRequestByUrlToken({
            urlToken: ctx.params.urlToken
          });

        if (
          oauthAuthorizationRequest.status != 'pending' &&
          oauthAuthorizationRequest.userId != ctx.user.id
        ) {
          throw new ServiceError(
            notFoundError('oauth_authorization_request', ctx.params.urlToken)
          );
        }

        return oauthAuthorizationRequestPresenter.present({
          oauthAuthorizationRequest
        });
      }),

    consumerTargets: userGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/oauth/authorization-requests/:urlToken/consumer-targets',
          'dashboard.oauth.authorizationRequests.consumerTargets.list'
        ),
        {
          name: 'List OAuth authorization request consumer targets',
          description:
            'Lists the portal consumer profiles the current user can approve a consumer oauth authorization request as',
          confidential: true
        }
      )
      .outputList(oauthAuthorizationRequestConsumerTargetPresenter)
      .do(async ctx => {
        let oauthAuthorizationRequest =
          await oauthAuthorizationService.getOAuthAuthorizationRequestByUrlToken({
            urlToken: ctx.params.urlToken
          });

        let consumerProfiles =
          await oauthAuthorizationService.listConsumerAuthorizationTargets({
            oauthAuthorizationRequest,
            user: ctx.user
          });

        return Paginator.present(
          {
            items: consumerProfiles,
            pagination: {
              hasNextPage: false,
              hasPreviousPage: false
            }
          },
          consumerProfile =>
            oauthAuthorizationRequestConsumerTargetPresenter.present({ consumerProfile })
        );
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
          description: 'Approve an oauth authorization request for an organization',
          confidential: true
        }
      )
      .body(
        'default',
        v.object({
          organization_id: v.string({
            description:
              'Organization to approve the request for. For consumer requests, the organization of the selected consumer profile.',
            examples: ['org_7hNkPqRsTuVwXyZa']
          }),
          consumer_profile_id: v.optional(
            v.string({
              description:
                'Consumer profile to authorize the application as. Required when the request subject type is consumer.',
              examples: ['cop_4sTuVwXyZaBcDeFg']
            })
          )
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
          consumerProfileId: ctx.body.consumer_profile_id,
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
          description: 'Reject an oauth authorization request',
          confidential: true
        }
      )
      .body(
        'default',
        v.object({
          organization_id: v.optional(
            v.string({
              description: 'Organization the request was rejected for, if one was selected',
              examples: ['org_7hNkPqRsTuVwXyZa']
            })
          ),
          consumer_profile_id: v.optional(
            v.string({
              description:
                'Consumer profile the request was rejected for, if one was selected on a consumer request',
              examples: ['cop_4sTuVwXyZaBcDeFg']
            })
          )
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
          consumerProfileId: ctx.body.consumer_profile_id,
          context: ctx.context
        });

        return oauthAuthorizationRequestPresenter.present({
          oauthAuthorizationRequest: result
        });
      })
  }
);
