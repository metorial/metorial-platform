import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { agentTrackingContentModes } from '@metorial/module-agent-tracking-sync/src/lib/settings';
import {
  agentTrackingInstanceSettingsType,
  agentTrackingOrganizationSettingsType,
  agentTrackingProjectSettingsType
} from '../../types';

let serviceStatusSchema = v.enumOf(['applied', 'pending', 'unknown'], {
  name: 'service_status',
  description:
    'Whether agent tracking holds the stored settings. pending: it does not yet; a change that could not be sent is retried in the background, and the nightly reconcile sends the stored settings again. Until then a narrower content policy or a disabled hosted model may not apply yet. unknown: agent tracking could not be asked.'
});

let retentionDays = (name: string, description: string) =>
  v.nullable(
    v.number({
      name,
      description: `${description} Null while the project uses the default.`,
      examples: [90]
    })
  );

let defaultDays = (name: string, description: string) =>
  v.number({ name, description, examples: [90] });

export let v1AgentTrackingOrganizationSettingsPresenter = Presenter.create(
  agentTrackingOrganizationSettingsType
)
  .presenter(async ({ settings, serviceStatus }) => ({
    object: 'agent_tracking.organization_settings' as const,

    organization_id: settings.organizationId,
    service_status: serviceStatus,

    privacy: {
      hide_individuals: settings.privacy.hideIndividuals,
      min_group_users: settings.privacy.minGroupUsers
    },
    desktop: {
      tool_details: settings.desktop.toolDetails,
      session_context: settings.desktop.sessionContext,
      session_titles: settings.desktop.sessionTitles,
      history_import: settings.desktop.historyImport
    },
    links: { ticket_url_template: settings.links.ticketUrlTemplate }
  }))
  .schema(
    v.object({
      object: v.literal('agent_tracking.organization_settings', {
        description: "String representing the object's type"
      }),

      organization_id: v.string({
        name: 'organization_id',
        description: 'The organization the privacy settings apply to.'
      }),
      service_status: serviceStatusSchema,

      privacy: v.object(
        {
          hide_individuals: v.boolean({
            name: 'hide_individuals',
            description:
              'Whether agent usage is shown only as daily totals of whole UTC days. When true, the breakdown by member or model, filters and filter values, the members seen, the session list and session details are rejected.'
          }),
          min_group_users: v.number({
            name: 'min_group_users',
            description:
              'With hide_individuals, the fewest people with usage a day must have to be shown. Smaller days are hidden. At least 3.',
            examples: [5]
          })
        },
        {
          name: 'privacy',
          description: 'Organization-wide privacy settings for agent usage.'
        }
      ),
      desktop: v.object(
        {
          tool_details: v.boolean({
            name: 'tool_details',
            description:
              'Metorial Desktop turns on detailed tool reporting in the AI tools it sets up, so tool inputs, file paths and commands, which carry the names of skills and MCP servers, are sent. Off by default.'
          }),
          session_context: v.boolean({
            name: 'session_context',
            description:
              'Metorial Desktop reports the repository, branch, commits, pull requests and ticket keys of each agent session. Folder paths, commit messages and code are never sent. On by default.'
          }),
          session_titles: v.boolean({
            name: 'session_titles',
            description:
              'Metorial Desktop reports session titles, which the AI tools write from what was typed and so can contain details of the work. Off by default.'
          }),
          history_import: v.boolean({
            name: 'history_import',
            description:
              'Metorial Desktop imports agent sessions from before it was installed, from the session files the AI tools keep on each device. Off by default.'
          })
        },
        {
          name: 'desktop',
          description:
            "What the AI tools Metorial Desktop sets up on members' computers report."
        }
      ),
      links: v.object(
        {
          ticket_url_template: v.nullable(
            v.string({
              name: 'ticket_url_template',
              description:
                'URL that ticket keys link to, with `{key}` where the key goes. `null` while ticket keys are not linked.',
              examples: ['https://linear.app/acme/issue/{key}']
            })
          )
        },
        { name: 'links', description: 'Where agent usage links out to.' }
      )
    })
  )
  .build();

export let v1AgentTrackingProjectSettingsPresenter = Presenter.create(
  agentTrackingProjectSettingsType
)
  .presenter(async ({ settings, serviceStatus, retentionDefaults }) => ({
    object: 'agent_tracking.project_settings' as const,

    organization_id: settings.organizationId,
    project_id: settings.projectId,
    service_status: serviceStatus,

    retention: {
      record_days: settings.retention.recordDays,
      content_days: settings.retention.contentDays,
      usage_days: settings.retention.usageDays,
      default_record_days: retentionDefaults.recordDays,
      default_content_days: retentionDefaults.contentDays,
      default_usage_days: retentionDefaults.usageDays
    }
  }))
  .schema(
    v.object({
      object: v.literal('agent_tracking.project_settings', {
        description: "String representing the object's type"
      }),

      organization_id: v.string({
        name: 'organization_id',
        description: 'The organization of the project.'
      }),
      project_id: v.string({
        name: 'project_id',
        description: 'The project the retention settings apply to, with all of its instances.'
      }),
      service_status: serviceStatusSchema,

      retention: v.object(
        {
          record_days: retentionDays('record_days', 'How many days raw records are kept.'),
          content_days: retentionDays(
            'content_days',
            'How many days stored content, such as paths and text the content policy keeps, is kept.'
          ),
          usage_days: retentionDays(
            'usage_days',
            'How many days sessions and usage figures are kept.'
          ),
          default_record_days: defaultDays(
            'default_record_days',
            'The number of days raw records are kept by default.'
          ),
          default_content_days: defaultDays(
            'default_content_days',
            'The number of days stored content is kept by default.'
          ),
          default_usage_days: defaultDays(
            'default_usage_days',
            'The number of days sessions and usage figures are kept by default.'
          )
        },
        {
          name: 'retention',
          description:
            'How long agent usage data of the project is kept. Expiry is fixed when data is written, so a change applies to data that arrives after it. Stored content never outlives its raw records.'
        }
      )
    })
  )
  .build();

export let v1AgentTrackingInstanceSettingsPresenter = Presenter.create(
  agentTrackingInstanceSettingsType
)
  .presenter(async ({ settings, serviceStatus, privacy }) => ({
    object: 'agent_tracking.instance_settings' as const,

    organization_id: settings.organizationId,
    project_id: settings.projectId,
    instance_id: settings.instanceId,
    service_status: serviceStatus,

    content: { mode: settings.content.mode },
    classification: {
      deterministic_enabled: settings.classification.deterministicEnabled,
      ai_enabled: settings.classification.aiEnabled
    },
    privacy: {
      hide_individuals: privacy.hideIndividuals,
      min_group_users: privacy.minGroupUsers
    }
  }))
  .schema(
    v.object({
      object: v.literal('agent_tracking.instance_settings', {
        description: "String representing the object's type"
      }),

      organization_id: v.string({
        name: 'organization_id',
        description: 'The organization of the instance.'
      }),
      project_id: v.string({
        name: 'project_id',
        description: 'The project of the instance.'
      }),
      instance_id: v.string({
        name: 'instance_id',
        description: 'The instance the content and classification settings apply to.'
      }),
      service_status: serviceStatusSchema,

      content: v.object(
        {
          mode: v.enumOf(agentTrackingContentModes, {
            name: 'mode',
            description:
              'What is kept of prompts, responses and tool calls. basic: only their length and a keyed hash. shape: also a structured summary without the values. full: also the text itself, encrypted. Keys issued by Metorial follow it; keys created before it was available keep basic, and while agent tracking has no policy for the instance it keeps basic.'
          })
        },
        { name: 'content', description: 'The content policy of the instance.' }
      ),
      classification: v.object(
        {
          deterministic_enabled: v.boolean({
            name: 'deterministic_enabled',
            description:
              'Whether sessions are assigned to projects and other entities from ticket references and earlier confirmed matches. Makes no external calls.'
          }),
          ai_enabled: v.boolean({
            name: 'ai_enabled',
            description:
              'Whether a hosted classification model assigns the sessions the deterministic rules leave open. It receives session context and may run outside the organization region.'
          })
        },
        {
          name: 'classification',
          description: 'How sessions of the instance are classified.'
        }
      ),
      privacy: v.object(
        {
          hide_individuals: v.boolean({
            name: 'hide_individuals',
            description: 'Whether the organization shows agent usage only in aggregate.'
          }),
          min_group_users: v.number({
            name: 'min_group_users',
            description:
              'With hide_individuals, the fewest people with usage a day must have to be shown.',
            examples: [5]
          })
        },
        {
          name: 'privacy',
          description:
            "The organization's privacy settings as they apply to this instance. Read-only here; they are changed in the organization's agent tracking settings."
        }
      )
    })
  )
  .build();
