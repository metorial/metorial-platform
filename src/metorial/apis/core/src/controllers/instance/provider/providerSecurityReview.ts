import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerService } from '@metorial-subspace/module-catalog';
import { securityReviewService } from '@metorial-subspace/module-security-review';
import {
  providerSecurityReviewPresenter,
  providerSecurityReviewRevisionPresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';

let securityReviewInstanceGroup = instanceGroup.use(hasFlags(['security-reviews-enabled']));

let providerGroup = securityReviewInstanceGroup.use(async ctx => {
  if (!ctx.params.providerId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerId is required',
        description: 'The providerId path parameter is required.'
      })
    );
  }

  let provider = await providerService.getProviderById({
    instance: ctx.instance,
    providerId: ctx.params.providerId
  });

  return { provider };
});

let securityReviewGroup = securityReviewInstanceGroup.use(async ctx => {
  if (!ctx.params.securityReviewId) {
    throw new ServiceError(
      badRequestError({
        message: 'securityReviewId is required',
        description: 'The securityReviewId path parameter is required.'
      })
    );
  }

  let state = await securityReviewService.getSecurityReviewById({
    instance: ctx.instance,
    securityReviewId: ctx.params.securityReviewId
  });

  return { securityReview: state };
});

export let providerSecurityReviewController = Controller.create(
  {
    name: 'Provider Security Reviews',
    description:
      'An AI security review assesses how trustworthy a provider version is and what its tools can do. Reviews of Metorial integrations are shared across organizations; reviews of custom providers are private to the organization.'
  },
  {
    getForProvider: providerGroup
      .get(
        instancePath('providers/:providerId/security-review', 'providers.securityReview.get'),
        {
          name: 'Get provider security review',
          description:
            "Returns the security review of a provider's current version, or of the version given in the query. Requests a review if none exists yet."
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .query(
        'default',
        v.object({
          provider_version_id: v.optional(
            v.string({
              description: 'Review a specific version instead of the current one',
              examples: ['prv_4dEfGhJkLmNpQrSt']
            })
          )
        })
      )
      .output(providerSecurityReviewPresenter)
      .do(async ctx => {
        let state = await securityReviewService.getSecurityReviewForProvider({
          instance: ctx.instance,
          provider: ctx.provider,
          providerVersionId: ctx.query.provider_version_id
        });

        return providerSecurityReviewPresenter.present(state);
      }),

    reassessUsage: providerGroup
      .post(
        instancePath(
          'providers/:providerId/security-review/usage/reassess',
          'providers.securityReview.usage.reassess'
        ),
        {
          name: 'Reassess usage review',
          description:
            'Starts a new usage review of the provider, based on how it is used in this project. Usage reviews must be enabled for the project.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:write'] }))
      .output(providerSecurityReviewPresenter)
      .do(async ctx => {
        await securityReviewService.reassessUsageReview({
          instance: ctx.instance,
          provider: ctx.provider
        });

        let state = await securityReviewService.getSecurityReviewForProvider({
          instance: ctx.instance,
          provider: ctx.provider
        });

        return providerSecurityReviewPresenter.present(state);
      }),

    get: securityReviewGroup
      .get(instancePath('security-reviews/:securityReviewId', 'securityReviews.get'), {
        name: 'Get security review',
        description: 'Retrieves a security review with its current and in-progress revisions.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(providerSecurityReviewPresenter)
      .do(async ctx => providerSecurityReviewPresenter.present(ctx.securityReview)),

    reassess: securityReviewGroup
      .post(
        instancePath(
          'security-reviews/:securityReviewId/reassess',
          'securityReviews.reassess'
        ),
        {
          name: 'Reassess security review',
          description: 'Starts a new review of a custom provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:write'] }))
      .output(providerSecurityReviewPresenter)
      .do(async ctx => {
        let state = await securityReviewService.reassessSecurityReview({
          review: ctx.securityReview.review
        });

        return providerSecurityReviewPresenter.present(state);
      }),

    listRevisions: securityReviewGroup
      .get(
        instancePath(
          'security-reviews/:securityReviewId/revisions',
          'securityReviews.revisions.list'
        ),
        {
          name: 'List security review revisions',
          description: 'Returns the most recent finished revisions of a security review.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(providerSecurityReviewRevisionPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let review = ctx.securityReview.review;
        let paginator = await securityReviewService.listSecurityReviewRevisions({ review });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, revision =>
          providerSecurityReviewRevisionPresenter.present({ review, revision })
        );
      }),

    getRevision: securityReviewGroup
      .get(
        instancePath(
          'security-reviews/:securityReviewId/revisions/:revisionId',
          'securityReviews.revisions.get'
        ),
        {
          name: 'Get security review revision',
          description: 'Retrieves a single revision of a security review.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(providerSecurityReviewRevisionPresenter)
      .do(async ctx => {
        if (!ctx.params.revisionId) {
          throw new ServiceError(badRequestError({ message: 'revisionId is required' }));
        }

        let review = ctx.securityReview.review;
        let revision = await securityReviewService.getSecurityReviewRevision({
          review,
          revisionId: ctx.params.revisionId
        });

        return providerSecurityReviewRevisionPresenter.present({ review, revision });
      })
  }
);
