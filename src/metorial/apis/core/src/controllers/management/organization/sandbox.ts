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
import { sandboxPresenter } from '@metorial/presenters';

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

export let sandboxManagementController = Controller.create(
  {
    name: 'Sandbox',
    description: 'Read and write development sandbox information'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('sandboxes', 'sandboxes.list'), {
        name: 'List organization sandboxes',
        description: 'List all organization sandboxes'
      })
      .use(checkAccess({ possibleScopes: ['organization.sandbox:read'] }))
      .outputList(sandboxPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            project_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let targetAccessFilter = await accessService.getTargetAccessFilter({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          possibleScopes: ['organization.sandbox:read']
        });
        let accessProjectIds =
          targetAccessFilter && !targetAccessFilter.all
            ? targetAccessFilter.projectIds
            : undefined;
        let requestedProjectIds = normalizeArrayParam(ctx.query.project_id);

        let paginator = await instanceService.listSandboxes({
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
          })
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sandbox => sandboxPresenter.present({ sandbox }));
      }),

    get: organizationGroup
      .get(organizationManagementPath('sandboxes/:sandboxId', 'sandboxes.get'), {
        name: 'Get organization sandbox',
        description: 'Get the information of a specific organization sandbox'
      })
      .use(checkAccess({ possibleScopes: ['organization.sandbox:read'] }))
      .output(sandboxPresenter)
      .do(async ctx => {
        let sandbox = await instanceService.getSandboxById({
          organization: ctx.organization,
          sandboxId: ctx.params.sandboxId,
          member: ctx.member,
          actor: ctx.actor
        });

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project: sandbox.instance.project,
          instance: sandbox.instance,
          possibleScopes: ['organization.sandbox:read']
        });

        return sandboxPresenter.present({ sandbox });
      }),

    create: organizationGroup
      .post(organizationManagementPath('sandboxes', 'sandboxes.create'), {
        name: 'Create organization sandbox',
        description: 'Create a new development sandbox'
      })
      .use(checkAccess({ possibleScopes: ['organization.sandbox:write'] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          project_id: v.string()
        })
      )
      .output(sandboxPresenter)
      .do(async ctx => {
        let project = await projectService.getProjectById({
          organization: ctx.organization,
          projectId: ctx.body.project_id,
          member: ctx.member,
          actor: ctx.actor
        });

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project,
          possibleScopes: ['organization.sandbox:write']
        });

        let sandbox = await instanceService.createSandbox({
          input: {
            name: ctx.body.name
          },
          project,
          organization: ctx.organization,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return sandboxPresenter.present({ sandbox });
      }),

    update: organizationGroup
      .post(organizationManagementPath('sandboxes/:sandboxId', 'sandboxes.update'), {
        name: 'Update organization sandbox',
        description: 'Update a development sandbox'
      })
      .use(checkAccess({ possibleScopes: ['organization.sandbox:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string())
        })
      )
      .output(sandboxPresenter)
      .do(async ctx => {
        let sandbox = await instanceService.getSandboxById({
          organization: ctx.organization,
          sandboxId: ctx.params.sandboxId,
          member: ctx.member,
          actor: ctx.actor
        });

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project: sandbox.instance.project,
          instance: sandbox.instance,
          possibleScopes: ['organization.sandbox:write']
        });

        sandbox = await instanceService.updateSandbox({
          sandbox,
          organization: ctx.organization,
          input: {
            name: ctx.body.name
          },
          context: ctx.context,
          performedBy: ctx.actor
        });

        return sandboxPresenter.present({ sandbox });
      })
  }
);
