import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSkillsImportsCreateOutput = {
  object: 'skill.import';
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  source:
    | {
        type: 'public';
        repositoryUrl: string;
        repositoryName: string | null;
        ref: string | null;
      }
    | {
        type: 'origin';
        repositoryId: string;
        repositoryName: string | null;
        ref: string | null;
        path: string | null;
      }
    | {
        type: 'file';
        fileId: string | null;
        fileName: string;
        format: 'zip' | 'markdown';
      };
  codeBucketId: string | null;
  error: string | null;
  items: {
    object: 'skill.import.item';
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    path: string;
    error: string | null;
    skill: { id: string; name: string; description: string | null } | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  }[];
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

export let mapManagementInstanceSkillsImportsCreateOutput =
  mtMap.object<ManagementInstanceSkillsImportsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    source: mtMap.objectField(
      'source',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            repositoryUrl: mtMap.objectField(
              'repository_url',
              mtMap.passthrough()
            ),
            repositoryName: mtMap.objectField(
              'repository_name',
              mtMap.passthrough()
            ),
            ref: mtMap.objectField('ref', mtMap.passthrough()),
            repositoryId: mtMap.objectField(
              'repository_id',
              mtMap.passthrough()
            ),
            path: mtMap.objectField('path', mtMap.passthrough()),
            fileId: mtMap.objectField('file_id', mtMap.passthrough()),
            fileName: mtMap.objectField('file_name', mtMap.passthrough()),
            format: mtMap.objectField('format', mtMap.passthrough())
          })
        )
      ])
    ),
    codeBucketId: mtMap.objectField('code_bucket_id', mtMap.passthrough()),
    error: mtMap.objectField('error', mtMap.passthrough()),
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          path: mtMap.objectField('path', mtMap.passthrough()),
          error: mtMap.objectField('error', mtMap.passthrough()),
          skill: mtMap.objectField(
            'skill',
            mtMap.object({
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField('description', mtMap.passthrough())
            })
          ),
          startedAt: mtMap.objectField('started_at', mtMap.date()),
          completedAt: mtMap.objectField('completed_at', mtMap.date()),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    ),
    startedAt: mtMap.objectField('started_at', mtMap.date()),
    completedAt: mtMap.objectField('completed_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

export type ManagementInstanceSkillsImportsCreateBody = {
  source:
    | { type: 'public'; repositoryUrl: string; ref?: string | undefined }
    | {
        type: 'origin';
        repositoryId: string;
        ref?: string | undefined;
        path?: string | undefined;
      }
    | { type: 'file'; fileId: string };
};

export let mapManagementInstanceSkillsImportsCreateBody =
  mtMap.object<ManagementInstanceSkillsImportsCreateBody>({
    source: mtMap.objectField(
      'source',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            repositoryUrl: mtMap.objectField(
              'repository_url',
              mtMap.passthrough()
            ),
            ref: mtMap.objectField('ref', mtMap.passthrough()),
            repositoryId: mtMap.objectField(
              'repository_id',
              mtMap.passthrough()
            ),
            path: mtMap.objectField('path', mtMap.passthrough()),
            fileId: mtMap.objectField('file_id', mtMap.passthrough())
          })
        )
      ])
    )
  });

