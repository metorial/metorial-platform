import { resourceSet } from '../../_lib/resource';
import {
  skillAuditResource,
  skillMarketplaceAuditResource,
  skillPluginAuditResource
} from './skill';
import {
  skillGroupAuditResource,
  skillMergeRequestAuditResource,
  skillTemplateAuditResource
} from './skillGroup';

export let skillResources = resourceSet({
  skill: skillAuditResource,
  skill_plugin: skillPluginAuditResource,
  skill_marketplace: skillMarketplaceAuditResource,
  skill_group: skillGroupAuditResource,
  skill_template: skillTemplateAuditResource,
  skill_merge_request: skillMergeRequestAuditResource
});
