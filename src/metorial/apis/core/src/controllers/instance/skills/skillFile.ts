import { Paginator } from '@lowerdeck/pagination';
import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import { type SkillFileChange, skillFileService } from '@metorial/module-skill';
import {
  skillFileChangePresenter,
  skillFileContentPresenter,
  skillFilePresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillGroup } from './skill';

let skillReadScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let skillWriteScopes = ['instance.skill:write', 'consumer#instance.skill:write'] as const;

let pathValidator = v.string({
  description:
    'Path of the file inside the skill. A leading "/" is optional. Paths may contain letters, numbers, spaces and the characters . _ - ( ) $.',
  examples: ['/SKILL.md', 'references/api.md']
});

let putIfMatchValidator = v.optional(
  v.nullable(
    v.string({
      description:
        'Only apply the change if the file still has this etag. Pass null to require that no file exists at the path yet. Omit to skip the check.'
    })
  )
);

let existingIfMatchValidator = v.optional(
  v.string({
    description:
      'Only apply the change if the file still has this etag. Omit to skip the check.'
  })
);

let contentValidator = v.optional(
  v.string({
    description:
      'The new text content of the file. Markdown files are stored as documents, other files as plain text files.'
  })
);

let fileIdValidator = v.optional(
  v.string({
    description:
      'The ID of a previously uploaded file to place at the path. Use this for binary files. Files that belong to a document cannot be attached; use content to write markdown documents.'
  })
);

let toPathValidator = v.string({
  description: 'The new path of the file.',
  examples: ['/references/renamed.md']
});

let putChangeFields = {
  path: pathValidator,
  content: contentValidator,
  file_id: fileIdValidator,
  if_match: putIfMatchValidator
};

let deleteChangeFields = {
  path: pathValidator,
  if_match: existingIfMatchValidator
};

let moveChangeFields = {
  path: pathValidator,
  to_path: toPathValidator,
  if_match: existingIfMatchValidator
};

let skillFileChangeValidator = v.union([
  v.object({ type: v.literal('put'), ...putChangeFields }),
  v.object({ type: v.literal('delete'), ...deleteChangeFields }),
  v.object({ type: v.literal('move'), ...moveChangeFields })
]);

let toSkillFileChange = (
  change: ValidationTypeValue<typeof skillFileChangeValidator>
): SkillFileChange => {
  switch (change.type) {
    case 'put':
      return {
        type: 'put',
        path: change.path,
        content: change.content,
        fileId: change.file_id,
        ifMatch: change.if_match
      };
    case 'delete':
      return { type: 'delete', path: change.path, ifMatch: change.if_match };
    case 'move':
      return {
        type: 'move',
        path: change.path,
        toPath: change.to_path,
        ifMatch: change.if_match
      };
  }
};

export let skillFileController = Controller.create(
  {
    name: 'Skill Files',
    description: 'Read and edit the files of a skill by path.'
  },
  {
    list: skillGroup
      .get(instancePath('skills/:skillId/files', 'skills.files.list'), {
        name: 'List skill files',
        description:
          'Lists every file of a skill with its path, size and etag. Directories are implied by file paths.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillFilePresenter)
      .do(async ctx => {
        let skillFiles = await skillFileService.listSkillFiles({
          ...(await getInstanceCargoAccess(ctx)),
          skill: ctx.skill.localSkill
        });

        return Paginator.present(
          { items: skillFiles, pagination: { hasNextPage: false, hasPreviousPage: false } },
          skillFile => skillFilePresenter.present({ skillFile, skill: ctx.skill })
        );
      }),

    get: skillGroup
      .get(instancePath('skills/:skillId/files/content', 'skills.files.get'), {
        name: 'Get skill file',
        description:
          'Retrieves a single skill file by path. Documents include their text content, other files include a download URL.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .query('default', v.object({ path: pathValidator }))
      .output(skillFileContentPresenter)
      .do(async ctx => {
        let skillFileContent = await skillFileService.getSkillFile({
          ...(await getInstanceCargoAccess(ctx)),
          skill: ctx.skill.localSkill,
          path: ctx.query.path
        });

        return skillFileContentPresenter.present({ skillFileContent, skill: ctx.skill });
      }),

    put: skillGroup
      .put(instancePath('skills/:skillId/files', 'skills.files.put'), {
        name: 'Write skill file',
        description:
          'Creates or replaces the file at a path. Parent directories are created automatically.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body('default', v.object(putChangeFields))
      .output(skillFileChangePresenter)
      .do(async ctx => {
        let skillFileChange = await skillFileService.applySkillFileChange({
          ...(await getInstanceCargoAccess(ctx)),
          skill: ctx.skill.localSkill,
          change: toSkillFileChange({ type: 'put', ...ctx.body })
        });

        return skillFileChangePresenter.present({ skillFileChange, skill: ctx.skill });
      }),

    delete: skillGroup
      .delete(instancePath('skills/:skillId/files', 'skills.files.delete'), {
        name: 'Delete skill file',
        description:
          'Deletes the file at a path. Directories that were created automatically and become empty are removed. The root SKILL.md cannot be deleted.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .query('default', v.object(deleteChangeFields))
      .output(skillFileChangePresenter)
      .do(async ctx => {
        let skillFileChange = await skillFileService.applySkillFileChange({
          ...(await getInstanceCargoAccess(ctx)),
          skill: ctx.skill.localSkill,
          change: toSkillFileChange({ type: 'delete', ...ctx.query })
        });

        return skillFileChangePresenter.present({ skillFileChange, skill: ctx.skill });
      }),

    move: skillGroup
      .post(instancePath('skills/:skillId/files/move', 'skills.files.move'), {
        name: 'Move skill file',
        description: 'Moves or renames a file. The root SKILL.md cannot be moved.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body('default', v.object(moveChangeFields))
      .output(skillFileChangePresenter)
      .do(async ctx => {
        let skillFileChange = await skillFileService.applySkillFileChange({
          ...(await getInstanceCargoAccess(ctx)),
          skill: ctx.skill.localSkill,
          change: toSkillFileChange({ type: 'move', ...ctx.body })
        });

        return skillFileChangePresenter.present({ skillFileChange, skill: ctx.skill });
      }),

    batch: skillGroup
      .post(instancePath('skills/:skillId/files/batch', 'skills.files.batch'), {
        name: 'Apply skill file changes',
        description:
          'Applies up to 100 put, delete and move changes one after another, in order. Every change is validated before any is applied, but changes are not applied atomically: if a change fails while being applied, the changes before it stay applied. Every change can carry its own if_match precondition.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body(
        'default',
        v.object({
          changes: v.array(skillFileChangeValidator, {
            description: 'The changes to apply, in order.'
          })
        })
      )
      .outputList(skillFileChangePresenter)
      .do(async ctx => {
        let changes = await skillFileService.applySkillFileChanges({
          ...(await getInstanceCargoAccess(ctx)),
          skill: ctx.skill.localSkill,
          changes: ctx.body.changes.map(toSkillFileChange)
        });

        return Paginator.present(
          { items: changes, pagination: { hasNextPage: false, hasPreviousPage: false } },
          skillFileChange =>
            skillFileChangePresenter.present({ skillFileChange, skill: ctx.skill })
        );
      })
  }
);
