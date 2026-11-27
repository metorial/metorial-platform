import { v } from '@lowerdeck/validation';
import { flagService } from '@metorial/module-flags';
import { projectService } from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import { flagsPresenter } from '@metorial/presenters';

export let flagsController = Controller.create(
  {
    name: 'Flags',
    description: 'Read feature flags for the current organization and user'
  },
  {
    get: organizationGroup
      .get(Path('/dashboard/organizations/:organizationId/flags', 'organizations.flags.get'), {
        name: 'Get flags',
        description: 'Get feature flags for the current organization and user'
      })
      .use(isDashboardGroup())
      .query(
        'default',
        v.object({
          project_id: v.optional(
            v.string({
              description: 'The project to evaluate project-specific feature flags for'
            })
          )
        })
      )
      .output(flagsPresenter)
      .do(async ctx => {
        let project = ctx.query.project_id
          ? await projectService.getProjectById({
              organization: ctx.organization,
              projectId: ctx.query.project_id,
              member: ctx.member,
              actor: ctx.actor
            })
          : undefined;
        let flags = await flagService.getFlags({
          organization: ctx.organization,
          project,
          user: ctx.auth.type === 'user' ? ctx.auth.user : undefined!
        });

        return flagsPresenter.present({ flags });
      })
  }
);
