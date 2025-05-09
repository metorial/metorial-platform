import { joinPaths } from '@metorial/join-paths';
import { getConfig } from '.';

export type EntityParam = { id: string; slug: string } | null | undefined;

let ProjectPaths = Object.assign(
  (
    organization: EntityParam,
    project: EntityParam,
    ...subPages: (string | null | undefined)[]
  ) => {
    if (!project) return '#';

    return joinPaths('p', organization?.slug, project.slug, ...subPages);
  },
  {
    home: (organization: EntityParam, project: EntityParam) =>
      ProjectPaths(organization, project),
    settings: (
      organization: EntityParam,
      project: EntityParam,
      ...subPages: (string | null | undefined)[]
    ) => ProjectPaths(organization, project, 'settings', ...subPages),
    developer: (
      organization: EntityParam,
      project: EntityParam,
      ...subPages: (string | null | undefined)[]
    ) => ProjectPaths(organization, project, 'developer', ...subPages)
  }
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

  project: ProjectPaths,
  account: AccountPaths,
  organization: OrganizationPaths,
  welcome: WelcomePaths
};
