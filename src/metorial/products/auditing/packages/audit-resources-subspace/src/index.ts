import { resourceSet } from '@metorial/audit-stash';
import {
  providerAuthConfigAuditResource,
  providerAuthCredentialsAuditResource,
  providerAuthExportAuditResource,
  providerAuthImportAuditResource,
  providerSetupSessionAuditResource
} from './auth';
import {
  customProviderAuditResource,
  customProviderCommitAuditResource,
  customProviderVersionAuditResource,
  scmRepositoryAuditResource
} from './customProvider';
import {
  providerConfigAuditResource,
  providerConfigVaultAuditResource,
  providerDeploymentAuditResource
} from './deployment';
import {
  agentAuditResource,
  agentClientAuditResource,
  identityActorAuditResource,
  identityAuditResource,
  identityCredentialAuditResource,
  identityDelegationAuditResource,
  identityDelegationConfigAuditResource
} from './identity';
import { integrationAuditResource, integrationInstanceAuditResource } from './integration';
import {
  integrationInstanceGroupAuditResource,
  integrationInstanceGroupProviderAuditResource,
  integrationInstanceProviderAuditResource,
  integrationProviderAuditResource,
  integrationSetupSessionAuditResource
} from './integrationProvider';
import { sessionConnectionAuditResource, sessionMessageAuditResource } from './message';
import {
  firewallAuditResource,
  firewallBindingAuditResource,
  networkPolicyAuditResource
} from './network';
import {
  protoGuardAlertAuditResource,
  protoGuardAlertThresholdAuditResource,
  protoGuardFilterSettingAuditResource
} from './protoguard';
import {
  providerListingGroupAuditResource,
  providerListingGroupListingAuditResource
} from './providerListingGroup';
import {
  sessionAuditResource,
  sessionProviderAuditResource,
  sessionTemplateAuditResource,
  sessionTemplateProviderAuditResource
} from './session';

export * from './_shared';
export type {
  SubspaceMessageProviderSummary,
  SubspaceMessageToolCallSummary
} from './message';
export type { SubspaceFirewallPolicyLinkSummary } from './network';
export type { SubspaceSessionProviderSummary } from './session';

/**
 * The subspace slice of the audit schema. None of these carry a presenter, which keeps
 * this file free of `@metorial/presenters` -- processes that only emit subspace events,
 * such as the conduit worker, import this set on its own rather than the combined one.
 */
export let subspaceAuditResources = resourceSet({
  provider_auth_config: providerAuthConfigAuditResource,
  provider_auth_credentials: providerAuthCredentialsAuditResource,
  provider_setup_session: providerSetupSessionAuditResource,
  provider_auth_export: providerAuthExportAuditResource,
  provider_auth_import: providerAuthImportAuditResource,

  provider_deployment: providerDeploymentAuditResource,
  provider_config: providerConfigAuditResource,
  provider_config_vault: providerConfigVaultAuditResource,

  integration: integrationAuditResource,
  integration_instance: integrationInstanceAuditResource,
  integration_provider: integrationProviderAuditResource,
  integration_instance_group: integrationInstanceGroupAuditResource,
  integration_instance_provider: integrationInstanceProviderAuditResource,
  integration_instance_group_provider: integrationInstanceGroupProviderAuditResource,
  integration_setup_session: integrationSetupSessionAuditResource,

  session: sessionAuditResource,
  session_provider: sessionProviderAuditResource,
  session_template: sessionTemplateAuditResource,
  session_template_provider: sessionTemplateProviderAuditResource,
  custom_provider: customProviderAuditResource,
  custom_provider_version: customProviderVersionAuditResource,
  custom_provider_commit: customProviderCommitAuditResource,
  scm_repository: scmRepositoryAuditResource,

  agent: agentAuditResource,
  agent_client: agentClientAuditResource,
  identity: identityAuditResource,
  identity_actor: identityActorAuditResource,
  identity_credential: identityCredentialAuditResource,
  identity_delegation: identityDelegationAuditResource,
  identity_delegation_config: identityDelegationConfigAuditResource,

  provider_listing_group: providerListingGroupAuditResource,
  provider_listing_group_listing: providerListingGroupListingAuditResource,

  firewall: firewallAuditResource,
  firewall_binding: firewallBindingAuditResource,
  network_policy: networkPolicyAuditResource,

  session_connection: sessionConnectionAuditResource,
  session_message: sessionMessageAuditResource,

  protoguard_filter_setting: protoGuardFilterSettingAuditResource,
  protoguard_alert_threshold: protoGuardAlertThresholdAuditResource,
  protoguard_alert: protoGuardAlertAuditResource
});
