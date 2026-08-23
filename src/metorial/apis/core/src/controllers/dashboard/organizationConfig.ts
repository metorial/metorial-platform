import { Paginator } from '@lowerdeck/pagination';
import { v, ValidationType } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import { organizationConfigService } from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import { organizationConfigPresenter } from '@metorial/presenters';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

let jsonValueValidator = v.any() as ValidationType<JsonValue>;

export let dashboardOrganizationConfigController = Controller.create(
  {
    name: 'Organization configs',
    description: 'Manage custom user and organization configuration'
  },
  {
    list: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/configs',
          'dashboard.organizations.configs.list'
        ),
        {
          name: 'List organization configs',
          description: 'List materialized configs for the current user and organization'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization:read'] }))
      .outputList(organizationConfigPresenter)
      .do(async ctx => {
        let user = ctx.auth.type === 'user' ? ctx.auth.user : (undefined as never);
        let configs = await organizationConfigService.listOrganizationConfigs({
          user,
          organization: ctx.organization
        });

        return Paginator.present(
          {
            items: configs,
            pagination: {
              hasNextPage: false,
              hasPreviousPage: false
            }
          },
          config => organizationConfigPresenter.present({ config })
        );
      }),

    get: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/configs/:selector',
          'dashboard.organizations.configs.get'
        ),
        {
          name: 'Get organization config',
          description: 'Get a config by config ID, config type ID, or type identifier'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization:read'] }))
      .output(organizationConfigPresenter)
      .do(async ctx => {
        let user = ctx.auth.type === 'user' ? ctx.auth.user : (undefined as never);
        let config = await organizationConfigService.getOrganizationConfig({
          selector: ctx.params.selector,
          user,
          organization: ctx.organization
        });

        return organizationConfigPresenter.present({ config });
      }),

    set: organizationGroup
      .use(isDashboardGroup())
      .put(
        Path(
          '/dashboard/organizations/:organizationId/configs/:selector',
          'dashboard.organizations.configs.set'
        ),
        {
          name: 'Set organization config',
          description: 'Set a config by config ID, config type ID, or type identifier'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization:read'] }))
      .body(
        'default',
        v.object({
          value: jsonValueValidator
        })
      )
      .output(organizationConfigPresenter)
      .do(async ctx => {
        let user = ctx.auth.type === 'user' ? ctx.auth.user : (undefined as never);
        let ownership = await organizationConfigService.getOrganizationConfigOwnership({
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

        let config = await organizationConfigService.setOrganizationConfig({
          selector: ctx.params.selector,
          value: ctx.body.value,
          user,
          organization: ctx.organization,
          auditScope: ctx.auditScope
        });

        return organizationConfigPresenter.present({ config });
      })
  }
);
