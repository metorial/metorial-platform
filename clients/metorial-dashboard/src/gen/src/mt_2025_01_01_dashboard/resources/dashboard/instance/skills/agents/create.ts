import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSkillsAgentsCreateOutput = {
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
};

export let mapDashboardInstanceSkillsAgentsCreateOutput =
  mtMap.object<DashboardInstanceSkillsAgentsCreateOutput>({
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
  });

export type DashboardInstanceSkillsAgentsCreateBody = {
  name: string;
  description?: string | null | undefined;
  content?: string | undefined;
};

export let mapDashboardInstanceSkillsAgentsCreateBody =
  mtMap.object<DashboardInstanceSkillsAgentsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    content: mtMap.objectField('content', mtMap.passthrough())
  });

