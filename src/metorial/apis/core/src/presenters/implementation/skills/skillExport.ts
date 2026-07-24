import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillExportType } from '../../types';
import { v1FilePresenter } from '../files/file';
import { v1FileLinkPresenter } from '../files/fileLink';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from '../files/documentParticipant';

export let v1SkillExportPresenter = Presenter.create(skillExportType)
  .presenter(async ({ skillExport }, opts) => ({
    object: 'skill.export' as const,
    id: skillExport.id,
    target: skillExport.target,
    status: skillExport.status,
    file: skillExport.file
      ? await v1FilePresenter.present({ file: skillExport.file }, opts).run()
      : null,
    file_link: skillExport.fileLink
      ? await v1FileLinkPresenter.present({ fileLink: skillExport.fileLink }, opts).run()
      : null,
    created_by: skillExport.creatorResourceActor
      ? await presentDocumentParticipantActor(skillExport.creatorResourceActor, opts)
      : null,
    created_at: skillExport.createdAt,
    started_at: skillExport.startedAt,
    completed_at: skillExport.completedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.export'),
      id: v.string(),
      target: v.enumOf(['skill', 'plugin', 'marketplace']),
      status: v.enumOf(['pending', 'completed', 'failed']),
      file: v.nullable(v1FilePresenter.schema),
      file_link: v.nullable(v1FileLinkPresenter.schema),
      created_by: v.nullable(documentParticipantActorSchema),
      created_at: v.date(),
      started_at: v.nullable(v.date()),
      completed_at: v.nullable(v.date())
    })
  )
  .build();
