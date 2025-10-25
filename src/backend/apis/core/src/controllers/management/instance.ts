import { instanceService, projectService } from '@metorial/module-organization';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../middleware/organizationGroup';
import { instancePresenter } from '../../presenters';

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
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await instanceService.listInstances({
          organization: ctx.organization,
          member: ctx.member,
          actor: ctx.actor
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, instance => instancePresenter.present({ instance }));
      }),

    get: organizationGroup
      .get(organizationManagementPath('instances/:instanceId', 'instances.get'), {
        name: 'Get organization instance',
        description: 'Get the information of a specific organization instance'
      })
      .use(checkAccess({ possibleScopes: ['organization.instance:read'] }))
      .output(instancePresenter)
      .do(async ctx => {
        let instance = await instanceService.getInstanceById({
          organization: ctx.organization,
          instanceId: ctx.params.instanceId,
          member: ctx.member,
          actor: ctx.actor
        });

        return instancePresenter.present({ instance });
      }),

    create: organizationGroup
      .post(organizationManagementPath('instances', 'instances.create'), {
        name: 'Create organization instance',
        description: 'Create a new organization instance'
      })
      .use(checkAccess({ possibleScopes: ['organization.instance:write'] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          type: v.enumOf(['development', 'production']),
          project_id: v.string()
        })
      )
      .output(instancePresenter)
      .do(async ctx => {
        let project = await projectService.getProjectById({
          organization: ctx.organization,
          projectId: ctx.body.project_id,
          member: ctx.member,
          actor: ctx.actor
        });

        let instance = await instanceService.createInstance({
          input: {
            name: ctx.body.name,
            type: ctx.body.type
          },
          project,
          organization: ctx.organization,
          context: ctx.context,
          performedBy: ctx.actor
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
