import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let skillGroupAuditResource = resource({
  name: 'skill_group',
  payload: v.typedAny<{
    id: string;
    name?: string;
    description?: string | null;
    status?: string;
    allowConsumerSkillAssignment?: boolean;
    skillIds?: string[];
    skillId?: string;
  }>('skill_group'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    archive: true,
    add_skill: true,
    remove_skill: true
  }
});

export let skillTemplateAuditResource = resource({
  name: 'skill_template',
  payload: v.typedAny<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: string;
  }>('skill_template'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    archive: true
  }
});

export let skillMergeRequestAuditResource = resource({
  name: 'skill_merge_request',
  payload: v.typedAny<{
    id: string;
    title: string;
    status: string;
    direction: string;
    sourceSkillId: string;
    targetSkillId: string;
  }>('skill_merge_request'),
  presenter: undefined,
  actions: {
    create: true,
    merge: true,
    close: true,
    rollback: true
  }
});
