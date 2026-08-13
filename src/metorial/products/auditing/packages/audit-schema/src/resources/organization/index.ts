import { resourceSet } from '../../_lib/resource';
import {
  accessPolicyAssignmentResource,
  accessPolicyResource,
  accessRoleResource
} from './access';
import { organizationActorResource } from './actor';
import { organizationInviteResource } from './invite';
import { organizationMemberResource } from './member';
import {
  projectAuthConfigConfigurationResource,
  projectBrandResource,
  projectIntegrationNamingConfigurationResource,
  projectRetentionResource,
  projectToolCallingConfigurationResource
} from './projectSettings';
import { teamMemberResource, teamResource } from './team';

export let organizationResources = resourceSet({
  organization_actor: organizationActorResource,
  organization_member: organizationMemberResource,
  organization_invite: organizationInviteResource,
  team: teamResource,
  team_member: teamMemberResource,
  access_role: accessRoleResource,
  access_policy: accessPolicyResource,
  access_policy_assignment: accessPolicyAssignmentResource,
  project_brand: projectBrandResource,
  project_retention: projectRetentionResource,
  project_auth_config_configuration: projectAuthConfigConfigurationResource,
  project_integration_naming_configuration: projectIntegrationNamingConfigurationResource,
  project_tool_calling_configuration: projectToolCallingConfigurationResource
});
