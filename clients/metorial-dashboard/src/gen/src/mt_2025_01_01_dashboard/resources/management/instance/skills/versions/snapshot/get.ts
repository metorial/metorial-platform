import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSkillsVersionsSnapshotGetOutput = {
  object: 'skill.version.snapshot';
  id: string;
  skillId: string;
  storeId: string;
  storeVersionId: string;
  versionNumber: number;
  items: {
    object: 'skill.version.snapshot.item';
    id: string;
    kind: 'file' | 'document' | 'directory';
    path: string;
    fileId: string | null;
    documentId: string | null;
    documentVersionId: string | null;
    content: string | null;
    createdAt: Date;
  }[];
  createdAt: Date;
};

export let mapManagementInstanceSkillsVersionsSnapshotGetOutput =
  mtMap.object<ManagementInstanceSkillsVersionsSnapshotGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    skillId: mtMap.objectField('skill_id', mtMap.passthrough()),
    storeId: mtMap.objectField('store_id', mtMap.passthrough()),
    storeVersionId: mtMap.objectField('store_version_id', mtMap.passthrough()),
    versionNumber: mtMap.objectField('version_number', mtMap.passthrough()),
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          kind: mtMap.objectField('kind', mtMap.passthrough()),
          path: mtMap.objectField('path', mtMap.passthrough()),
          fileId: mtMap.objectField('file_id', mtMap.passthrough()),
          documentId: mtMap.objectField('document_id', mtMap.passthrough()),
          documentVersionId: mtMap.objectField(
            'document_version_id',
            mtMap.passthrough()
          ),
          content: mtMap.objectField('content', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

