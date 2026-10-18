import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let skillAuditResource = resource({
  name: 'skill',
  payload: v.typedAny<{
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
    status: string;
    license: string | null;
    compatibility: string | null;
    parentSkillId?: string | null;
    parentSkillTemplateId?: string | null;
    cloneType?: 'fork' | 'duplicate' | null;
  }>('skill'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    archive: true
  }
});

export let skillPluginAuditResource = resource({
  name: 'skill_plugin',
  payload: v.typedAny<{
    id: string;
    name: string | null;
    slug: string | null;
    description: string | null;
    category: string | null;
    status: string;
  }>('skill_plugin'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    archive: true
  }
});

export let skillMarketplaceAuditResource = resource({
  name: 'skill_marketplace',
  payload: v.typedAny<{
    id: string;
    name: string | null;
    slug: string | null;
    description: string | null;
    status: string;
    repositoryAccessMode: string;
    forceMergeOrPush: boolean;
    mergeBeforeChecksPass: boolean;
  }>('skill_marketplace'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    archive: true
  }
});
