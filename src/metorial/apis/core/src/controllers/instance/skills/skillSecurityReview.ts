import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { securityReviewService } from '@metorial-subspace/module-security-review';
import {
  skillSecurityReviewPresenter,
  skillSecurityReviewRevisionPresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { skillGroup } from './skill';

let skillReadScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let skillWriteScopes = ['instance.skill:write', 'consumer#instance.skill:write'] as const;

let skillSecurityReviewGroup = skillGroup
  .use(hasFlags(['security-reviews-enabled']))
  .use(async ctx => {
    let securityReview = await securityReviewService.getSecurityReviewForSkill({
      instance: ctx.instance,
      skill: ctx.skill.localSkill
    });

    return { securityReview };
  });

export let skillSecurityReviewController = Controller.create(
  {
    name: 'Skill Security Reviews',
    description:
      'A security review assesses what a skill makes an agent do and whether its files can be trusted. Everyone who can read a skill can read its review.'
  },
  {
    get: skillSecurityReviewGroup
      .get(instancePath('skills/:skillId/security-review', 'skills.securityReview.get'), {
        name: 'Get skill security review',
        description:
          "Returns the security review of a skill's latest version. Requests a review if none exists yet."
      })
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .output(skillSecurityReviewPresenter)
      .do(async ctx => skillSecurityReviewPresenter.present(ctx.securityReview)),

    reassess: skillSecurityReviewGroup
      .post(
        instancePath(
          'skills/:skillId/security-review/reassess',
          'skills.securityReview.reassess'
        ),
        {
          name: 'Reassess skill security review',
          description: 'Starts a new review of the skill. Available once every 24 hours.'
        }
      )
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .output(skillSecurityReviewPresenter)
      .do(async ctx => {
        let state = await securityReviewService.reassessSkillSecurityReview({
          review: ctx.securityReview.review
        });

        return skillSecurityReviewPresenter.present(state);
      }),

    dismiss: skillSecurityReviewGroup
      .post(
        instancePath(
          'skills/:skillId/security-review/dismiss',
          'skills.securityReview.dismiss'
        ),
        {
          name: 'Dismiss skill security review',
          description:
            'Stops reviewing the skill. Its verdict becomes `dismissed` and no longer holds back the skill.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.skill.security_review:dismiss'] }))
      .output(skillSecurityReviewPresenter)
      .do(async ctx => {
        let state = await securityReviewService.dismissSkillSecurityReview({
          review: ctx.securityReview.review,
          actorId: ctx.actor!.id,
          auditScope: ctx.auditScope
        });

        return skillSecurityReviewPresenter.present(state);
      }),

    restore: skillSecurityReviewGroup
      .post(
        instancePath(
          'skills/:skillId/security-review/restore',
          'skills.securityReview.restore'
        ),
        {
          name: 'Restore skill security review',
          description: 'Resumes reviewing a dismissed skill and starts a new review.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.skill.security_review:dismiss'] }))
      .output(skillSecurityReviewPresenter)
      .do(async ctx => {
        let state = await securityReviewService.restoreSkillSecurityReview({
          review: ctx.securityReview.review,
          auditScope: ctx.auditScope
        });

        return skillSecurityReviewPresenter.present(state);
      }),

    listRevisions: skillSecurityReviewGroup
      .get(
        instancePath(
          'skills/:skillId/security-review/revisions',
          'skills.securityReview.revisions.list'
        ),
        {
          name: 'List skill security review revisions',
          description:
            "Returns the most recent finished revisions of a skill's security review."
        }
      )
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .outputList(skillSecurityReviewRevisionPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let review = ctx.securityReview.review;
        let paginator = await securityReviewService.listSecurityReviewRevisions({ review });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, revision =>
          skillSecurityReviewRevisionPresenter.present({ review, revision })
        );
      }),

    getRevision: skillSecurityReviewGroup
      .get(
        instancePath(
          'skills/:skillId/security-review/revisions/:revisionId',
          'skills.securityReview.revisions.get'
        ),
        {
          name: 'Get skill security review revision',
          description: "Retrieves a single revision of a skill's security review."
        }
      )
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .output(skillSecurityReviewRevisionPresenter)
      .do(async ctx => {
        if (!ctx.params.revisionId) {
          throw new ServiceError(badRequestError({ message: 'revisionId is required' }));
        }

        let review = ctx.securityReview.review;
        let revision = await securityReviewService.getSecurityReviewRevision({
          review,
          revisionId: ctx.params.revisionId
        });

        return skillSecurityReviewRevisionPresenter.present({ review, revision });
      })
  }
);
