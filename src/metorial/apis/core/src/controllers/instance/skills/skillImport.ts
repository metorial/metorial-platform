import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillImportService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import { skillImportPresenter } from '../../../presenters';

let readScopes = ['instance.skill:read'] as const;
let writeScopes = ['instance.skill:write'] as const;

let statusValidator = v.enumOf(['pending', 'processing', 'completed', 'failed']);
let sourceValidator = v.union([
  v.object({
    type: v.literal('public'),
    repository_url: v.string({ modifiers: [v.url()] }),
    ref: v.optional(v.string())
  }),
  v.object({
    type: v.literal('origin'),
    repository_id: v.string(),
    ref: v.optional(v.string()),
    path: v.optional(v.string())
  })
]);

let getAccess = (ctx: any) => ({
  owner: {
    type: 'instance' as const,
    instance: ctx.instance,
    organization: ctx.organization
  },
  ...getInstanceCargoAccess(ctx)
});

let getCreateInput = (source: {
  type: 'public' | 'origin';
  repository_url?: string;
  repository_id?: string;
  ref?: string;
  path?: string;
}) => {
  if (source.type === 'public') {
    return {
      type: 'public' as const,
      repositoryUrl: source.repository_url!,
      ref: source.ref
    };
  }

  return {
    type: 'origin' as const,
    repositoryId: source.repository_id!,
    ref: source.ref,
    path: source.path
  };
};

export let skillImportGroup = instanceGroup
  .use(hasFlags(['skills-enabled']))
  .use(isDashboardGroup())
  .use(checkAccess({ possibleScopes: [...readScopes] }))
  .use(async ctx => {
    if (!ctx.params.skillImportId) {
      throw new ServiceError(
        badRequestError({
          message: 'skillImportId is required',
          description: 'The skillImportId path parameter is required.'
        })
      );
    }

    let skillImport = await skillImportService.getSkillImportById({
      ...getAccess(ctx),
      skillImportId: ctx.params.skillImportId,
      filterByCreator: false
    });

    return { skillImport };
  });

export let skillImportController = Controller.create(
  {
    name: 'Skill Imports',
    description: 'Import skills from public or configured source repositories.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('skill-imports', 'skills.imports.list'), {
        name: 'List skill imports',
        description: 'Returns a paginated list of skill imports.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(isDashboardGroup())
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .outputList(skillImportPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            status: v.optional(v.union([statusValidator, v.array(statusValidator)]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await skillImportService.listSkillImports({
          ...getAccess(ctx),
          ids: normalizeArrayParam(ctx.query.id),
          statuses: normalizeArrayParam(ctx.query.status),
          filterByCreator: false
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillImport =>
          skillImportPresenter.present({ skillImport })
        );
      }),

    get: skillImportGroup
      .get(instancePath('skill-imports/:skillImportId', 'skills.imports.get'), {
        name: 'Get skill import',
        description: 'Retrieves an individual skill import and its results.'
      })
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .output(skillImportPresenter)
      .do(async ctx => skillImportPresenter.present({ skillImport: ctx.skillImport })),

    create: instanceGroup
      .post(instancePath('skill-imports', 'skills.imports.create'), {
        name: 'Create skill import',
        description: 'Queues a skill import from a public or configured source repository.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(isDashboardGroup())
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body('default', v.object({ source: sourceValidator }))
      .output(skillImportPresenter)
      .do(async ctx => {
        let skillImport = await skillImportService.createSkillImport({
          ...getAccess(ctx),
          input: getCreateInput(ctx.body.source)
        });

        return skillImportPresenter.present({ skillImport });
      })
  }
);
