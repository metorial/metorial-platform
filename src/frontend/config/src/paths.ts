import { joinPaths } from '@metorial/join-paths';
import { getConfig } from '.';

export type EntityParam = { id: string; slug: string } | null | undefined;

let InstancePaths = Object.assign(
  (
    organization: EntityParam,
    project: EntityParam,
    instance: EntityParam,
    ...subPages: (string | null | undefined)[]
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
      ...subPages: (string | null | undefined)[]
    ) => InstancePaths(organization, project, instance, 'settings', ...subPages),
    developer: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: (string | null | undefined)[]
    ) => InstancePaths(organization, project, instance, 'developer', ...subPages),

    servers: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: (string | null | undefined)[]
    ) => InstancePaths(organization, project, instance, 'servers', ...subPages),
    server: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: (string | null | undefined)[]
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'server', id, ...subPages);
    },

    serverDeployments: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: (string | null | undefined)[]
    ) => InstancePaths(organization, project, instance, 'server-deployments', ...subPages),
    serverDeployment: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: (string | null | undefined)[]
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
      ...subPages: (string | null | undefined)[]
    ) => InstancePaths(organization, project, instance, 'server-implementations', ...subPages),
    serverImplementation: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: (string | null | undefined)[]
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

    sessions: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: (string | null | undefined)[]
    ) => InstancePaths(organization, project, instance, 'sessions', ...subPages),
    session: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: (string | null | undefined)[]
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'session', id, ...subPages);
    },

    serverErrors: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: (string | null | undefined)[]
    ) => InstancePaths(organization, project, instance, 'server-errors', ...subPages),
    serverError: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: (string | null | undefined)[]
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'server-error', id, ...subPages);
    },

    serverRuns: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: (string | null | undefined)[]
    ) => InstancePaths(organization, project, instance, 'server-runs', ...subPages),
    serverRun: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      id?: string,
      ...subPages: (string | null | undefined)[]
    ) => {
      if (!id) return '#';
      return InstancePaths(organization, project, instance, 'server-run', id, ...subPages);
    },

    inspector: (
      organization: EntityParam,
      project: EntityParam,
      instance: EntityParam,
      ...subPages: (string | null | undefined)[]
    ) => InstancePaths(organization, project, instance, 'inspector', ...subPages)
  }
);

let ProjectPaths = Object.assign(
  (
    organization: EntityParam,
    project: EntityParam,
    ...subPages: (string | null | undefined)[]
  ) => {
    if (!project) return '#';

    return joinPaths('p', organization?.slug, project.slug, ...subPages);
  },
  {}
);

let AccountPaths = Object.assign(
  (...subPages: (string | null | undefined)[]) => {
    if (getConfig().enterprise?.accountFrontendUrl) {
      return `${getConfig().enterprise!.accountFrontendUrl}${joinPaths(...subPages)}`;
    }

    return joinPaths('account', ...subPages);
  },
  {
    settings: (...subPages: (string | null | undefined)[]) => AccountPaths(...subPages),
    emails: (...subPages: (string | null | undefined)[]) =>
      AccountPaths('emails', ...subPages),
    security: (...subPages: (string | null | undefined)[]) =>
      AccountPaths('security', ...subPages)
  }
);

let OrganizationPaths = Object.assign(
  (organization: EntityParam, ...subPages: (string | null | undefined)[]) => {
    if (!organization) return '#';

    let path = joinPaths('o', organization.slug, ...subPages);

    if (getConfig().enterprise?.organizationFrontendUrl) {
      return `${getConfig().enterprise!.organizationFrontendUrl}${path}`;
    }

    return path;
  },
  {
    settings: (organization: EntityParam, ...subPages: (string | null | undefined)[]) =>
      OrganizationPaths(organization, ...subPages),
    billing: (organization: EntityParam, ...subPages: (string | null | undefined)[]) =>
      OrganizationPaths.settings(organization, 'billing', ...subPages),
    members: (organization: EntityParam, ...subPages: (string | null | undefined)[]) =>
      OrganizationPaths.settings(organization, 'members', ...subPages),
    invites: (organization: EntityParam, ...subPages: (string | null | undefined)[]) =>
      OrganizationPaths.settings(organization, 'invites', ...subPages),
    projects: (organization: EntityParam, ...subPages: (string | null | undefined)[]) =>
      OrganizationPaths.settings(organization, 'projects', ...subPages)
  }
);

export let WelcomePaths = Object.assign(
  (...subPages: (string | null | undefined)[]) => joinPaths('welcome', ...subPages),
  {
    project: (i: { organizationId: string }) => {
      let inner = WelcomePaths('project');
      let search = new URLSearchParams({ organization_id: i.organizationId });
      return `${inner}?${search.toString()}`;
    },
    createProject: (
      i: { organizationId: string },
      ...subPages: (string | null | undefined)[]
    ) => {
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
