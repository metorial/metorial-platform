import {
  badRequestError,
  forbiddenError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillGroupService } from '@metorial/module-skill-groups';
import { skillImportService } from '@metorial/module-skill-import';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess, hasInstanceConsumerAccess } from '../../../lib/cargoAccess';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillImportPresenter } from '@metorial/presenters';

let readScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let writeScopes = ['instance.skill:write', 'consumer#instance.skill:write'] as const;

let statusValidator = v.enumOf(['pending', 'processing', 'completed', 'failed']);
let sourceValidator = v.union([
  v.object({
    type: v.literal('public', {
      description: 'Import from a public repository URL.'
    }),
    repository_url: v.string({
      modifiers: [v.url()],
      description: 'Public repository URL to import from.'
    }),
    ref: v.optional(
      v.string({ description: 'Branch, tag, or commit to import. Defaults to the default branch.' })
    )
  }),
  v.object({
    type: v.literal('origin', {
      description: 'Import from a connected repository.'
    }),
    repository_id: v.string({
      description: 'Connected repository to import from, by ID.'
    }),
    ref: v.optional(
      v.string({ description: 'Branch, tag, or commit to import. Defaults to the default branch.' })
    ),
    path: v.optional(
      v.string({ description: 'Directory within the repository to import.' })
    )
  }),
  v.object({
    type: v.literal('file', {
      description: 'Import from an uploaded file.'
    }),
    file_id: v.string({ description: 'Uploaded file to import, by ID.' })
  })
], {
  description: 'Where to import skills from.'
});

let getAccess = (ctx: any) => getInstanceCargoAccess(ctx);

let getCreateInput = (source: {
  type: 'public' | 'origin' | 'file';
  repository_url?: string;
  repository_id?: string;
  ref?: string;
  path?: string;
  file_id?: string;
}) => {
  if (source.type === 'public') {
    return {
      type: 'public' as const,
      repositoryUrl: source.repository_url!,
      ref: source.ref
    };
  }

  if (source.type === 'origin') {
    return {
      type: 'origin' as const,
      repositoryId: source.repository_id!,
      ref: source.ref,
      path: source.path
    };
  }

  return {
    type: 'file' as const,
    fileId: source.file_id!
  };
};

export let skillImportGroup = instanceGroup
  .use(hasFlags(['skills-enabled']))
  .use(checkAccess({ possibleScopes: [...readScopes] }))
  .use(requireConsumerTokenForPublishableKey())
  .use(async ctx => {
    if (!ctx.params.skillImportId) {
      throw new ServiceError(
        badRequestError({
          message: 'skillImportId is required',
          description: 'The skillImportId path parameter is required.'
        })
      );
    }

    let access = await getAccess(ctx);
    let skillImport = await skillImportService.getSkillImportById({
      ...access,
      skillImportId: ctx.params.skillImportId,
      actor: hasInstanceConsumerAccess(ctx) ? access.actor : undefined
    });

    return { skillImport };
  });

export let skillImportController = Controller.create(
  {
    name: 'Skill Imports',
    description: 'A skill import is a queued import of skills from a repository or uploaded file.'
  },
  {
    list: instanceGroup
      .get(instancePath('skill-imports', 'skills.imports.list'), {
        name: 'List skill imports',
        description: 'Returns a paginated list of skill imports.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillImportPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Only return skill imports with these IDs.'
              })
            ),
            status: v.optional(
              v.union([statusValidator, v.array(statusValidator)], {
                description: 'Only return skill imports with one of these statuses.'
              })
            )
          })
        )
      )
      .do(async ctx => {
        let access = await getAccess(ctx);
        let paginator = await skillImportService.listSkillImports({
          ...access,
          ids: normalizeArrayParam(ctx.query.id),
          statuses: normalizeArrayParam(ctx.query.status),
          actor: hasInstanceConsumerAccess(ctx) ? access.actor : undefined
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillImport =>
          skillImportPresenter.present({ skillImport })
        );
      }),

    get: skillImportGroup
      .get(instancePath('skill-imports/:skillImportId', 'skills.imports.get'), {
        name: 'Get skill import',
        description: 'Retrieves a skill import and its results.'
      })
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .output(skillImportPresenter)
      .do(async ctx => skillImportPresenter.present({ skillImport: ctx.skillImport })),

    create: instanceGroup
      .post(instancePath('skill-imports', 'skills.imports.create'), {
        name: 'Create skill import',
        description: 'Queues a skill import from a repository or uploaded file.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body(
        'default',
        v.object({
          source: sourceValidator,
          skill_group_id: v.optional(
            v.string({
              description: 'The ID of a skill group that every imported skill is added to.'
            })
          )
        })
      )
      .output(skillImportPresenter)
      .do(async ctx => {
        let input = getCreateInput(ctx.body.source);
        if (hasInstanceConsumerAccess(ctx)) {
          if (!ctx.consumerSurface?.allowConsumerSkillAuthoring) {
            throw new ServiceError(
              preconditionFailedError({
                message: 'Consumers are not allowed to import skills on this surface.'
              })
            );
          }
          if (input.type === 'origin') {
            throw new ServiceError(
              forbiddenError({ message: 'Consumers cannot import private repositories' })
            );
          }
        }
        let access = await getAccess(ctx);
        let skillGroup = ctx.body.skill_group_id
          ? await skillGroupService.getSkillGroupById({
              project: access.project,
              instance: access.instance,
              skillGroupId: ctx.body.skill_group_id,
              accessTags: ctx.consumerProfile ? ctx.accessTags : undefined
            })
          : undefined;
        let skillImport = await skillImportService.createSkillImport({
          ...access,
          actor: access.actor,
          skillGroup,
          input
        });

        return skillImportPresenter.present({ skillImport });
      })
  }
);
