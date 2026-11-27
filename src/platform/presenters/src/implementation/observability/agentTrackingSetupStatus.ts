import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { agentTrackingSetupStatusType } from '../../types';

let optionStatuses = ['detected', 'not_detected', 'undetectable'] as const;

let option = (name: string, description: string) =>
  v.enumOf(optionStatuses, {
    name,
    description: `${description} detected: the data of the last 30 days proves the option is on. not_detected: no such proof yet, so it is off or not used. undetectable: the option sends nothing that could prove it.`
  });

export let v1AgentTrackingSetupStatusPresenter = Presenter.create(agentTrackingSetupStatusType)
  .presenter(async ({ setupStatus }) => ({
    object: 'agent_tracking.setup_status' as const,

    last_received_at: setupStatus.lastReceivedAt,

    options: {
      usage_and_cost: setupStatus.options.usageAndCost,
      keep_local_history: setupStatus.options.keepLocalHistory,
      repository: setupStatus.options.repository,
      tool_details: setupStatus.options.toolDetails,
      hooks: setupStatus.options.hooks
    }
  }))
  .schema(
    v.object({
      object: v.literal('agent_tracking.setup_status', {
        description: "String representing the object's type"
      }),

      last_received_at: v.nullable(
        v.date({
          name: 'last_received_at',
          description:
            'When data last arrived for this instance, through any ingestion key or device. Null when none has.'
        })
      ),
      options: v.object(
        {
          usage_and_cost: option(
            'usage_and_cost',
            'Usage and cost: sessions with model requests arrived.'
          ),
          keep_local_history: option(
            'keep_local_history',
            'Keep local history: only changes a setting on the device. Always undetectable.'
          ),
          repository: option('repository', 'Repository: a session reported its repository.'),
          tool_details: option(
            'tool_details',
            'Tool details: a tool call reported its MCP server name, which the agent sends only with tool details on. Stays not_detected until an MCP tool is used.'
          ),
          hooks: option('hooks', 'Hooks: hook records arrived.')
        },
        {
          name: 'options',
          description:
            'For each option of the settings file, whether the incoming data shows it is on.'
        }
      )
    })
  )
  .build();
