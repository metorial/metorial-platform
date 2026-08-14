import { Paginator } from '@lowerdeck/pagination';
import { v, ValidationType } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import { organizationLayoutService } from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import { organizationLayoutPresenter } from '@metorial/presenters';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

let jsonValueValidator = v.any() as ValidationType<JsonValue>;

export let dashboardOrganizationLayoutController = Controller.create(
  {
    name: 'Organization layouts',
    description: 'Manage custom user and organization layouts'
  },
  {
    list: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/layouts',
          'dashboard.organizations.layouts.list'
        ),
        {
          name: 'List organization layouts',
          description: 'List materialized layouts for the current user and organization'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization:read'] }))
      .outputList(organizationLayoutPresenter)
      .do(async ctx => {
        let user = ctx.auth.type === 'user' ? ctx.auth.user : (undefined as never);
        let layouts = await organizationLayoutService.listOrganizationLayouts({
          user,
          organization: ctx.organization
        });

        return Paginator.present(
          {
            items: layouts,
            pagination: {
              hasNextPage: false,
              hasPreviousPage: false
            }
          },
          layout => organizationLayoutPresenter.present({ layout })
        );
      }),

    get: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/layouts/:selector',
          'dashboard.organizations.layouts.get'
        ),
        {
          name: 'Get organization layout',
          description: 'Get a layout by layout ID, layout type ID, or type identifier'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization:read'] }))
      .output(organizationLayoutPresenter)
      .do(async ctx => {
        let user = ctx.auth.type === 'user' ? ctx.auth.user : (undefined as never);
        let layout = await organizationLayoutService.getOrganizationLayout({
          selector: ctx.params.selector,
          user,
          organization: ctx.organization
        });

        return organizationLayoutPresenter.present({ layout });
      }),

    set: organizationGroup
      .use(isDashboardGroup())
      .put(
        Path(
          '/dashboard/organizations/:organizationId/layouts/:selector',
          'dashboard.organizations.layouts.set'
        ),
        {
          name: 'Set organization layout',
          description: 'Set a layout by layout ID, layout type ID, or type identifier'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization:read'] }))
      .body(
        'default',
        v.object({
          value: jsonValueValidator
        })
      )
      .output(organizationLayoutPresenter)
      .do(async ctx => {
        let user = ctx.auth.type === 'user' ? ctx.auth.user : (undefined as never);
        let ownership = await organizationLayoutService.getOrganizationLayoutOwnership({
          selector: ctx.params.selector,
          user,
          organization: ctx.organization
        });

        if (ownership === 'organization') {
          await accessService.checkTargetAccess({
            authInfo: ctx.auth,
            organization: ctx.organization,
            member: ctx.member,
            possibleScopes: ['organization:write']
          });
        }

        let layout = await organizationLayoutService.setOrganizationLayout({
          selector: ctx.params.selector,
          value: ctx.body.value,
          user,
          organization: ctx.organization,
          auditScope: ctx.auditScope
        });

        return organizationLayoutPresenter.present({ layout });
      })
  }
);
