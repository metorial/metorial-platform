import { scmAuthService, scmInstallationService, scmRepoService } from '@metorial/module-scm';
import { Paginator } from '@metorial/pagination';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import {
  scmAccountPreviewPresenter,
  scmInstallationPresenter,
  scmInstallPresenter,
  scmRepoPreviewPresenter
} from '../../presenters';

export let dashboardRepoController = Controller.create(
  {
    name: 'SCM Repo',
    description: 'Read and write SCM repository information'
  },
  {
    listInstallations: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/scm/installations',
          'dashboard.scm.installations.list'
        ),
        {
          name: 'List SCM Installations',
          description: 'List SCM installations for the organization'
        }
      )
      .query('default', Paginator.validate())
      .outputList(scmInstallationPresenter)
      .do(async ctx => {
        let paginator = await scmInstallationService.listScmInstallations({
          organization: ctx.organization,
          actor: ctx.actor
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, item =>
          scmInstallationPresenter.present({ scmInstallation: item })
        );
      }),

    getInstallation: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/scm/installations/:installationId',
          'dashboard.scm.installations.get'
        ),
        {
          name: 'Get SCM Installation',
          description: 'Get a single SCM installation for the organization'
        }
      )
      .output(scmInstallationPresenter)
      .do(async ctx => {
        let scmInstallation = await scmInstallationService.getScmInstallationById({
          organization: ctx.organization,
          scmInstallationId: ctx.params.installationId
        });

        return scmInstallationPresenter.present({ scmInstallation });
      }),

    createInstallations: organizationGroup
      .use(isDashboardGroup())
      .post(
        Path(
          '/dashboard/organizations/:organizationId/scm/installations',
          'dashboard.scm.installations.create'
        ),
        {
          name: 'Install SCM Integration',
          description: 'Install an SCM integration for the organization'
        }
      )
      .body(
        'default',
        v.object({
          provider: v.enumOf(['github']),
          redirectUrl: v.string()
        })
      )
      .output(scmInstallPresenter)
      .do(async ctx => {
        let authorizationUrl = await scmAuthService.getAuthorizationUrl({
          organization: ctx.organization,
          organizationActor: ctx.actor,
          provider: ctx.body.provider,
          redirectUrl: ctx.body.redirectUrl
        });

        return scmInstallPresenter.present({
          authorizationUrl
        });
      }),

    reposPreview: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/scm/repos/preview',
          'dashboard.scm.repos.preview'
        ),
        {
          name: 'List SCM Repositories',
          description: 'List SCM repositories for all organizations the user is a member of'
        }
      )
      .query(
        'default',
        v.object({
          installationId: v.string(),
          search: v.string()
        })
      )
      .output(scmRepoPreviewPresenter)
      .do(async ctx => {
        let installation = await scmInstallationService.getScmInstallationById({
          organization: ctx.organization,
          scmInstallationId: ctx.query.installationId
        });

        let scmRepoPreviews = await scmRepoService.listRepositoryPreviews({
          installation,
          search: ctx.query.search || undefined,
          externalAccountId: installation.externalUserId
        });

        return scmRepoPreviewPresenter.present({
          scmRepoPreviews
        });
      }),

    accountsPreview: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/scm/accounts/preview',
          'dashboard.scm.accounts.preview'
        ),
        {
          name: 'List SCM Repositories',
          description: 'List SCM accounts for all organizations the user is a member of'
        }
      )
      .query(
        'default',
        v.object({
          installationId: v.string(),
          search: v.string()
        })
      )
      .output(scmAccountPreviewPresenter)
      .do(async ctx => {
        let installation = await scmInstallationService.getScmInstallationById({
          organization: ctx.organization,
          scmInstallationId: ctx.query.installationId
        });

        let scmAccountPreviews = await scmRepoService.listAccountPreviews({
          installation,
          search: ctx.query.search || undefined
        });

        return scmAccountPreviewPresenter.present({
          scmAccountPreviews
        });
      })
  }
);
