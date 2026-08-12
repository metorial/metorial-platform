import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { accessRoleService } from '@metorial/module-organization';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';
import { accessRolePresenter, accessRoleVersionPresenter } from '@metorial/presenters';

let accessRoleManagementGroup = organizationGroup.use(async ctx => {
  if (!ctx.params.accessRoleId) {
    throw new ServiceError(
      badRequestError({
        message: 'accessRoleId is required'
      })
    );
  }

  let accessRole = await accessRoleService.getAccessRoleById({
    organization: ctx.organization,
    accessRoleId: ctx.params.accessRoleId
  });

  return { accessRole };
});

export let accessRoleManagementController = Controller.create(
  {
    name: 'Access Role',
    description: 'Manage organization access roles'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('access-roles', 'accessRoles.list'), {
        name: 'List access roles',
        description: 'List organization access roles'
      })
      .use(checkAccess({ possibleScopes: ['organization.access_role:read'] }))
      .outputList(accessRolePresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await accessRoleService.listAccessRoles({
          organization: ctx.organization
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, accessRole =>
          accessRolePresenter.present({ accessRole })
        );
      }),

    get: accessRoleManagementGroup
      .get(organizationManagementPath('access-roles/:accessRoleId', 'accessRoles.get'), {
        name: 'Get access role',
        description: 'Get a single organization access role'
      })
      .use(checkAccess({ possibleScopes: ['organization.access_role:read'] }))
      .output(accessRolePresenter)
      .do(async ctx => {
        return accessRolePresenter.present({ accessRole: ctx.accessRole });
      }),

    versions: accessRoleManagementGroup
      .get(
        organizationManagementPath(
          'access-roles/:accessRoleId/versions',
          'accessRoles.versions'
        ),
        {
          name: 'List access role versions',
          description: 'List version history for an organization access role'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.access_role:read'] }))
      .outputList(accessRoleVersionPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await accessRoleService.listAccessRoleVersions({
          organization: ctx.organization,
          accessRole: ctx.accessRole
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, accessRoleVersion =>
          accessRoleVersionPresenter.present({ accessRoleVersion })
        );
      }),

    create: organizationGroup
      .post(organizationManagementPath('access-roles', 'accessRoles.create'), {
        name: 'Create access role',
        description: 'Create an organization access role'
      })
      .use(checkAccess({ possibleScopes: ['organization.access_role:write'] }))
      .use(hasFlags(['paid-advanced-roles']))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          scopes: v.optional(v.array(v.string())),
          message: v.optional(v.string())
        })
      )
      .output(accessRolePresenter)
      .do(async ctx => {
        let accessRole = await accessRoleService.createAccessRole({
          organization: ctx.organization,
          performedBy: ctx.actor,
          context: ctx.context,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            scopes: ctx.body.scopes,
            message: ctx.body.message
          }
        });

        return accessRolePresenter.present({ accessRole });
      }),

    update: accessRoleManagementGroup
      .patch(organizationManagementPath('access-roles/:accessRoleId', 'accessRoles.update'), {
        name: 'Update access role',
        description: 'Update an organization access role'
      })
      .use(checkAccess({ possibleScopes: ['organization.access_role:write'] }))
      .use(hasFlags(['paid-advanced-roles']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string())),
          scopes: v.optional(v.array(v.string())),
          message: v.optional(v.string())
        })
      )
      .output(accessRolePresenter)
      .do(async ctx => {
        let accessRole = await accessRoleService.updateAccessRole({
          accessRole: ctx.accessRole,
          organization: ctx.organization,
          performedBy: ctx.actor,
          context: ctx.context,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            scopes: ctx.body.scopes,
            message: ctx.body.message
          }
        });

        return accessRolePresenter.present({ accessRole });
      }),

    delete: accessRoleManagementGroup
      .delete(organizationManagementPath('access-roles/:accessRoleId', 'accessRoles.delete'), {
        name: 'Delete access role',
        description: 'Delete an organization access role'
      })
      .use(checkAccess({ possibleScopes: ['organization.access_role:write'] }))
      .use(hasFlags(['paid-advanced-roles']))
      .output(accessRolePresenter)
      .do(async ctx => {
        let accessRole = await accessRoleService.deleteAccessRole({
          accessRole: ctx.accessRole,
          organization: ctx.organization,
          performedBy: ctx.actor,
          context: ctx.context
        });

        return accessRolePresenter.present({ accessRole });
      })
  }
);
