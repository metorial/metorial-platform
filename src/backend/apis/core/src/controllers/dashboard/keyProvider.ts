import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import { keyProviderService } from '@metorial/module-nebula';
import { projectService } from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import {
  keyProviderErrorPresenter,
  keyProviderPresenter,
  keyProviderSetupInfoPresenter,
  keyProviderValidationPresenter
} from '../../presenters';

let keyProviderFlags = hasFlags([
  'paid-key-providers',
  'advanced-security-management-enabled'
]);

let resolveProject = async (ctx: any) => {
  let project = await projectService.getProjectById({
    organization: ctx.organization,
    projectId: ctx.params.projectId,
    member: ctx.member,
    actor: ctx.actor
  });

  return { project };
};

export let dashboardKeyProviderController = Controller.create(
  {
    name: 'Key providers',
    description: 'Manage project encryption key providers and diagnostics'
  },
  {
    list: organizationGroup
      .use(isDashboardGroup())
      .use(keyProviderFlags)
      .get(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/key-providers',
          'dashboard.projects.keyProviders.list'
        ),
        {
          name: 'List key providers',
          description: 'Returns a paginated list of key providers for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .query('default', Paginator.validate(v.object({})))
      .outputList(keyProviderPresenter)
      .do(async ctx => {
        let { project } = await resolveProject(ctx);

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project,
          possibleScopes: ['organization.project:read']
        });

        let paginator = await keyProviderService.listKeyProviders({
          organization: ctx.organization,
          project
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, keyProvider =>
          keyProviderPresenter.present({ keyProvider })
        );
      }),

    createManaged: organizationGroup
      .use(isDashboardGroup())
      .use(keyProviderFlags)
      .post(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/key-providers',
          'dashboard.projects.keyProviders.createManaged'
        ),
        {
          name: 'Create managed key provider',
          description: 'Creates a Metorial-managed key provider for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:write'] }))
      .body(
        'default',
        v.object({
          name: v.string()
        })
      )
      .output(keyProviderPresenter)
      .do(async ctx => {
        let { project } = await resolveProject(ctx);

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project,
          possibleScopes: ['organization.project:write']
        });

        let keyProvider = await keyProviderService.createManagedKeyProvider({
          organization: ctx.organization,
          project,
          performedBy: ctx.actor,
          context: ctx.context,
          name: ctx.body.name
        });

        return keyProviderPresenter.present({ keyProvider });
      }),

    import: organizationGroup
      .use(isDashboardGroup())
      .use(keyProviderFlags)
      .post(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/key-providers/import',
          'dashboard.projects.keyProviders.import'
        ),
        {
          name: 'Import key provider',
          description: 'Imports a customer-managed key provider for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:write'] }))
      .body(
        'default',
        v.object({
          key_input: v.record(v.any())
        })
      )
      .output(keyProviderPresenter)
      .do(async ctx => {
        let { project } = await resolveProject(ctx);

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project,
          possibleScopes: ['organization.project:write']
        });

        let keyProvider = await keyProviderService.importKeyProvider({
          organization: ctx.organization,
          project,
          performedBy: ctx.actor,
          context: ctx.context,
          keyInput: ctx.body.key_input
        });

        return keyProviderPresenter.present({ keyProvider });
      }),

    get: organizationGroup
      .use(isDashboardGroup())
      .use(keyProviderFlags)
      .get(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/key-providers/:keyProviderId',
          'dashboard.projects.keyProviders.get'
        ),
        {
          name: 'Get key provider',
          description: 'Retrieves a key provider for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .output(keyProviderPresenter)
      .do(async ctx => {
        let { project } = await resolveProject(ctx);

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project,
          possibleScopes: ['organization.project:read']
        });

        let keyProvider = await keyProviderService.getKeyProvider({
          organization: ctx.organization,
          project,
          keyProviderId: ctx.params.keyProviderId
        });

        return keyProviderPresenter.present({ keyProvider });
      }),

    getSetupInfo: organizationGroup
      .use(isDashboardGroup())
      .use(keyProviderFlags)
      .get(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/key-providers/:keyProviderId/setup-info',
          'dashboard.projects.keyProviders.getSetupInfo'
        ),
        {
          name: 'Get key provider setup info',
          description: 'Returns setup instructions for importing a key provider'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .query(
        'default',
        v.object({
          region: v.optional(v.string()),
          key_id: v.optional(v.string())
        })
      )
      .output(keyProviderSetupInfoPresenter)
      .do(async ctx => {
        let { project } = await resolveProject(ctx);

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project,
          possibleScopes: ['organization.project:read']
        });

        let setupInfo = await keyProviderService.getSetupInfo({
          organization: ctx.organization,
          project,
          input: {
            region: ctx.query.region,
            keyId: ctx.query.key_id
          }
        });

        return keyProviderSetupInfoPresenter.present({ setupInfo });
      }),

    validate: organizationGroup
      .use(isDashboardGroup())
      .use(keyProviderFlags)
      .post(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/key-providers/:keyProviderId/validate',
          'dashboard.projects.keyProviders.validate'
        ),
        {
          name: 'Validate key provider',
          description: 'Validates that a key provider is reachable and configured correctly'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:write'] }))
      .output(keyProviderValidationPresenter)
      .do(async ctx => {
        let { project } = await resolveProject(ctx);

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project,
          possibleScopes: ['organization.project:write']
        });

        let validation = await keyProviderService.validateKeyProvider({
          organization: ctx.organization,
          project,
          performedBy: ctx.actor,
          context: ctx.context,
          keyProviderId: ctx.params.keyProviderId
        });

        return keyProviderValidationPresenter.present({ validation });
      }),

    setDefault: organizationGroup
      .use(isDashboardGroup())
      .use(keyProviderFlags)
      .post(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/key-providers/:keyProviderId/set-default',
          'dashboard.projects.keyProviders.setDefault'
        ),
        {
          name: 'Set default key provider',
          description: 'Sets the default key provider for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:write'] }))
      .output(keyProviderPresenter)
      .do(async ctx => {
        let { project } = await resolveProject(ctx);

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project,
          possibleScopes: ['organization.project:write']
        });

        let keyProvider = await keyProviderService.setDefaultKeyProvider({
          organization: ctx.organization,
          project,
          performedBy: ctx.actor,
          context: ctx.context,
          keyProviderId: ctx.params.keyProviderId
        });

        return keyProviderPresenter.present({ keyProvider });
      }),

    listErrors: organizationGroup
      .use(isDashboardGroup())
      .use(keyProviderFlags)
      .get(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/key-providers/:keyProviderId/errors',
          'dashboard.projects.keyProviders.errors.list'
        ),
        {
          name: 'List key provider errors',
          description: 'Returns aggregated key provider errors for diagnostics'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .query('default', Paginator.validate(v.object({})))
      .outputList(keyProviderErrorPresenter)
      .do(async ctx => {
        let { project } = await resolveProject(ctx);

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project,
          possibleScopes: ['organization.project:read']
        });

        let paginator = await keyProviderService.listKeyProviderErrors({
          organization: ctx.organization,
          project,
          keyProviderId: ctx.params.keyProviderId
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, keyProviderError =>
          keyProviderErrorPresenter.present({ keyProviderError })
        );
      })
  }
);
