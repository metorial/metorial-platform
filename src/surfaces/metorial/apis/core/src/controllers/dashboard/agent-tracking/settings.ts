import { v } from '@lowerdeck/validation';
import {
  agentTrackingContentModes,
  agentTrackingSettingsService,
  minGroupUsersLimits,
  retentionDaysLimits,
  serviceRetentionDefaults
} from '@metorial/module-agent-tracking-sync';
import { projectService } from '@metorial/module-organization';
import {
  agentTrackingInstanceSettingsPresenter,
  agentTrackingOrganizationSettingsPresenter,
  agentTrackingProjectSettingsPresenter
} from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import { organizationGroup } from '../../../middleware/organizationGroup';
import { requireAgentTrackingEnabled } from '../../../middleware/requireAgentTrackingEnabled';
import { agentTrackingBasePath, agentTrackingReadGroup } from './readGroup';

let organizationSettingsPath =
  '/dashboard/organizations/:organizationId/configure/agent-tracking';

let projectSettingsPath =
  '/dashboard/organizations/:organizationId/projects/:projectId/configure/agent-tracking';

let instanceSettingsPath = `${agentTrackingBasePath}/settings`;

let organizationSettingsGroup = organizationGroup
  .use(isDashboardGroup())
  .use(requireAgentTrackingEnabled());

let projectSettingsGroup = organizationSettingsGroup
  .use(async ctx => ({
    project: await projectService.getProjectById({
      organization: ctx.organization,
      projectId: ctx.params.projectId,
      member: ctx.member,
      actor: ctx.actor
    })
  }))
  .use(requireAgentTrackingEnabled());

let retentionDays = (name: string, description: string) =>
  v.optional(
    v.nullable(
      v.number({
        name,
        description: `${description} From ${retentionDaysLimits.min} to ${retentionDaysLimits.max}. null returns to the default.`,
        examples: [90],
        modifiers: [
          v.integer(),
          v.minValue(retentionDaysLimits.min),
          v.maxValue(retentionDaysLimits.max)
        ]
      })
    )
  );

export let dashboardAgentTrackingOrganizationSettingsController = Controller.create(
  {
    name: 'Agent Tracking Organization Settings',
    description: 'The privacy settings of agent tracking, for the whole organization.',
    hideInDocs: true
  },
  {
    get: organizationSettingsGroup
      .get(
        Path(organizationSettingsPath, 'dashboard.organizations.configure.agentTracking.get'),
        {
          name: 'Get agent tracking organization settings',
          description: 'Returns the privacy settings of agent tracking for the organization.',
          hideInDocs: true
        }
      )
      .use(checkAccess({ possibleScopes: ['organization:read'] }))
      .output(agentTrackingOrganizationSettingsPresenter)
      .do(async ctx =>
        agentTrackingOrganizationSettingsPresenter.present(
          await agentTrackingSettingsService.getOrganizationSettings({
            organization: ctx.organization
          })
        )
      ),

    update: organizationSettingsGroup
      .patch(
        Path(
          organizationSettingsPath,
          'dashboard.organizations.configure.agentTracking.update'
        ),
        {
          name: 'Update agent tracking organization settings',
          description:
            'Changes the privacy settings of the organization; leaving a field out keeps its value. Applies to the next request. service_status says whether agent tracking has taken the change yet.',
          hideInDocs: true
        }
      )
      .use(checkAccess({ possibleScopes: ['organization:write'] }))
      .body(
        'default',
        v.object({
          privacy: v.object(
            {
              hide_individuals: v.optional(
                v.boolean({
                  name: 'hide_individuals',
                  description:
                    'Show agent usage only in aggregate, never per member or per session.'
                })
              ),
              min_group_users: v.optional(
                v.number({
                  name: 'min_group_users',
                  description: `With hide_individuals, the fewest people a group must have to be shown. From ${minGroupUsersLimits.min} to ${minGroupUsersLimits.max}.`,
                  examples: [5],
                  modifiers: [
                    v.integer(),
                    v.minValue(minGroupUsersLimits.min),
                    v.maxValue(minGroupUsersLimits.max)
                  ]
                })
              )
            },
            { name: 'privacy', description: 'Organization-wide privacy settings.' }
          )
        })
      )
      .output(agentTrackingOrganizationSettingsPresenter)
      .do(async ctx =>
        agentTrackingOrganizationSettingsPresenter.present(
          await agentTrackingSettingsService.updateOrganizationSettings({
            organization: ctx.organization,
            auditScope: ctx.auditScope,
            input: {
              privacy: {
                hideIndividuals: ctx.body.privacy.hide_individuals,
                minGroupUsers: ctx.body.privacy.min_group_users
              }
            }
          })
        )
      )
  }
);

export let dashboardAgentTrackingProjectSettingsController = Controller.create(
  {
    name: 'Agent Tracking Project Settings',
    description: 'The retention of agent tracking, for every instance of a project.',
    hideInDocs: true
  },
  {
    get: projectSettingsGroup
      .get(Path(projectSettingsPath, 'dashboard.projects.configure.agentTracking.get'), {
        name: 'Get agent tracking project settings',
        description: 'Returns the retention of agent tracking for the project.',
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .output(agentTrackingProjectSettingsPresenter)
      .do(async ctx =>
        agentTrackingProjectSettingsPresenter.present({
          ...(await agentTrackingSettingsService.getProjectSettings({
            organization: ctx.organization,
            project: ctx.project
          })),
          retentionDefaults: serviceRetentionDefaults
        })
      ),

    update: projectSettingsGroup
      .patch(Path(projectSettingsPath, 'dashboard.projects.configure.agentTracking.update'), {
        name: 'Update agent tracking project settings',
        description:
          'Changes the retention of the project; leaving a field out keeps its value. service_status says whether agent tracking has taken the change yet.',
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: ['organization.project:manage'] }))
      .body(
        'default',
        v.object({
          retention: v.object(
            {
              record_days: retentionDays('record_days', 'Days raw records are kept.'),
              content_days: retentionDays('content_days', 'Days stored content is kept.'),
              usage_days: retentionDays(
                'usage_days',
                'Days sessions and usage figures are kept.'
              )
            },
            {
              name: 'retention',
              description:
                'Retention of the project, for data that arrives after the change. Data already stored keeps the expiry it was written with.'
            }
          )
        })
      )
      .output(agentTrackingProjectSettingsPresenter)
      .do(async ctx =>
        agentTrackingProjectSettingsPresenter.present({
          ...(await agentTrackingSettingsService.updateProjectSettings({
            organization: ctx.organization,
            project: ctx.project,
            auditScope: ctx.auditScope,
            input: {
              retention: {
                recordDays: ctx.body.retention.record_days,
                contentDays: ctx.body.retention.content_days,
                usageDays: ctx.body.retention.usage_days
              }
            }
          })),
          retentionDefaults: serviceRetentionDefaults
        })
      )
  }
);

export let dashboardAgentTrackingSettingsController = Controller.create(
  {
    name: 'Agent Tracking Settings',
    description: 'The content and classification settings of agent tracking, for an instance.',
    hideInDocs: true
  },
  {
    get: agentTrackingReadGroup
      .get(Path(instanceSettingsPath, 'dashboard.instance.agentTracking.settings.get'), {
        name: 'Get agent tracking settings',
        description:
          'Returns the content and classification settings of agent tracking for the instance.',
        hideInDocs: true
      })
      .output(agentTrackingInstanceSettingsPresenter)
      .do(async ctx =>
        agentTrackingInstanceSettingsPresenter.present(
          await agentTrackingSettingsService.getInstanceSettings({
            organization: ctx.organization,
            project: ctx.project,
            instance: ctx.instance
          })
        )
      ),

    update: agentTrackingReadGroup
      .patch(Path(instanceSettingsPath, 'dashboard.instance.agentTracking.settings.update'), {
        name: 'Update agent tracking settings',
        description:
          'Changes the content and classification settings of the instance; leaving a field out keeps its value. service_status says whether agent tracking has taken the change yet.',
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: ['instance.agent_tracking:write'] }))
      .body(
        'default',
        v.object({
          content: v.optional(
            v.object(
              {
                mode: v.optional(
                  v.enumOf(agentTrackingContentModes, {
                    name: 'mode',
                    description:
                      'What is kept of prompts, responses and tool calls: basic, shape or full. Keys issued by Metorial follow it; keys created before it was available keep basic.'
                  })
                )
              },
              { name: 'content', description: 'The content policy of the instance.' }
            )
          ),
          classification: v.optional(
            v.object(
              {
                deterministic_enabled: v.optional(
                  v.boolean({
                    name: 'deterministic_enabled',
                    description:
                      'Classify sessions from ticket references and earlier matches.'
                  })
                ),
                ai_enabled: v.optional(
                  v.boolean({
                    name: 'ai_enabled',
                    description:
                      'Let a hosted model classify the sessions the rules leave open. It receives session context and may run outside the organization region.'
                  })
                )
              },
              { name: 'classification', description: 'Classification of the instance.' }
            )
          )
        })
      )
      .output(agentTrackingInstanceSettingsPresenter)
      .do(async ctx =>
        agentTrackingInstanceSettingsPresenter.present(
          await agentTrackingSettingsService.updateInstanceSettings({
            organization: ctx.organization,
            project: ctx.project,
            instance: ctx.instance,
            auditScope: ctx.auditScope,
            input: {
              content: ctx.body.content && { mode: ctx.body.content.mode },
              classification: ctx.body.classification && {
                deterministicEnabled: ctx.body.classification.deterministic_enabled,
                aiEnabled: ctx.body.classification.ai_enabled
              }
            }
          })
        )
      )
  }
);
