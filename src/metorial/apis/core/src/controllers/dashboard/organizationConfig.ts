import { Paginator } from '@lowerdeck/pagination';
import type { PatchOperation } from '@lowerdeck/patch';
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

let pathValidator = v.array(v.string(), {
  description: 'Object keys leading to the value to change, relative to the config value',
  examples: [['instances', 'ins_123']]
});

let patchOperationValidator = v.union([
  v.object(
    {
      op: v.literal('set'),
      path: pathValidator,
      value: jsonValueValidator
    },
    { description: 'Set the value at a path, creating missing parent objects' }
  ),
  v.object(
    {
      op: v.literal('unset'),
      path: pathValidator
    },
    { description: 'Delete the key at a path' }
  ),
  v.object(
    {
      op: v.literal('add'),
      path: pathValidator,
      value: jsonValueValidator
    },
    { description: 'Append a value to the array at a path unless it is already a member' }
  ),
  v.object(
    {
      op: v.literal('remove'),
      path: pathValidator,
      value: jsonValueValidator
    },
    { description: 'Remove a value from the array at a path' }
  )
]) as ValidationType<PatchOperation>;

let checkConfigWriteAccess = async (d: {
  selector: string;
  user: Parameters<typeof organizationConfigService.getOrganizationConfigOwnership>[0]['user'];
  organization: Parameters<
    typeof organizationConfigService.getOrganizationConfigOwnership
  >[0]['organization'];
  authInfo: Parameters<typeof accessService.checkTargetAccess>[0]['authInfo'];
  member: Parameters<typeof accessService.checkTargetAccess>[0]['member'];
}) => {
  let ownership = await organizationConfigService.getOrganizationConfigOwnership({
    selector: d.selector,
    user: d.user,
    organization: d.organization
  });

  if (ownership === 'organization') {
    await accessService.checkTargetAccess({
      authInfo: d.authInfo,
      organization: d.organization,
      member: d.member,
      possibleScopes: ['organization:write']
    });
  }
};

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
        await checkConfigWriteAccess({
          selector: ctx.params.selector,
          user,
          organization: ctx.organization,
          authInfo: ctx.auth,
          member: ctx.member
        });

        let config = await organizationConfigService.setOrganizationConfig({
          selector: ctx.params.selector,
          value: ctx.body.value,
          user,
          organization: ctx.organization,
          auditScope: ctx.auditScope
        });

        return organizationConfigPresenter.present({ config });
      }),

    patch: organizationGroup
      .use(isDashboardGroup())
      .patch(
        Path(
          '/dashboard/organizations/:organizationId/configs/:selector',
          'dashboard.organizations.configs.patch'
        ),
        {
          name: 'Patch organization config',
          description:
            'Apply path-based operations to a config by config ID, config type ID, or type identifier'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization:read'] }))
      .body(
        'default',
        v.object({
          operations: v.array(patchOperationValidator, {
            description: 'Operations applied in order, atomically, to the latest config value'
          })
        })
      )
      .output(organizationConfigPresenter)
      .do(async ctx => {
        let user = ctx.auth.type === 'user' ? ctx.auth.user : (undefined as never);

        await checkConfigWriteAccess({
          selector: ctx.params.selector,
          user,
          organization: ctx.organization,
          authInfo: ctx.auth,
          member: ctx.member
        });

        let config = await organizationConfigService.patchOrganizationConfig({
          selector: ctx.params.selector,
          operations: ctx.body.operations,
          user,
          organization: ctx.organization,
          auditScope: ctx.auditScope
        });

        return organizationConfigPresenter.present({ config });
      })
  }
);
