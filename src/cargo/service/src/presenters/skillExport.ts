import type { SkillExportRecord } from '@metorial-cargo/module-skill';
import { actorPresenter } from './actor';
import { filePresenter } from './file';
import { fileLinkPresenter } from './fileLink';
import { fileReferencePresenter } from './fileReference';

export let skillExportPresenter = (skillExport: SkillExportRecord) => ({
  object: 'cargo#skillExport',
  id: skillExport.id,
  target: skillExport.target,
  status: skillExport.status,
  ref: {
    hash: skillExport.exportRef.hash,
    skillId: skillExport.exportRef.skill?.id,
    managedSkillPluginId: skillExport.exportRef.managedSkillPlugin?.id,
    skillPluginId: skillExport.exportRef.skillPlugin?.id,
    skillMarketplaceId: skillExport.exportRef.skillMarketplace?.id,
    fileDestinationTag: skillExport.exportRef.fileDestinationTag
  },
  file: skillExport.file ? filePresenter(skillExport.file) : null,
  fileLink: skillExport.fileLink ? fileLinkPresenter(skillExport.fileLink) : null,
  fileReference: skillExport.fileReference
    ? fileReferencePresenter(skillExport.fileReference)
    : null,
  createdBy: skillExport.creatorTenantActor
    ? actorPresenter(skillExport.creatorTenantActor)
    : null,
  createdAt: skillExport.createdAt,
  startedAt: skillExport.startedAt,
  completedAt: skillExport.completedAt
});
