import { resourceSet } from '../../_lib/resource';
import {
  skillAuditResource,
  skillDestinationAuditResource,
  skillMarketplaceAuditResource,
  skillPluginAuditResource
} from './skill';
import {
  skillGroupAuditResource,
  skillMergeRequestAuditResource,
  skillSecurityReviewAuditResource,
  skillTemplateAuditResource
} from './skillGroup';

export let skillResources = resourceSet({
  skill: skillAuditResource,
  skill_plugin: skillPluginAuditResource,
  skill_marketplace: skillMarketplaceAuditResource,
  skill_group: skillGroupAuditResource,
  skill_template: skillTemplateAuditResource,
  skill_merge_request: skillMergeRequestAuditResource,
  skill_security_review: skillSecurityReviewAuditResource,
  skill_destination: skillDestinationAuditResource
});
