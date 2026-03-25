import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { accessPolicyService } from '@metorial/module-organization';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import {
  organizationGroup,
  organizationManagementPath
} from '../../middleware/organizationGroup';
import { accessPolicyPresenter, accessPolicyVersionPresenter } from '../../presenters';

let accessEntrySchema = v.object({
  target: v.string(),
  scopes: v.optional(v.array(v.string())),
  roles: v.optional(v.array(v.string()))
});

let accessPolicyManagementGroup = organizationGroup.use(async ctx => {
  if (!ctx.params.accessPolicyId) {
    throw new ServiceError(
      badRequestError({
        message: 'accessPolicyId is required'
      })
    );
  }

  let accessPolicy = await accessPolicyService.getAccessPolicyById({
    organization: ctx.organization,
    accessPolicyId: ctx.params.accessPolicyId
  });

  return { accessPolicy };
});

export let accessPolicyManagementController = Controller.create(
  {
    name: 'Access Policy',
    description: 'Manage organization access policies'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('access-policies', 'accessPolicies.list'), {
        name: 'List access policies',
        description: 'List organization access policies'
      })
      .use(checkAccess({ possibleScopes: ['organization.access_policy:read'] }))
      .outputList(accessPolicyPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await accessPolicyService.listAccessPolicies({
          organization: ctx.organization
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, accessPolicy =>
          accessPolicyPresenter.present({ accessPolicy })
        );
      }),

    get: accessPolicyManagementGroup
      .get(
        organizationManagementPath('access-policies/:accessPolicyId', 'accessPolicies.get'),
        {
          name: 'Get access policy',
          description: 'Get a single organization access policy'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.access_policy:read'] }))
      .output(accessPolicyPresenter)
      .do(async ctx => {
        return accessPolicyPresenter.present({ accessPolicy: ctx.accessPolicy });
      }),

    versions: accessPolicyManagementGroup
      .get(
        organizationManagementPath(
          'access-policies/:accessPolicyId/versions',
          'accessPolicies.versions'
        ),
        {
          name: 'List access policy versions',
          description: 'List version history for an organization access policy'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.access_policy:read'] }))
      .outputList(accessPolicyVersionPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await accessPolicyService.listAccessPolicyVersions({
          organization: ctx.organization,
          accessPolicy: ctx.accessPolicy
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, accessPolicyVersion =>
          accessPolicyVersionPresenter.present({ accessPolicyVersion })
        );
      }),

    create: organizationGroup
      .post(organizationManagementPath('access-policies', 'accessPolicies.create'), {
        name: 'Create access policy',
        description: 'Create an organization access policy'
      })
      .use(checkAccess({ possibleScopes: ['organization.access_policy:write'] }))
      .use(hasFlags(['paid-advanced-roles']))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          document: v.object({
            access: v.array(accessEntrySchema)
          }),
          message: v.optional(v.string())
        })
      )
      .output(accessPolicyPresenter)
      .do(async ctx => {
        let accessPolicy = await accessPolicyService.createAccessPolicy({
          organization: ctx.organization,
          performedBy: ctx.actor,
          context: ctx.context,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            document: ctx.body.document,
            message: ctx.body.message
          }
        });

        accessPolicy = await accessPolicyService.getAccessPolicyById({
          organization: ctx.organization,
          accessPolicyId: accessPolicy.id
        });

        return accessPolicyPresenter.present({ accessPolicy });
      }),

    update: accessPolicyManagementGroup
      .patch(
        organizationManagementPath('access-policies/:accessPolicyId', 'accessPolicies.update'),
        {
          name: 'Update access policy',
          description: 'Update an organization access policy'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.access_policy:write'] }))
      .use(hasFlags(['paid-advanced-roles']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string())),
          document: v.optional(
            v.object({
              access: v.array(accessEntrySchema)
            })
          ),
          message: v.optional(v.string())
        })
      )
      .output(accessPolicyPresenter)
      .do(async ctx => {
        let accessPolicy = await accessPolicyService.updateAccessPolicy({
          accessPolicy: ctx.accessPolicy,
          organization: ctx.organization,
          performedBy: ctx.actor,
          context: ctx.context,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            document: ctx.body.document,
            message: ctx.body.message
          }
        });

        accessPolicy = await accessPolicyService.getAccessPolicyById({
          organization: ctx.organization,
          accessPolicyId: accessPolicy.id
        });

        return accessPolicyPresenter.present({ accessPolicy });
      }),

    delete: accessPolicyManagementGroup
      .delete(
        organizationManagementPath('access-policies/:accessPolicyId', 'accessPolicies.delete'),
        {
          name: 'Delete access policy',
          description: 'Delete an organization access policy'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.access_policy:write'] }))
      .use(hasFlags(['paid-advanced-roles']))
      .output(accessPolicyPresenter)
      .do(async ctx => {
        await accessPolicyService.deleteAccessPolicy({
          accessPolicy: ctx.accessPolicy,
          organization: ctx.organization,
          performedBy: ctx.actor,
          context: ctx.context
        });

        return accessPolicyPresenter.present({ accessPolicy: ctx.accessPolicy });
      })
  }
);
