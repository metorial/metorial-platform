import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillMarketplaceRepositoryService } from '@metorial/module-skill-marketplace';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import { skillMarketplaceRepositoryPresenter } from '@metorial/presenters';
import { getSkillMarketplaceAccess, skillMarketplaceGroup } from './skillMarketplace';

let readScopes = ['instance.skill:read'] as const;
let writeScopes = ['instance.skill:write'] as const;

export let skillMarketplaceRepositoryController = Controller.create(
  {
    name: 'Skill Marketplace Repositories',
    description: 'Manage repositories linked to skill marketplaces for an instance.'
  },
  {
    list: skillMarketplaceGroup
      .get(
        instancePath(
          'skill-marketplaces/:skillMarketplaceId/repositories',
          'skills.marketplaces.repositories.list'
        ),
        {
          name: 'List skill marketplace repositories',
          description: 'Returns repositories linked to a skill marketplace.'
        }
      )
      .use(isDashboardGroup())
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .outputList(skillMarketplaceRepositoryPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator =
          await skillMarketplaceRepositoryService.listSkillMarketplaceRepositories({
            ...(await getSkillMarketplaceAccess(ctx)),
            skillMarketplaceId: ctx.skillMarketplace.id
          });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillMarketplaceRepository =>
          skillMarketplaceRepositoryPresenter.present({ skillMarketplaceRepository })
        );
      }),

    get: skillMarketplaceGroup
      .get(
        instancePath(
          'skill-marketplaces/:skillMarketplaceId/repositories/:skillMarketplaceRepositoryId',
          'skills.marketplaces.repositories.get'
        ),
        {
          name: 'Get skill marketplace repository',
          description: 'Retrieves a repository linked to a skill marketplace.'
        }
      )
      .use(isDashboardGroup())
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .output(skillMarketplaceRepositoryPresenter)
      .do(async ctx => {
        let skillMarketplaceRepository =
          await skillMarketplaceRepositoryService.getSkillMarketplaceRepositoryById({
            ...(await getSkillMarketplaceAccess(ctx)),
            skillMarketplaceId: ctx.skillMarketplace.id,
            skillMarketplaceRepositoryId: ctx.params.skillMarketplaceRepositoryId
          });

        return skillMarketplaceRepositoryPresenter.present({ skillMarketplaceRepository });
      }),

    create: skillMarketplaceGroup
      .post(
        instancePath(
          'skill-marketplaces/:skillMarketplaceId/repositories',
          'skills.marketplaces.repositories.create'
        ),
        {
          name: 'Link skill marketplace repository',
          description: 'Links an SCM repository to a skill marketplace.'
        }
      )
      .use(isDashboardGroup())
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body(
        'default',
        v.object({
          repo_id: v.string()
        })
      )
      .output(skillMarketplaceRepositoryPresenter)
      .do(async ctx => {
        let skillMarketplaceRepository =
          await skillMarketplaceRepositoryService.createSkillMarketplaceRepository({
            ...(await getSkillMarketplaceAccess(ctx)),
            skillMarketplaceId: ctx.skillMarketplace.id,
            repoId: ctx.body.repo_id
          });

        return skillMarketplaceRepositoryPresenter.present({ skillMarketplaceRepository });
      }),

    delete: skillMarketplaceGroup
      .delete(
        instancePath(
          'skill-marketplaces/:skillMarketplaceId/repositories/:skillMarketplaceRepositoryId',
          'skills.marketplaces.repositories.delete'
        ),
        {
          name: 'Unlink skill marketplace repository',
          description: 'Unlinks an SCM repository from a skill marketplace.'
        }
      )
      .use(isDashboardGroup())
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .output(skillMarketplaceRepositoryPresenter)
      .do(async ctx => {
        let skillMarketplaceRepository =
          await skillMarketplaceRepositoryService.deleteSkillMarketplaceRepository({
            ...(await getSkillMarketplaceAccess(ctx)),
            skillMarketplaceId: ctx.skillMarketplace.id,
            skillMarketplaceRepositoryId: ctx.params.skillMarketplaceRepositoryId
          });

        return skillMarketplaceRepositoryPresenter.present({ skillMarketplaceRepository });
      })
  }
);
