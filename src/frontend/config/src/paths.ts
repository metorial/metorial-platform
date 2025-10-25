import { joinPaths } from '@metorial/join-paths';
import { getConfig } from '.';

export type EntityParam = { id: string; slug: string } | null | undefined;
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

    providerConnections: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: SubPages
    ) => InstancePaths(organization, project, instance, 'provider-connections', ...subPages),
    providerConnection: (
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
        'provider-connection',
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
      }
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
  (...subPages: SubPages) => {
    if (getConfig().enterprise?.accountFrontendUrl) {
      return `${getConfig().enterprise!.accountFrontendUrl}${joinPaths(...subPages)}`;
    }

    return joinPaths('account', ...subPages);
  },
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

    if (getConfig().enterprise?.organizationFrontendUrl) {
      return `${getConfig().enterprise!.organizationFrontendUrl}${path}`;
    }

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
