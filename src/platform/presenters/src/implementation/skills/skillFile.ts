import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import type { SkillFile } from '@metorial/module-skill';
import { skillFileChangeType, skillFileContentType, skillFileType } from '../../types';

let presentSkillFile = (d: { skillFile: SkillFile; skill: { id: string } }) => ({
  object: 'skill.file' as const,

  path: d.skillFile.path,
  kind: d.skillFile.kind,
  size: d.skillFile.size,
  etag: d.skillFile.etag,
  skill_id: d.skill.id,
  store_item_id: d.skillFile.storeItemId,
  document_id: d.skillFile.documentId,
  file_id: d.skillFile.fileId,
  updated_at: d.skillFile.updatedAt
});

let skillFileSchemaProperties = {
  object: v.literal('skill.file', {
    description: "String representing the object's type"
  }),
  path: v.string({
    description: 'Path of the file inside the skill, always starting with "/".',
    examples: ['/SKILL.md', '/references/api.md']
  }),
  kind: v.enumOf(['document', 'file'], {
    description:
      'Markdown written with `content` is stored as a collaboratively editable document; everything else, including attached files, is stored as a file.'
  }),
  size: v.number({
    description: 'Size of the file content in bytes.'
  }),
  etag: v.string({
    description:
      'Opaque version identifier of the file content. Pass it as `if_match` when writing to avoid overwriting changes made by others. The check is best-effort: a live collaborative edit landing between the check and the write is not detected. Listings do not flush pending live edits, so a listed etag can lag behind the one returned when fetching the file.'
  }),
  skill_id: v.string({
    description: 'The ID of the skill the file belongs to.'
  }),
  store_item_id: v.string({
    description: 'The ID of the store item backing this file.'
  }),
  document_id: v.nullable(
    v.string({
      description: 'The ID of the backing document, for files of kind `document`.'
    })
  ),
  file_id: v.nullable(
    v.string({
      description: 'The ID of the backing file, for files of kind `file`.'
    })
  ),
  updated_at: v.date({
    description: 'When the file was last changed.'
  })
};

export let v1SkillFilePresenter = Presenter.create(skillFileType)
  .presenter(async ({ skillFile, skill }) => presentSkillFile({ skillFile, skill }))
  .schema(v.object(skillFileSchemaProperties))
  .build();

export let v1SkillFileContentPresenter = Presenter.create(skillFileContentType)
  .presenter(async ({ skillFileContent, skill }) => ({
    ...presentSkillFile({ skillFile: skillFileContent, skill }),
    object: 'skill.file_content' as const,
    content: skillFileContent.content,
    download_url: skillFileContent.downloadUrl
  }))
  .schema(
    v.object({
      ...skillFileSchemaProperties,
      object: v.literal('skill.file_content', {
        description: "String representing the object's type"
      }),
      content: v.nullable(
        v.string({
          description: 'The text content of the file, for files of kind `document`.'
        })
      ),
      download_url: v.nullable(
        v.string({
          description:
            'A short-lived URL to download the file content, for files of kind `file`.'
        })
      )
    })
  )
  .build();

export let v1SkillFileChangePresenter = Presenter.create(skillFileChangeType)
  .presenter(async ({ skillFileChange, skill }, opts) => ({
    object: 'skill.file_change' as const,
    type: skillFileChange.type,
    path: skillFileChange.path,
    previous_path: skillFileChange.previousPath,
    file: skillFileChange.file
      ? await v1SkillFilePresenter
          .present({ skillFile: skillFileChange.file, skill }, opts)
          .run()
      : null
  }))
  .schema(
    v.object({
      object: v.literal('skill.file_change', {
        description: "String representing the object's type"
      }),
      type: v.enumOf(['put', 'delete', 'move'], {
        description: 'The kind of change that was applied.'
      }),
      path: v.string({
        description: 'The resulting path of the file. For moves, this is the new path.'
      }),
      previous_path: v.nullable(
        v.string({
          description: 'The path the file was moved from. Only set for moves.'
        })
      ),
      file: v.nullable(v1SkillFilePresenter.schema)
    })
  )
  .build();
