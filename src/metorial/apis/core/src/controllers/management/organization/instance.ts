import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import { instanceService, projectService } from '@metorial/module-organization';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';
import { instancePresenter } from '@metorial/presenters';

let resolveProjectFilter = async (d: {
  organization: Parameters<typeof projectService.getManyProjectsByIds>[0]['organization'];
  requestedProjectIds: string[] | undefined;
  accessProjectIds: string[] | undefined;
}) => {
  if (!d.requestedProjectIds) return undefined;
  if (!d.accessProjectIds) return d.requestedProjectIds;

  let projects = await projectService.getManyProjectsByIds({
    organization: d.organization,
    projectIds: d.requestedProjectIds
  });

  return projects
    .map(project => project.id)
    .filter(projectId => d.accessProjectIds?.includes(projectId));
};

let normalizeInstanceTypeFilter = (
  type: 'prod' | 'dev' | 'production' | 'development' | undefined
) => {
  if (!type) return undefined;
  if (type === 'prod') return 'production';
  if (type === 'dev') return 'development';
  return type;
};

export let instanceManagementController = Controller.create(
  {
    name: 'Instance',
    description: 'Read and write instance information'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('instances', 'instances.list'), {
        name: 'List organization instances',
        description: 'List all organization instances'
      })
      .use(checkAccess({ possibleScopes: ['organization.instance:read'] }))
      .outputList(instancePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            project_id: v.optional(v.union([v.string(), v.array(v.string())])),
            type: v.optional(v.enumOf(['prod', 'dev', 'production', 'development']))
          })
        )
      )
      .do(async ctx => {
        let targetAccessFilter = await accessService.getTargetAccessFilter({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          possibleScopes: ['organization.instance:read']
        });
        let accessProjectIds =
          targetAccessFilter && !targetAccessFilter.all
            ? targetAccessFilter.projectIds
            : undefined;
        let requestedProjectIds = normalizeArrayParam(ctx.query.project_id);

        let paginator = await instanceService.listInstances({
          organization: ctx.organization,
          member: ctx.member,
          actor: ctx.actor,
          projectIds: accessProjectIds,
          instanceIds:
            targetAccessFilter && !targetAccessFilter.all
              ? targetAccessFilter.instanceIds
              : undefined,
          filterProjectIds: await resolveProjectFilter({
            organization: ctx.organization,
            requestedProjectIds,
            accessProjectIds
          }),
          filterType: normalizeInstanceTypeFilter(ctx.query.type)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, instance => instancePresenter.present({ instance }));
      }),

    get: organizationGroup
      .get(organizationManagementPath('instances/:instanceId', 'instances.get'), {
        name: 'Get organization instance',
        description: 'Get the information of a specific organization instance'
      })
      .use(
        checkAccess({
          possibleScopes: ['organization.instance:read', 'consumer#organization:read']
        })
      )
      .output(instancePresenter)
      .do(async ctx => {
        let instance = await instanceService.getInstanceById({
          organization: ctx.organization,
          instanceId: ctx.params.instanceId,
          member: ctx.member,
          actor: ctx.actor
        });

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project: instance.project,
          instance,
          possibleScopes: ['organization.instance:read']
        });

        return instancePresenter.present({ instance });
      }),

    delete: organizationGroup
      .delete(organizationManagementPath('instances/:instanceId', 'instances.delete'), {
        name: 'Delete organization instance',
        description: 'Remove an organization instance'
      })
      .use(checkAccess({ possibleScopes: ['organization.instance:write'] }))
      .output(instancePresenter)
      .do(async ctx => {
        let instance = await instanceService.getInstanceById({
          organization: ctx.organization,
          instanceId: ctx.params.instanceId,
          member: ctx.member,
          actor: ctx.actor
        });

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project: instance.project,
          instance,
          possibleScopes: ['organization.instance:write']
        });

        instance = await instanceService.deleteInstance({
          instance,
          organization: ctx.organization,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return instancePresenter.present({ instance });
      }),

    update: organizationGroup
      .post(organizationManagementPath('instances/:instanceId', 'instances.update'), {
        name: 'Update organization instance',
        description: 'Update the role of an organization instance'
      })
      .use(checkAccess({ possibleScopes: ['organization.instance:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string())
        })
      )
      .output(instancePresenter)
      .do(async ctx => {
        let instance = await instanceService.getInstanceById({
          organization: ctx.organization,
          instanceId: ctx.params.instanceId,
          member: ctx.member,
          actor: ctx.actor
        });

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project: instance.project,
          instance,
          possibleScopes: ['organization.instance:write']
        });

        instance = await instanceService.updateInstance({
          instance,
          organization: ctx.organization,
          input: {
            name: ctx.body.name
          },
          context: ctx.context,
          performedBy: ctx.actor
        });

        return instancePresenter.present({ instance });
      })
  }
);
