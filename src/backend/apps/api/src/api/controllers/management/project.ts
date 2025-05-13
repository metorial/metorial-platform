import { projectService } from '@metorial/module-organization';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
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
      .outputList(projectPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await projectService.listProjects({
          organization: ctx.organization
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, project => projectPresenter.present({ project }));
      }),

    get: organizationGroup
      .get(organizationManagementPath('projects/:projectId', 'projects.get'), {
        name: 'Get organization project',
        description: 'Get the information of a specific organization project'
      })
      .output(projectPresenter)
      .do(async ctx => {
        let project = await projectService.getProjectById({
          organization: ctx.organization,
          projectId: ctx.params.projectId
        });

        return projectPresenter.present({ project });
      }),

    create: organizationGroup
      .post(organizationManagementPath('projects', 'projects.create'), {
        name: 'Create organization project',
        description: 'Create a new organization project'
      })
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
      .output(projectPresenter)
      .do(async ctx => {
        let project = await projectService.getProjectById({
          organization: ctx.organization,
          projectId: ctx.params.projectId
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
          projectId: ctx.params.projectId
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
