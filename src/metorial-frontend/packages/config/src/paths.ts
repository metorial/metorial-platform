import { joinPaths } from '@lowerdeck/join-paths';
import { getNexusUrl } from './nexus';

export type EntityParam = { slug: string } | null | undefined;
export type SubPages = (string | null | undefined | object)[];

let InstancePaths = Object.assign(
  (
    organization: EntityParam,
    project: EntityParam,
    instance: EntityParam,
    ...subPages: SubPages
  ) =>
    getNexusUrl('product', () => {
      if (!instance || !project || !organization) return '#';
      return joinPaths(instance.slug, ...subPages);
    }),
  {
    home: (organization: EntityParam, project: EntityParam, instance: EntityParam) =>
      InstancePaths(organization, project, instance),
    infrastructure: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'infra', ...subPages),
    developer: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'developer', ...subPages),

    callbacks: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'callbacks', ...subPages),

    security: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'security', ...subPages),
    network: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'network', ...subPages),
    networkFirewalls: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'network', 'firewalls', ...subPages),
    networkEnclaves: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'network', 'enclaves', ...subPages),
    networkFirewall: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'network',
        'firewall',
        id,
        ...subPages
      );
    },
    networkSettings: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'network', 'settings', ...subPages),
    callback: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'callback', id, ...subPages);
    },

    providers: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'providers', ...subPages),
    provider: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'provider', id, ...subPages);
    },

    integrations: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'integrations', ...subPages),
    integration: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'integration', id, ...subPages);
    },
    skills: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'skills', ...subPages),
    skillSettings: (organization: EntityParam, project: EntityParam, instance: EntityParam) =>
      InstancePaths(organization, project, instance, 'skills', 'settings'),
    skill: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'skill', id, ...subPages);
    },
    skillTemplates: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'skills', 'templates', ...subPages),
    skillTemplate: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'skill-template', id, ...subPages);
    },
    skillGroups: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'skills', 'groups', ...subPages),
    skillGroup: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'skill-group', id, ...subPages);
    },
    skillMarketplaces: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'skills', 'marketplaces', ...subPages),
    skillMarketplace: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'skill-marketplace',
        id,
        ...subPages
      );
    },
    skillPlugins: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'skills', 'plugins', ...subPages),
    skillPlugin: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'skill-plugin', id, ...subPages);
    },
    integrationInstance: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'integration-instance',
        id,
        ...subPages
      );
    },

    providerDeployments: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'configurations', ...subPages),
    providerDeployment: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'configurations', id, ...subPages);
    },

    providerImplementations: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) =>
      InstancePaths(organization, project, instance, 'provider-implementations', ...subPages),
    providerImplementation: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'provider-implementation',
        id,
        ...subPages
      );
    },

    providerConfigVaults: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) =>
      InstancePaths(
        organization,
        project,
        instance,
        'configurations',
        'config-vaults',
        ...subPages
      ),
    providerConfigVault: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'provider-config-vault',
        id,
        ...subPages
      );
    },

    logs: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'logs', ...subPages),

    alerts: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'alerts', ...subPages),
    alert: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'alert', id, ...subPages);
    },
    monitors: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'monitors', ...subPages),
    monitor: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'monitor', id, ...subPages);
    },
    protoguard: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'protoguard', ...subPages),
    protoguardFilter: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'protoguard',
        'filter',
        id,
        ...subPages
      );
    },

    providerErrors: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'provider-errors', ...subPages),
    providerError: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'provider-error', id, ...subPages);
    },

    providerRuns: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'provider-runs', ...subPages),
    providerRun: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'provider-run', id, ...subPages);
    },

    providerAuthErrors: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'provider-auth-errors', ...subPages),
    providerAuthError: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'provider-auth-error',
        id,
        ...subPages
      );
    },

    providerAuthEvents: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'provider-auth-events', ...subPages),
    providerAuthEvent: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'provider-auth-event',
        id,
        ...subPages
      );
    },

    portals: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'portals', ...subPages),
    workforce: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'workforce', ...subPages),
    portal: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'portal', id, ...subPages);
    },
    providerTemplates: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'provider-templates', ...subPages),

    profile: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'community', 'profile', ...subPages),
    communityProviders: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'community', 'servers', ...subPages),

    externalProviders: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'external-providers', ...subPages),
    customProviders: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'custom-providers', ...subPages),
    customProvider: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'custom-provider',
        id,
        ...subPages
      );
    },

    explorer: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'explorer', ...subPages),

    assistant: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'assistant', ...subPages),
    assistantConversation: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'assistant',
        'conversation',
        id,
        ...subPages
      );
    },

    magicMcp: {
      server: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        id?: string,
        ...subPages: SubPages
      ) => {
        if (!id) return '#';
        return InstancePaths(
          organization,
          project,
          instance,
          'magic-mcp/server',
          id,
          ...subPages
        );
      },

      servers: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        ...subPages: SubPages
      ) => {
        return InstancePaths(
          organization,
          project,
          instance,
          'magic-mcp/servers',
          ...subPages
        );
      },

      tokens: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        ...subPages: SubPages
      ) => {
        return InstancePaths(organization, project, instance, 'magic-mcp/tokens', ...subPages);
      },

      connections: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        ...subPages: SubPages
      ) => {
        return InstancePaths(
          organization,
          project,
          instance,
          'magic-mcp/connections',
          ...subPages
        );
      },

      connection: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        id?: string,
        ...subPages: SubPages
      ) => {
        if (!id) return '#';
        return InstancePaths(
          organization,
          project,
          instance,
          'magic-mcp/connection',
          id,
          ...subPages
        );
      },

      groups: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        ...subPages: SubPages
      ) => {
        return InstancePaths(organization, project, instance, 'magic-mcp/groups', ...subPages);
      },

      group: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        ...subPages: SubPages
      ) => {
        return InstancePaths(organization, project, instance, 'magic-mcp/group', ...subPages);
      }
    },

    identity: {
      agents: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        ...subPages: SubPages
      ) => InstancePaths(organization, project, instance, 'agents', ...subPages),

      agent: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        id?: string,
        ...subPages: SubPages
      ) => {
        if (!id) return '#';
        return InstancePaths(organization, project, instance, 'agent', id, ...subPages);
      },

      consumers: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        ...subPages: SubPages
      ) => InstancePaths(organization, project, instance, 'consumers', ...subPages),

      consumer: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        id?: string,
        ...subPages: SubPages
      ) => {
        if (!id) return '#';
        return InstancePaths(organization, project, instance, 'consumer', id, ...subPages);
      },

      actors: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        ...subPages: SubPages
      ) => InstancePaths(organization, project, instance, 'actors', ...subPages),

      actor: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        id?: string,
        ...subPages: SubPages
      ) => {
        if (!id) return '#';
        return InstancePaths(organization, project, instance, 'actor', id, ...subPages);
      },

      identities: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        ...subPages: SubPages
      ) => InstancePaths(organization, project, instance, 'identities', ...subPages),

      identity: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        id?: string,
        ...subPages: SubPages
      ) => {
        if (!id) return '#';
        return InstancePaths(organization, project, instance, 'identity', id, ...subPages);
      },

      delegations: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        ...subPages: SubPages
      ) =>
        InstancePaths(organization, project, instance, 'identity', 'delegations', ...subPages),

      delegation: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        id?: string,
        ...subPages: SubPages
      ) => {
        if (!id) return '#';
        return InstancePaths(
          organization,
          project,
          instance,
          'identity',
          'delegation',
          id,
          ...subPages
        );
      },

      delegationConfigs: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        ...subPages: SubPages
      ) =>
        InstancePaths(
          organization,
          project,
          instance,
          'identity',
          'delegation-configs',
          ...subPages
        ),

      delegationConfig: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        id?: string,
        ...subPages: SubPages
      ) => {
        if (!id) return '#';
        return InstancePaths(
          organization,
          project,
          instance,
          'identity',
          'delegation-config',
          id,
          ...subPages
        );
      }
    },

    providerAuthConfigs: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) =>
      InstancePaths(
        organization,
        project,
        instance,
        'configurations',
        'auth-configs',
        ...subPages
      ),
    providerAuthConfig: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      authConfigId?: string,
      ...subPages: SubPages
    ) => {
      if (!authConfigId) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'configurations',
        'auth-config',
        authConfigId,
        ...subPages
      );
    },

    providerConfigs: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => {
      return InstancePaths(
        organization,
        project,
        instance,
        'configurations',
        'configs',
        ...subPages
      );
    },
    providerConfig: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      configId?: string,
      ...subPages: SubPages
    ) => {
      if (!configId) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'configurations',
        'config',
        configId,
        ...subPages
      );
    },

    providerAuthCredentials: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => {
      return InstancePaths(
        organization,
        project,
        instance,
        'configurations',
        'auth-credentials',
        ...subPages
      );
    },
    providerAuthCredential: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      credentialId?: string,
      ...subPages: SubPages
    ) => {
      if (!credentialId) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'configurations',
        'auth-credential',
        credentialId,
        ...subPages
      );
    },

    providerSessions: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'provider-sessions', ...subPages),
    sessionConnections: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'session-connections', ...subPages),
    toolCalls: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'tool-calls', ...subPages),
    providerSession: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'provider-session',
        id,
        ...subPages
      );
    },

    sessionTemplates: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'session-templates', ...subPages),
    sessionTemplate: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'session-template',
        id,
        ...subPages
      );
    },

    setupProvider: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      providerId?: string
    ) => {
      let path = InstancePaths(organization, project, instance, 'setup-provider');
      if (providerId) {
        return `${path}?provider_id=${encodeURIComponent(providerId)}`;
      }
      return path;
    }
  }
);

let AccountPaths = Object.assign(
  (...subPages: SubPages) => getNexusUrl('account', () => joinPaths(...subPages)),
  {
    settings: (...subPages: SubPages) => AccountPaths(...subPages),
    emails: (...subPages: SubPages) => AccountPaths('emails', ...subPages),
    identity: (...subPages: SubPages) => AccountPaths('identity', ...subPages)
  }
);

let SupportPaths = Object.assign(
  (...subPages: SubPages) => getNexusUrl('support', () => joinPaths(...subPages)),
  {
    tickets: (organizationId: string | null | undefined, ...subPages: SubPages) => {
      if (!organizationId) return '#';
      return SupportPaths(organizationId, 'tickets', ...subPages);
    },
    newTicket: (organizationId: string | null | undefined) =>
      SupportPaths.tickets(organizationId, 'new'),
    ticket: (
      organizationId: string | null | undefined,
      ticketId: string | null | undefined
    ) => {
      if (!ticketId) return '#';
      return SupportPaths.tickets(organizationId, ticketId);
    }
  }
);

let EnterprisePaths = Object.assign(
  (accountId: string | null | undefined, ...subPages: SubPages) =>
    getNexusUrl('enterprise', () => {
      if (!accountId) return '#';
      return joinPaths(accountId, ...subPages);
    }),
  {
    home: (accountId: string | null | undefined, ...subPages: SubPages) =>
      EnterprisePaths(accountId, ...subPages),
    members: (accountId: string | null | undefined, ...subPages: SubPages) =>
      EnterprisePaths(accountId, 'members', ...subPages),
    member: (
      accountId: string | null | undefined,
      memberId: string | null | undefined,
      ...subPages: SubPages
    ) => {
      if (!memberId) return '#';

      return EnterprisePaths(accountId, 'members', memberId, ...subPages);
    },
    invites: (accountId: string | null | undefined, ...subPages: SubPages) =>
      EnterprisePaths(accountId, 'invites', ...subPages),
    invite: (
      accountId: string | null | undefined,
      inviteId: string | null | undefined,
      ...subPages: SubPages
    ) => {
      if (!inviteId) return '#';

      return EnterprisePaths(accountId, 'invites', inviteId, ...subPages);
    },
    access: (accountId: string | null | undefined, ...subPages: SubPages) =>
      EnterprisePaths(accountId, 'access', ...subPages),
    groups: (accountId: string | null | undefined, ...subPages: SubPages) =>
      EnterprisePaths(accountId, 'access', ...subPages),
    group: (
      accountId: string | null | undefined,
      groupId: string | null | undefined,
      ...subPages: SubPages
    ) => {
      if (!groupId) return '#';

      return EnterprisePaths(accountId, 'access', 'groups', groupId, ...subPages);
    },
    policies: (accountId: string | null | undefined, ...subPages: SubPages) =>
      EnterprisePaths(accountId, 'access', ...subPages),
    policy: (
      accountId: string | null | undefined,
      policyId: string | null | undefined,
      ...subPages: SubPages
    ) => {
      if (!policyId) return '#';

      return EnterprisePaths(accountId, 'access', 'policies', policyId, ...subPages);
    },
    workspaces: (accountId: string | null | undefined, ...subPages: SubPages) =>
      EnterprisePaths(accountId, 'workspaces', ...subPages),
    workspace: (
      accountId: string | null | undefined,
      workspaceId: string | null | undefined,
      ...subPages: SubPages
    ) => {
      if (!workspaceId) return '#';

      return EnterprisePaths(accountId, 'workspaces', workspaceId, ...subPages);
    },
    auth: (accountId: string | null | undefined, ...subPages: SubPages) =>
      EnterprisePaths(accountId, 'auth', ...subPages),
    domains: (accountId: string | null | undefined, ...subPages: SubPages) =>
      EnterprisePaths(accountId, 'auth/domains', ...subPages),
    authConnections: (accountId: string | null | undefined, ...subPages: SubPages) =>
      EnterprisePaths(accountId, 'auth/connections', ...subPages),
    authConnection: (
      accountId: string | null | undefined,
      connectionId: string | null | undefined,
      ...subPages: SubPages
    ) => {
      if (!connectionId) return '#';
      return EnterprisePaths(accountId, 'auth/connections', connectionId, ...subPages);
    },
    authConnectionDirectories: (
      accountId: string | null | undefined,
      connectionId: string | null | undefined,
      ...subPages: SubPages
    ) => {
      if (!connectionId) return '#';
      return EnterprisePaths(
        accountId,
        'auth/connections',
        connectionId,
        'directories',
        ...subPages
      );
    },
    authConnectionUsers: (
      accountId: string | null | undefined,
      connectionId: string | null | undefined,
      ...subPages: SubPages
    ) => {
      if (!connectionId) return '#';
      return EnterprisePaths(
        accountId,
        'auth/connections',
        connectionId,
        'users',
        ...subPages
      );
    },
    authConnectionUser: (
      accountId: string | null | undefined,
      connectionId: string | null | undefined,
      userId: string | null | undefined
    ) => {
      if (!connectionId || !userId) return '#';
      return EnterprisePaths(accountId, 'auth/connections', connectionId, 'users', userId);
    },
    authConnectionGroups: (
      accountId: string | null | undefined,
      connectionId: string | null | undefined,
      ...subPages: SubPages
    ) => {
      if (!connectionId) return '#';
      return EnterprisePaths(
        accountId,
        'auth/connections',
        connectionId,
        'groups',
        ...subPages
      );
    },
    authConnectionGroup: (
      accountId: string | null | undefined,
      connectionId: string | null | undefined,
      groupId: string | null | undefined
    ) => {
      if (!connectionId || !groupId) return '#';
      return EnterprisePaths(accountId, 'auth/connections', connectionId, 'groups', groupId);
    },
    authConnectionRoles: (
      accountId: string | null | undefined,
      connectionId: string | null | undefined,
      ...subPages: SubPages
    ) => {
      if (!connectionId) return '#';
      return EnterprisePaths(
        accountId,
        'auth/connections',
        connectionId,
        'roles',
        ...subPages
      );
    },
    authConnectionRole: (
      accountId: string | null | undefined,
      connectionId: string | null | undefined,
      roleId: string | null | undefined
    ) => {
      if (!connectionId || !roleId) return '#';
      return EnterprisePaths(accountId, 'auth/connections', connectionId, 'roles', roleId);
    },
    authConnectionDirectory: (
      accountId: string | null | undefined,
      connectionId: string | null | undefined,
      directoryId: string | null | undefined,
      ...subPages: SubPages
    ) => {
      if (!connectionId || !directoryId) return '#';
      return EnterprisePaths(
        accountId,
        'auth/connections',
        connectionId,
        'directories',
        directoryId,
        ...subPages
      );
    },
    auditLogs: (accountId: string | null | undefined, ...subPages: SubPages) =>
      EnterprisePaths(accountId, 'audit-logs', ...subPages),
    billing: (accountId: string | null | undefined, ...subPages: SubPages) =>
      EnterprisePaths(accountId, 'billing', ...subPages),
    billingWorkspace: (
      accountId: string | null | undefined,
      workspaceId: string | null | undefined,
      ...subPages: SubPages
    ) => {
      if (!workspaceId) return '#';

      return EnterprisePaths(accountId, 'billing', workspaceId, ...subPages);
    },
    settings: (accountId: string | null | undefined, ...subPages: SubPages) =>
      EnterprisePaths(accountId, 'settings', ...subPages)
  }
);

let OrganizationPaths = Object.assign(
  (organization: EntityParam, ...subPages: SubPages) =>
    getNexusUrl('organization', () => {
      if (!organization) return '#';
      return joinPaths(organization.slug, ...subPages);
    }),
  {
    settings: (organization: EntityParam, ...subPages: SubPages) =>
      OrganizationPaths(organization, ...subPages),
    billing: (organization: EntityParam, ...subPages: SubPages) =>
      OrganizationPaths.settings(organization, 'billing', ...subPages),
    members: (organization: EntityParam, ...subPages: SubPages) =>
      OrganizationPaths.settings(organization, 'members', ...subPages),
    invites: (organization: EntityParam, ...subPages: SubPages) =>
      OrganizationPaths.settings(organization, 'invites', ...subPages),
    teams: (organization: EntityParam, ...subPages: SubPages) =>
      OrganizationPaths.settings(organization, 'teams', ...subPages),
    roles: (organization: EntityParam, ...subPages: SubPages) =>
      OrganizationPaths.settings(organization, 'roles', ...subPages),
    policies: (organization: EntityParam, ...subPages: SubPages) =>
      OrganizationPaths.settings(organization, 'policies', ...subPages),
    projects: (organization: EntityParam, ...subPages: SubPages) =>
      OrganizationPaths.settings(organization, 'projects', ...subPages),
    project: (organization: EntityParam, project: EntityParam, ...subPages: SubPages) => {
      if (!project) return '#';
      return OrganizationPaths.settings(organization, 'project', project.slug, ...subPages);
    }
  }
);

export let PLACEHOLDER_INSTANCE_ENTITY = { id: 'a', slug: 'a' };

export let PLACEHOLDER_INSTANCE_PARAMS = [
  PLACEHOLDER_INSTANCE_ENTITY,
  PLACEHOLDER_INSTANCE_ENTITY,
  PLACEHOLDER_INSTANCE_ENTITY
] as const;

let dashboardInstanceRedirect = (
  dashboardUrl: string,
  fullInstancePath: string,
  opts?: { organizationId?: string }
) => {
  if (!fullInstancePath || fullInstancePath === '#' || !fullInstancePath.startsWith('/i/')) {
    return fullInstancePath;
  }

  let queryIndex = fullInstancePath.indexOf('?');
  let pathname = queryIndex >= 0 ? fullInstancePath.slice(0, queryIndex) : fullInstancePath;
  let query = queryIndex >= 0 ? fullInstancePath.slice(queryIndex + 1) : '';

  let segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'i' || segments.length < 2) return fullInstancePath;

  let prefix =
    segments.length >= 4
      ? `/${segments.slice(0, 4).join('/')}`
      : `/${segments.slice(0, 2).join('/')}`;

  let resPath = pathname.slice(prefix.length);

  if (query) {
    resPath = resPath ? `${resPath}?${query}` : `?${query}`;
  }

  let dashUrl = new URL(dashboardUrl);
  if (resPath.length > 0) dashUrl.searchParams.set('path', resPath);
  if (opts?.organizationId) dashUrl.searchParams.set('organization_id', opts.organizationId);

  return dashUrl.toString();
};

export let WelcomePaths = Object.assign(
  (...subPages: SubPages) => joinPaths('welcome', ...subPages),
  {
    onboarding: (i: { organizationId: string }) => {
      let inner = WelcomePaths('onboarding');
      let search = new URLSearchParams({ organization_id: i.organizationId });
      return `${inner}?${search.toString()}`;
    },
    project: (i: { organizationId: string }) => {
      let inner = WelcomePaths('project');
      let search = new URLSearchParams({ organization_id: i.organizationId });
      return `${inner}?${search.toString()}`;
    },
    createProject: (i: { organizationId: string }, ...subPages: SubPages) => {
      let inner = WelcomePaths('create-project');
      let search = new URLSearchParams({ organization_id: i.organizationId });
      return `${inner}?${search.toString()}`;
    },
    setupProvider: (i: { organizationId: string; projectId: string }) => {
      let inner = WelcomePaths('setup-provider');
      let search = new URLSearchParams({
        organization_id: i.organizationId,
        project_id: i.projectId
      });
      return `${inner}?${search.toString()}`;
    }
  }
);

export let Paths = {
  join: joinPaths,

  instance: InstancePaths,
  account: AccountPaths,
  support: SupportPaths,
  enterprise: EnterprisePaths,
  organization: OrganizationPaths,
  welcome: WelcomePaths,
  dashboardInstanceRedirect
};
