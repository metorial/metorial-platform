import { joinPaths } from '@mtsrc/join-paths';

export type EntityParam = { slug: string } | null | undefined;
export type SubPages = (string | null | undefined | object)[];

let InstancePaths = Object.assign(
  (
    organization: EntityParam,
    project: EntityParam,
    instance: EntityParam,
    ...subPages: SubPages
  ) => {
    if (!instance || !project || !organization) return '#';

    return joinPaths('i', organization.slug, project.slug, instance.slug, ...subPages);
  },
  {
    home: (organization: EntityParam, project: EntityParam, instance: EntityParam) =>
      InstancePaths(organization, project, instance),
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

let ProjectPaths = Object.assign(
  (organization: EntityParam, project: EntityParam, ...subPages: SubPages) => {
    if (!project) return '#';

    return joinPaths('p', organization?.slug, project.slug, ...subPages);
  },
  {
    settings: (organization: EntityParam, project: EntityParam, ...subPages: SubPages) =>
      ProjectPaths(organization, project, 'settings', ...subPages)
  }
);

let AccountPaths = Object.assign(
  (...subPages: SubPages) => joinPaths('account', ...subPages),
  {
    settings: (...subPages: SubPages) => AccountPaths(...subPages),
    emails: (...subPages: SubPages) => AccountPaths('emails', ...subPages),
    security: (...subPages: SubPages) => AccountPaths('security', ...subPages)
  }
);

let OrganizationPaths = Object.assign(
  (organization: EntityParam, ...subPages: SubPages) => {
    if (!organization) return '#';

    let path = joinPaths('o', organization.slug, ...subPages);

    return path;
  },
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
      OrganizationPaths.settings(organization, 'projects', ...subPages)
  }
);

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
  project: ProjectPaths,
  account: AccountPaths,
  organization: OrganizationPaths,
  welcome: WelcomePaths
};
