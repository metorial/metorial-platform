import { resourceSet } from '../../_lib/resource';
import {
  consumerAuditResource,
  consumerProfileAuditResource,
  consumerProfileGroupAuditResource
} from './consumer';
import {
  consumerAccessAuditResource,
  consumerAccessListingAuditResource
} from './consumerAccess';
import { consumerAccessRequestAuditResource } from './consumerAccessRequest';
import { consumerGroupAuditResource } from './consumerGroup';
import { consumerInviteAuditResource } from './consumerInvite';
import {
  consumerProviderDeploymentAuditResource,
  consumerSurfaceProviderGroupAuditResource,
  consumerSurfaceProviderGroupListingAuditResource
} from './consumerProvider';
import { consumerProviderSetupSessionAuditResource } from './consumerProviderSetupSession';
import { consumerSessionAuditResource } from './consumerSession';
import { consumerSurfaceAuditResource } from './consumerSurface';
import {
  magicMcpEndpointAuditResource,
  magicMcpEndpointServersAuditResource,
  magicMcpGroupAuditResource,
  magicMcpGroupServersAuditResource,
  magicMcpServerAuditResource,
  magicMcpTokenAuditResource,
  providerTemplateAuditResource
} from './magicMcp';
import { portalAuditResource } from './portal';

export let workforceResources = resourceSet({
  consumer: consumerAuditResource,
  consumer_profile: consumerProfileAuditResource,
  consumer_profile_group: consumerProfileGroupAuditResource,
  consumer_group: consumerGroupAuditResource,
  consumer_invite: consumerInviteAuditResource,
  consumer_surface: consumerSurfaceAuditResource,
  consumer_session: consumerSessionAuditResource,
  consumer_access: consumerAccessAuditResource,
  consumer_access_listing: consumerAccessListingAuditResource,
  consumer_access_request: consumerAccessRequestAuditResource,
  consumer_provider_setup_session: consumerProviderSetupSessionAuditResource,
  consumer_provider_deployment: consumerProviderDeploymentAuditResource,
  consumer_surface_provider_group: consumerSurfaceProviderGroupAuditResource,
  consumer_surface_provider_group_listing:
    consumerSurfaceProviderGroupListingAuditResource,
  portal: portalAuditResource,
  magic_mcp_server: magicMcpServerAuditResource,
  magic_mcp_endpoint: magicMcpEndpointAuditResource,
  magic_mcp_endpoint_servers: magicMcpEndpointServersAuditResource,
  magic_mcp_group: magicMcpGroupAuditResource,
  magic_mcp_group_servers: magicMcpGroupServersAuditResource,
  magic_mcp_token: magicMcpTokenAuditResource,
  provider_template: providerTemplateAuditResource
});
