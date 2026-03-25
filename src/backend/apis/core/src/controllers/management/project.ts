import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import { projectService } from '@metorial/module-organization';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../middleware/organizationGroup';
import { projectPresenter } from '../../presenters';

export let projectManagementController = Controller.create(
  {
    name: 'Project',
    description: 'Read and write project information'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('projects', 'projects.list'), {
        name: 'List organization projects',
        description: 'List all organization projects'
      })
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .outputList(projectPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            team_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let targetAccessFilter = await accessService.getTargetAccessFilter({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          possibleScopes: ['organization.project:read']
        });

        let paginator = await projectService.listProjects({
          organization: ctx.organization,
          member: ctx.member,
          actor: ctx.actor,
          projectIds: targetAccessFilter && !targetAccessFilter.all
            ? targetAccessFilter.projectIds
            : undefined,
          teamIds: normalizeArrayParam(ctx.query.team_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, project => projectPresenter.present({ project }));
      }),

    get: organizationGroup
      .get(organizationManagementPath('projects/:projectId', 'projects.get'), {
        name: 'Get organization project',
        description: 'Get the information of a specific organization project'
      })
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .output(projectPresenter)
      .do(async ctx => {
        let project = await projectService.getProjectById({
          organization: ctx.organization,
          projectId: ctx.params.projectId,
          member: ctx.member,
          actor: ctx.actor
        });

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project,
          possibleScopes: ['organization.project:read']
        });

        return projectPresenter.present({ project });
      }),

    create: organizationGroup
      .post(organizationManagementPath('projects', 'projects.create'), {
        name: 'Create organization project',
        description: 'Create a new organization project'
      })
      .use(checkAccess({ possibleScopes: ['organization.project:write'] }))
      .body(
        'default',
        v.object({
          name: v.string()
        })
      )
      .output(projectPresenter)
      .do(async ctx => {
        let project = await projectService.createProject({
          input: {
            name: ctx.body.name
          },
          organization: ctx.organization,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return projectPresenter.present({ project });
      }),

    delete: organizationGroup
      .delete(organizationManagementPath('projects/:projectId', 'projects.delete'), {
        name: 'Delete organization project',
        description: 'Remove an organization project'
      })
      .use(checkAccess({ possibleScopes: ['organization.project:write'] }))
      .output(projectPresenter)
      .do(async ctx => {
        let project = await projectService.getProjectById({
          organization: ctx.organization,
          projectId: ctx.params.projectId,
          member: ctx.member,
          actor: ctx.actor
        });

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project,
          possibleScopes: ['organization.project:write']
        });

        project = await projectService.deleteProject({
          project,
          organization: ctx.organization,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return projectPresenter.present({ project });
      }),

    update: organizationGroup
      .post(organizationManagementPath('projects/:projectId', 'projects.update'), {
        name: 'Update organization project',
        description: 'Update the role of an organization project'
      })
      .use(checkAccess({ possibleScopes: ['organization.project:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string())
        })
      )
      .output(projectPresenter)
      .do(async ctx => {
        let project = await projectService.getProjectById({
          organization: ctx.organization,
          projectId: ctx.params.projectId,
          member: ctx.member,
          actor: ctx.actor
        });

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project,
          possibleScopes: ['organization.project:write']
        });

        project = await projectService.updateProject({
          project,
          organization: ctx.organization,
          input: {
            name: ctx.body.name
          },
          context: ctx.context,
          performedBy: ctx.actor
        });

        return projectPresenter.present({ project });
      })
  }
);
