import { organizationService } from '@metorial/module-organization';
import { Paginator } from '@metorial/pagination';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import { userGroup } from '../../middleware/userGroup';
import { organizationPresenter } from '../../presenters';

export let dashboardOrganizationController = Controller.create(
  {
    name: 'Organization',
    description: 'Read and write organization information'
  },
  {
    create: userGroup
      .use(isDashboardGroup())
      .post(Path('/dashboard/organizations', 'dashboard.organizations.create'), {
        name: 'Create organization',
        description: 'Create a new organization'
      })
      .body(
        'default',
        v.object({
          name: v.string()
        })
      )
      .output(organizationPresenter)
      .do(async ctx => {
        let { organization } = await organizationService.createOrganization({
          input: {
            name: ctx.body.name
          },
          context: ctx.context,
          performedBy: ctx.user
        });

        return organizationPresenter.present({ organization });
      }),

    list: userGroup
      .use(isDashboardGroup())
      .get(Path('/dashboard/organizations', 'dashboard.organizations.list'), {
        name: 'List organizations',
        description: 'List all organizations'
      })
      .query('default', Paginator.validate())
      .outputList(organizationPresenter)
      .do(async ctx => {
        let paginator = await organizationService.listOrganizations({
          filter: {
            type: 'user',
            user: ctx.user
          }
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, org =>
          organizationPresenter.present({ organization: org })
        );
      }),

    get: organizationGroup
      .use(isDashboardGroup())
      .get(Path('/dashboard/organizations/:organizationId', 'dashboard.organizations.get'), {
        name: 'Get organization',
        description: 'Get the current organization information'
      })
      .output(organizationPresenter)
      .do(async ctx => {
        return organizationPresenter.present({ organization: ctx.organization });
      }),

    update: organizationGroup
      .use(isDashboardGroup())
      .patch(
        Path('/dashboard/organizations/:organizationId', 'dashboard.organizations.update'),
        {
          name: 'Update organization',
          description: 'Update the current organization information'
        }
      )
      .body(
        'default',
        v.object({
          name: v.optional(v.string())
        })
      )
      .output(organizationPresenter)
      .do(async ctx => {
        let organization = await organizationService.updateOrganization({
          input: {
            name: ctx.body.name
          },
          organization: ctx.organization,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return organizationPresenter.present({ organization });
      }),

    delete: organizationGroup
      .use(isDashboardGroup())
      .delete(
        Path('/dashboard/organizations/:organizationId', 'dashboard.organizations.delete'),
        {
          name: 'Delete organization',
          description: 'Delete the current organization'
        }
      )
      .output(organizationPresenter)
      .do(async ctx => {
        let organization = await organizationService.deleteOrganization({
          organization: ctx.organization,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return organizationPresenter.present({ organization });
      })
  }
);
