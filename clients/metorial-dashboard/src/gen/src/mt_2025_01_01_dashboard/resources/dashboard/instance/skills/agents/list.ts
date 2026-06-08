import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSkillsAgentsListOutput = {
  items: {
    object: 'skill.agent';
    id: string;
    skillId: string;
    name: string;
    description: string | null;
    slug: string;
    status: 'active' | 'archived';
    storeId: string;
    storeItemId: string | null;
    path: string | null;
    documentId: string;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSkillsAgentsListOutput =
  mtMap.object<DashboardInstanceSkillsAgentsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          skillId: mtMap.objectField('skill_id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          slug: mtMap.objectField('slug', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          storeId: mtMap.objectField('store_id', mtMap.passthrough()),
          storeItemId: mtMap.objectField('store_item_id', mtMap.passthrough()),
          path: mtMap.objectField('path', mtMap.passthrough()),
          documentId: mtMap.objectField('document_id', mtMap.passthrough()),
          archivedAt: mtMap.objectField('archived_at', mtMap.date()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
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

export type DashboardInstanceSkillsAgentsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { includeArchived?: boolean | undefined };

export let mapDashboardInstanceSkillsAgentsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      includeArchived: mtMap.objectField(
        'include_archived',
        mtMap.passthrough()
      )
    })
  )
]);

