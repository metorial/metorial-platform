import { joinPaths } from '@metorial/join-paths';

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
    settings: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'settings', ...subPages),
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

    servers: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'servers', ...subPages),
    server: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'server', id, ...subPages);
    },

    serverDeployments: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'server-deployments', ...subPages),
    serverDeployment: (
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
        'server-deployment',
        id,
        ...subPages
      );
    },

    serverImplementations: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'server-implementations', ...subPages),
    serverImplementation: (
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
        'server-implementation',
        id,
        ...subPages
      );
    },

    serverConfigVaults: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'server-config-vaults', ...subPages),
    serverConfigVault: (
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
        'server-config-vault',
        id,
        ...subPages
      );
    },

    sessions: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'sessions', ...subPages),
    session: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'session', id, ...subPages);
    },

    serverErrors: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'server-errors', ...subPages),
    serverError: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'server-error', id, ...subPages);
    },

    serverRuns: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'server-runs', ...subPages),
    serverRun: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'server-run', id, ...subPages);
    },

    portals: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'portals', ...subPages),
    portal: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'portal', id, ...subPages),

    profile: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'community', 'profile', ...subPages),
    communityServers: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'community', 'servers', ...subPages),

    externalServers: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'external-servers', ...subPages),
    managedServers: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'managed-servers', ...subPages),
    customServer: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: SubPages
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'custom-server', id, ...subPages);
    },

    explorer: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'explorer', ...subPages),

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

      sessions: (
        organization: EntityParam,
        project: EntityParam,
        instance: EntityParam,
        ...subPages: SubPages
      ) => {
        return InstancePaths(
          organization,
          project,
          instance,
          'magic-mcp/sessions',
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

    // Provider API (Magnetar) paths
    providers: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'providers', ...subPages),
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

    providerConfig: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      deploymentId?: string,
      configId?: string,
      ...subPages: SubPages
    ) => {
      if (!deploymentId || !configId) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'configurations',
        deploymentId,
        'config',
        configId,
        ...subPages
      );
    },
    providerAuthCredential: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      deploymentId?: string,
      credentialId?: string,
      ...subPages: SubPages
    ) => {
      if (!deploymentId || !credentialId) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'configurations',
        deploymentId,
        'auth-credential',
        credentialId,
        ...subPages
      );
    },
    providerAuthConnection: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      deploymentId?: string,
      authConfigId?: string,
      ...subPages: SubPages
    ) => {
      if (!deploymentId || !authConfigId) return '#';
      return InstancePaths(
        organization,
        project,
        instance,
        'configurations',
        deploymentId,
        'auth-connection',
        authConfigId,
        ...subPages
      );
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
    ) => InstancePaths(organization, project, instance, 'provider-config-vaults', ...subPages),
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

    externalProviders: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'external-providers', ...subPages),

    providerSessions: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'provider-sessions', ...subPages),
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
  {}
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
    projects: (organization: EntityParam, ...subPages: SubPages) =>
      OrganizationPaths.settings(organization, 'projects', ...subPages)
  }
);

export let WelcomePaths = Object.assign(
  (...subPages: SubPages) => joinPaths('welcome', ...subPages),
  {
    project: (i: { organizationId: string }) => {
      let inner = WelcomePaths('project');
      let search = new URLSearchParams({ organization_id: i.organizationId });
      return `${inner}?${search.toString()}`;
    },
    createProject: (i: { organizationId: string }, ...subPages: SubPages) => {
      let inner = WelcomePaths('create-project');
      let search = new URLSearchParams({ organization_id: i.organizationId });
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
