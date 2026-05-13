import { Cases } from '@lowerdeck/case';
import { Scope } from './scopeValues';

export type ScopeDefinition = {
  identifier: Scope;
  name: string;
  description: string;
  dependencies: Scope[];
};

let scopeResourceMetadata: Record<string, { name: string; description: string }> = {
  user: {
    name: 'Users',
    description: 'These endpoints manage user profile and account data.'
  },
  organization: {
    name: 'Organizations',
    description: 'These endpoints manage organizations and their top-level settings.'
  },
  'organization.invite': {
    name: 'Organization Invites',
    description: 'These endpoints create and manage organization invitations.'
  },
  'organization.project': {
    name: 'Organization Projects',
    description: 'These endpoints manage projects inside an organization.'
  },
  'organization.member': {
    name: 'Organization Members',
    description: 'These endpoints manage organization membership and member state.'
  },
  'organization.instance': {
    name: 'Organization Instances',
    description: 'These endpoints manage instance records that belong to an organization.'
  },
  'organization.team': {
    name: 'Organization Teams',
    description: 'These endpoints manage team records and assignments.'
  },
  'organization.api_key': {
    name: 'Organization API Keys',
    description: 'These endpoints manage organization and instance API keys.'
  },
  'organization.oauth_app': {
    name: 'OAuth Apps',
    description: 'These endpoints manage OAuth applications owned by an organization.'
  },
  'organization.oauth_installation': {
    name: 'OAuth Installations',
    description: 'These endpoints manage OAuth app installations for an organization.'
  },
  'organization.oauth_authorization': {
    name: 'OAuth Authorizations',
    description: 'These endpoints manage OAuth authorizations for an organization.'
  },
  'instance.file': {
    name: 'Instance Files',
    description: 'These endpoints manage files uploaded within an instance.'
  },
  'instance.file_link': {
    name: 'Instance File Links',
    description: 'These endpoints manage file link records and access links.'
  },
  'consumer#organization': {
    name: 'Consumer Organizations',
    description: 'These endpoints expose organization information for consumers.'
  },
  'consumer#project': {
    name: 'Consumer Projects',
    description: 'These endpoints expose project information for consumers.'
  },
  'consumer#instance': {
    name: 'Consumer Instances',
    description: 'These endpoints expose instance information for consumers.'
  },
  'consumer#instance.file': {
    name: 'Consumer Files',
    description: 'These endpoints manage consumer access to instance files.'
  },
  'consumer#instance.file_link': {
    name: 'Consumer File Links',
    description: 'These endpoints manage consumer access to instance file links.'
  },
  'consumer#instance.portal': {
    name: 'Consumer Portals',
    description: 'These endpoints expose portal information for consumers.'
  },
  'consumer#instance.profile': {
    name: 'Consumer Profiles',
    description: 'These endpoints expose the authenticated consumer profile.'
  },
  'consumer#instance.document': {
    name: 'Consumer Documents',
    description: 'These endpoints manage consumer access to instance documents.'
  },
  'consumer#instance.store': {
    name: 'Consumer Stores',
    description: 'These endpoints manage consumer read access to instance stores.'
  },
  'instance.secret': {
    name: 'Instance Secrets',
    description: 'These endpoints manage instance-level secret values.'
  },
  'instance.assistant': {
    name: 'Assistants',
    description: 'These endpoints list assistants and read assistant metadata in an instance.'
  },
  'instance.assistant.conversation': {
    name: 'Assistant Conversations',
    description: 'These endpoints manage assistant conversations and messages in an instance.'
  },
  'instance.skill': {
    name: 'Skills',
    description: 'These endpoints manage skills, skill items, templates, and template items.'
  },
  'instance.session': {
    name: 'Sessions',
    description: 'These endpoints manage session records and session lifecycle.'
  },
  'instance.provider_oauth.connection': {
    name: 'Provider OAuth Connections',
    description: 'These endpoints manage OAuth connections to external provider accounts.'
  },
  'instance.provider_oauth.session': {
    name: 'Provider OAuth Sessions',
    description: 'These endpoints manage OAuth setup and callback sessions.'
  },
  'instance.provider_oauth.connection.authentication': {
    name: 'OAuth Connection Authentications',
    description: 'These endpoints expose authentication entries for OAuth connections.'
  },
  'instance.provider_oauth.connection.event': {
    name: 'OAuth Connection Events',
    description: 'These endpoints expose lifecycle and audit events for OAuth connections.'
  },
  'instance.provider_oauth.connection.profile': {
    name: 'OAuth Connection Profiles',
    description: 'These endpoints expose provider account profiles linked through OAuth.'
  },
  'instance.provider_oauth.takeout': {
    name: 'OAuth Takeout',
    description: 'These endpoints export OAuth credentials and related data.'
  },
  'instance.provider_oauth.takeIn': {
    name: 'OAuth Take-In',
    description: 'These endpoints import OAuth credentials and related data.'
  },
  'instance.custom_server': {
    name: 'Custom Servers',
    description: 'These endpoints manage custom server definitions in an instance.'
  },
  'instance.callback': {
    name: 'Callbacks',
    description: 'These endpoints manage callback registrations and callback processing.'
  },
  'instance.server.config_vault': {
    name: 'Server Config Vaults',
    description: 'These endpoints manage secure server configuration vault values.'
  },
  'instance.ssoTenant': {
    name: 'SSO Tenants',
    description: 'These endpoints manage SSO tenant configuration and setup.'
  },
  'instance.portal': {
    name: 'Portal',
    description: 'These endpoints manage portal-level configuration for an instance.'
  },
  'instance.portal.access': {
    name: 'Portal Access',
    description: 'These endpoints manage portal access rules and grants.'
  },
  'instance.portal.consumers': {
    name: 'Portal Consumers',
    description: 'These endpoints manage portal consumer entities and assignments.'
  },
  'instance.portal.auth': {
    name: 'Portal Authentication',
    description: 'These endpoints manage portal authentication and login behavior.'
  },
  'instance.portal.server_requests': {
    name: 'Portal Server Requests',
    description: 'These endpoints manage server request flows in the portal.'
  },
  'instance.portal.featured_servers': {
    name: 'Portal Featured Servers',
    description: 'These endpoints manage featured server listings in the portal.'
  },
  'instance.provider': {
    name: 'Providers',
    description: 'These endpoints list and read provider records.'
  },
  'instance.provider.deployment': {
    name: 'Provider Deployments',
    description: 'These endpoints manage provider deployment lifecycle and state.'
  },
  'instance.provider.auth': {
    name: 'Provider Authentication',
    description: 'These endpoints manage provider authentication config and credentials.'
  },
  'instance.provider.session': {
    name: 'Provider Sessions',
    description:
      'These endpoints manage provider sessions, session events, and session artifacts.'
  },
  'instance.provider.config': {
    name: 'Provider Configs',
    description: 'These endpoints manage provider configuration records and schemas.'
  },
  'instance.provider.config_vault': {
    name: 'Provider Config Vaults',
    description: 'These endpoints manage stored provider configuration secrets.'
  },
  'instance.provider.group': {
    name: 'Provider Groups',
    description: 'These endpoints manage custom provider grouping and membership.'
  },
  'instance.provider.specification': {
    name: 'Provider Specifications',
    description:
      'These endpoints read provider specifications, tools, and auth method definitions.'
  },
  'instance.provider.category': {
    name: 'Provider Categories',
    description: 'These endpoints read provider category taxonomy.'
  },
  'instance.provider.collection': {
    name: 'Provider Collections',
    description: 'These endpoints read provider collection groupings.'
  },
  'instance.provider.listing': {
    name: 'Provider Listings',
    description: 'These endpoints list and read provider marketplace listings.'
  },
  'instance.provider.publisher': {
    name: 'Provider Publishers',
    description: 'These endpoints read provider publisher information.'
  },
  'instance.provider.tool': {
    name: 'Provider Tools',
    description: 'These endpoints read provider tool definitions.'
  },
  'instance.provider.version': {
    name: 'Provider Versions',
    description: 'These endpoints list and read provider versions.'
  },
  'instance.provider.custom': {
    name: 'Custom Providers',
    description: 'These endpoints create, update, and read custom provider definitions.'
  },
  'instance.provider.custom.version': {
    name: 'Custom Provider Versions',
    description: 'These endpoints create and read custom provider versions.'
  },
  'instance.provider.custom.environment': {
    name: 'Custom Provider Environments',
    description: 'These endpoints read custom provider environments.'
  },
  'instance.provider.custom.deployment': {
    name: 'Custom Provider Deployments',
    description: 'These endpoints read custom provider deployments and deployment logs.'
  },
  'instance.provider.custom.commit': {
    name: 'Custom Provider Commits',
    description: 'These endpoints create and read custom provider commits.'
  },
  'instance.provider.custom.code': {
    name: 'Custom Provider Code',
    description: 'These endpoints grant access to custom provider code editing.'
  },
  'instance.scm.account': {
    name: 'SCM Accounts',
    description: 'These endpoints preview source control accounts for installations.'
  },
  'instance.scm.installation': {
    name: 'SCM Installations',
    description: 'These endpoints list and create SCM installations.'
  },
  'instance.scm.repo': {
    name: 'SCM Repositories',
    description: 'These endpoints preview and create SCM repository links.'
  },
  'consumer#instance.magic_mcp': {
    name: 'Consumer Magic MCP',
    description: 'These endpoints manage consumer access to Magic MCP functionality.'
  },
  'consumer#instance.assistant': {
    name: 'Consumer Assistants',
    description: 'These endpoints list assistants and read assistant metadata for consumers.'
  },
  'consumer#instance.assistant.conversation': {
    name: 'Consumer Assistant Conversations',
    description: 'These endpoints manage assistant conversations and messages for consumers.'
  },
  'consumer#instance.skill': {
    name: 'Consumer Skills',
    description: 'These endpoints manage consumer skill access and consumer-owned forks.'
  },
  'consumer#instance.provider_template': {
    name: 'Consumer Provider Templates',
    description: 'These endpoints expose provider template access for consumers.'
  },
  'consumer#instance.oauth_session': {
    name: 'Consumer OAuth Sessions',
    description: 'These endpoints manage OAuth sessions on the consumer side.'
  }
};

let scopeActionMetadata: Record<string, { name: string; description: string }> = {
  read: {
    name: 'Read',
    description: 'It allows read-only access.'
  },
  write: {
    name: 'Write',
    description: 'It allows creating, updating, and deleting data.'
  },
  export: {
    name: 'Export',
    description: 'It allows exporting data out of the platform.'
  },
  import: {
    name: 'Import',
    description: 'It allows importing data into the platform.'
  },
  reveal: {
    name: 'Reveal',
    description: 'It allows revealing stored secret values.'
  }
};

let getScopeDependencies = (identifier: Scope): Scope[] => {
  let [resource, actionRaw] = identifier.split(':') as [string, string];
  let action = actionRaw || 'read';
  if (action !== 'write') return [];

  return [`${resource}:read` as Scope];
};

export let getScopeDefinition = (identifier: Scope): ScopeDefinition => {
  let [resource, actionRaw] = identifier.split(':') as [string, string];
  let action = actionRaw || 'read';
  let resourceMeta = scopeResourceMetadata[resource] || {
    name: Cases.toTitleCase(resource),
    description: `These endpoints manage ${resource}.`
  };
  let actionMeta = scopeActionMetadata[action] || {
    name: Cases.toTitleCase(action),
    description: `It allows ${action} access.`
  };

  return {
    identifier,
    name: `${resourceMeta.name} (${actionMeta.name})`,
    description: `${actionMeta.description} ${resourceMeta.description}`,
    dependencies: getScopeDependencies(identifier)
  };
};
