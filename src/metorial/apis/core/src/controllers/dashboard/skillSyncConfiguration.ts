import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import { projectService, projectSkillSyncConfigurationService } from '@metorial/module-organization';
import { projectSkillSyncConfigurationPresenter } from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';

let minGitLfsThresholdBytes = 1024 * 1024;

// GitHub refuses non-LFS blobs above 100 MiB, so a higher threshold could never apply.
let maxGitLfsThresholdBytes = 100 * 1024 * 1024;

let gitLfsThresholdBytesValidator = v.optional(
  v.nullable(
    v.number({
      modifiers: [
        v.integer(),
        v.minValue(minGitLfsThresholdBytes),
        v.maxValue(maxGitLfsThresholdBytes)
      ]
    })
  )
);

export let dashboardProjectSkillSyncConfigurationController = Controller.create(
  {
    name: 'Project skill sync configuration',
    description: 'Configure how project skills are synced to repositories'
  },
  {
    get: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/skill-sync',
          'dashboard.projects.configure.skillSync.get'
        ),
        {
          name: 'Get project skill sync configuration',
          description: 'Get the skill sync settings for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .output(projectSkillSyncConfigurationPresenter)
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

        await projectSkillSyncConfigurationService.getProjectSkillSyncConfiguration({
          project
        });

        return projectSkillSyncConfigurationPresenter.present({ project });
      }),

    update: organizationGroup
      .use(isDashboardGroup())
      .patch(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/skill-sync',
          'dashboard.projects.configure.skillSync.update'
        ),
        {
          name: 'Update project skill sync configuration',
          description: 'Update the skill sync settings for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:write'] }))
      .body(
        'default',
        v.object({
          git_lfs_threshold_bytes: gitLfsThresholdBytesValidator
        })
      )
      .output(projectSkillSyncConfigurationPresenter)
      .do(async ctx => {
        if (ctx.body.git_lfs_threshold_bytes === undefined) {
          throw new ServiceError(
            badRequestError({
              message: 'At least one skill sync field must be provided'
            })
          );
        }

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

        project = await projectSkillSyncConfigurationService.updateProjectSkillSyncConfiguration(
          {
            project,
            organization: ctx.organization,
            auditScope: ctx.auditScope,
            input: {
              skillSyncGitLfsThresholdBytes: ctx.body.git_lfs_threshold_bytes
            }
          }
        );

        return projectSkillSyncConfigurationPresenter.present({ project });
      })
  }
);
