import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSkillsSyncsListOutput = {
  items: {
    object: 'skill.sync';
    id: string;
    status:
      | 'pending'
      | 'completed'
      | 'failed'
      | 'processing'
      | 'waiting_for_review'
      | 'canceled';
    skillMarketplaceId: string | null;
    skillPluginId: string | null;
    logs: { timestamp: Date; message: string }[];
    repositoryPropagations: {
      object: 'skill.sync_repository_propagation';
      id: string;
      status:
        | 'pending'
        | 'processing'
        | 'waiting_for_review'
        | 'completed'
        | 'failed'
        | 'canceled';
      repoId: string;
      repositoryAccessMode: 'pull_request' | 'default_branch';
      branchName: string;
      prName: string;
      prDescription: string | null;
      commitMessage: string | null;
      errorMessage: string | null;
      createdAt: Date;
      updatedAt: Date;
      startedAt: Date | null;
      completedAt: Date | null;
    }[];
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSkillsSyncsListOutput =
  mtMap.object<DashboardInstanceSkillsSyncsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          skillMarketplaceId: mtMap.objectField(
            'skill_marketplace_id',
            mtMap.passthrough()
          ),
          skillPluginId: mtMap.objectField(
            'skill_plugin_id',
            mtMap.passthrough()
          ),
          logs: mtMap.objectField(
            'logs',
            mtMap.array(
              mtMap.object({
                timestamp: mtMap.objectField('timestamp', mtMap.date()),
                message: mtMap.objectField('message', mtMap.passthrough())
              })
            )
          ),
          repositoryPropagations: mtMap.objectField(
            'repository_propagations',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                repoId: mtMap.objectField('repo_id', mtMap.passthrough()),
                repositoryAccessMode: mtMap.objectField(
                  'repository_access_mode',
                  mtMap.passthrough()
                ),
                branchName: mtMap.objectField(
                  'branch_name',
                  mtMap.passthrough()
                ),
                prName: mtMap.objectField('pr_name', mtMap.passthrough()),
                prDescription: mtMap.objectField(
                  'pr_description',
                  mtMap.passthrough()
                ),
                commitMessage: mtMap.objectField(
                  'commit_message',
                  mtMap.passthrough()
                ),
                errorMessage: mtMap.objectField(
                  'error_message',
                  mtMap.passthrough()
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date()),
                startedAt: mtMap.objectField('started_at', mtMap.date()),
                completedAt: mtMap.objectField('completed_at', mtMap.date())
              })
            )
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          startedAt: mtMap.objectField('started_at', mtMap.date()),
          completedAt: mtMap.objectField('completed_at', mtMap.date())
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

export type DashboardInstanceSkillsSyncsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  skillMarketplaceId?: string | string[] | undefined;
  skillPluginId?: string | string[] | undefined;
  status?:
    | 'pending'
    | 'completed'
    | 'failed'
    | 'processing'
    | 'waiting_for_review'
    | 'canceled'
    | (
        | 'pending'
        | 'completed'
        | 'failed'
        | 'processing'
        | 'waiting_for_review'
        | 'canceled'
      )[]
    | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceSkillsSyncsListQuery = mtMap.union([
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
      skillMarketplaceId: mtMap.objectField(
        'skill_marketplace_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      skillPluginId: mtMap.objectField(
        'skill_plugin_id',
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
      ),
      createdAt: mtMap.objectField(
        'created_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      )
    })
  )
]);

