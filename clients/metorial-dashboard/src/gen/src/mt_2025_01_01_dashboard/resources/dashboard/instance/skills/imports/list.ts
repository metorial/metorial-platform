import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSkillsImportsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSkillsImportsListOutput =
  mtMap.object<DashboardInstanceSkillsImportsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
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
          codeBucketId: mtMap.objectField(
            'code_bucket_id',
            mtMap.passthrough()
          ),
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
                    description: mtMap.objectField(
                      'description',
                      mtMap.passthrough()
                    )
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
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type DashboardInstanceSkillsImportsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  status?:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | ('pending' | 'processing' | 'completed' | 'failed')[]
    | undefined;
};

export let mapDashboardInstanceSkillsImportsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      id: mtMap.objectField(
        'id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      )
    })
  )
]);

