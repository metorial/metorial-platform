import { v } from '@lowerdeck/validation';
import {
  maxDistinctCount,
  maxMcpServers,
  maxMcpTools,
  maxSkills,
  providerCallGroups,
  providerCallsLimit,
  type AgentTrackingProviderCallFigures,
  type AgentTrackingToolCallFigures
} from '@metorial/module-agent-tracking-query';
import { Presenter } from '@metorial/presenter';
import {
  agentTrackingMcpServerUsageType,
  agentTrackingProviderCallsType,
  agentTrackingSkillUsageType
} from '../../types';
import {
  agentTrackingClientSchema,
  agentTrackingMemberSchema,
  agentTrackingProviderSchema,
  agentTrackingRangeSchema,
  agentTrackingRepositorySchema,
  presentAgentTrackingMember,
  presentAgentTrackingProvider,
  presentAgentTrackingRange,
  presentAgentTrackingRepository
} from './agentTrackingCommon';

let count = (name: string, description: string) => v.number({ name, description });

let rate = (name: string, description: string) =>
  v.nullable(
    v.number({
      name,
      description: `${description} From 0 to 1. \`null\` when there were no calls.`
    })
  );

let membersDescription = `Distinct members, counting usage without a member (Unknown Member) as none. Counting stops at ${maxDistinctCount.toLocaleString('en-US')}.`;

let toolDetailsSchema = v.boolean({
  name: 'tool_details',
  description:
    'Whether Detailed Tool Reporting is on. Without it, Claude Code set up by Metorial sends no custom skill or MCP server names; Codex always does. Unnamed usage counts only in `summary`.'
});

let countsCappedSchema = v.boolean({
  name: 'counts_capped',
  description: `Whether a count of members reached ${maxDistinctCount.toLocaleString('en-US')}, where counting stops. The count is then at least the number shown.`
});

let lastUsedSchema = (description: string) =>
  v.nullable(
    v.date({ name: 'last_used_at', description: `${description} \`null\` when not known.` })
  );

let callFigureProperties = {
  calls: count('calls', 'Tool calls.'),
  failed: count('failed', 'Calls that ended in an error, a timeout, a refusal or a block.'),
  error_rate: rate('error_rate', 'Share of calls that failed.'),
  members: count('members', membersDescription),
  last_used_at: lastUsedSchema('When the last call happened.')
};

let presentCallFigures = (figures: AgentTrackingToolCallFigures) => ({
  calls: figures.calls,
  failed: figures.failed,
  error_rate: figures.errorRate,
  members: figures.members,
  last_used_at: figures.lastUsedAt
});

let truncatedSchema = (limit: string) =>
  v.boolean({
    name: 'truncated',
    description: `Whether more ${limit} were used than are listed. The most used come first.`
  });

let sourceNote =
  'Counted from the telemetry AI coding agents send, not from Metorial’s own MCP server logs. Results can be up to a minute old.';

export let v1AgentTrackingSkillUsagePresenter = Presenter.create(agentTrackingSkillUsageType)
  .presenter(async ({ usage }) => ({
    object: 'agent_tracking.skill_usage' as const,

    range: presentAgentTrackingRange(usage.range),
    tool_details: usage.toolDetails,
    summary: {
      activations: usage.summary.activations,
      named_activations: usage.summary.namedActivations,
      members: usage.summary.members,
      counts_capped: usage.summary.countsCapped
    },
    items: usage.items.map(item => ({
      name: item.name,
      activations: item.activations,
      members: item.members,
      last_used_at: item.lastUsedAt
    })),
    truncated: usage.truncated
  }))
  .schema(
    v.object(
      {
        object: v.literal('agent_tracking.skill_usage', {
          description: 'String representing the object’s type.'
        }),

        range: agentTrackingRangeSchema,
        tool_details: toolDetailsSchema,
        summary: v.object(
          {
            activations: count('activations', 'Skill activations in the range.'),
            named_activations: count(
              'named_activations',
              'The activations that came with a skill name. The others are counted but not listed.'
            ),
            members: count('members', `Members who activated a skill. ${membersDescription}`),
            counts_capped: countsCappedSchema
          },
          { name: 'summary', description: 'All skill activations in the range.' }
        ),
        items: v.array(
          v.object(
            {
              name: v.string({
                name: 'name',
                description: 'The skill name, as the agent reported it.',
                examples: ['pdf']
              }),
              activations: count('activations', 'Times the skill was activated.'),
              members: count('members', `Members who activated it. ${membersDescription}`),
              last_used_at: lastUsedSchema('When it was last activated.')
            },
            { name: 'skill', description: 'A skill and how it was used.' }
          ),
          {
            name: 'items',
            description: `The skills with a name, most activated first. At most ${maxSkills.toLocaleString('en-US')}.`
          }
        ),
        truncated: truncatedSchema('skills')
      },
      {
        name: 'skill_usage',
        description: `How often each skill was activated over a range. ${sourceNote}`
      }
    )
  )
  .build();

export let v1AgentTrackingMcpServerUsagePresenter = Presenter.create(
  agentTrackingMcpServerUsageType
)
  .presenter(async ({ usage }) => ({
    object: 'agent_tracking.mcp_server_usage' as const,

    range: presentAgentTrackingRange(usage.range),
    tool_details: usage.toolDetails,
    summary: {
      ...presentCallFigures(usage.summary),
      named_calls: usage.summary.namedCalls,
      counts_capped: usage.summary.countsCapped
    },
    items: usage.items.map(item => ({
      name: item.name,
      provider: item.provider ? presentAgentTrackingProvider(item.provider) : null,
      ...presentCallFigures(item),
      tools: item.tools.map(tool => ({ name: tool.name, ...presentCallFigures(tool) }))
    })),
    truncated: usage.truncated
  }))
  .schema(
    v.object(
      {
        object: v.literal('agent_tracking.mcp_server_usage', {
          description: 'String representing the object’s type.'
        }),

        range: agentTrackingRangeSchema,
        tool_details: toolDetailsSchema,
        summary: v.object(
          {
            ...callFigureProperties,
            calls: count(
              'calls',
              'MCP tool calls, including those that came without a server name.'
            ),
            members: count('members', `Members who called an MCP tool. ${membersDescription}`),
            named_calls: count(
              'named_calls',
              'The MCP tool calls that came with a server name. The others are counted but not listed.'
            ),
            counts_capped: countsCappedSchema
          },
          {
            name: 'summary',
            description: 'All MCP tool calls in the range, with or without a server name.'
          }
        ),
        items: v.array(
          v.object(
            {
              name: v.string({
                name: 'name',
                description:
                  'The MCP server name the agent reported: the name of its entry in the agent’s configuration.',
                examples: ['metorial-github']
              }),
              provider: v.nullable(agentTrackingProviderSchema, {
                description:
                  'The Metorial provider every matched call of this server reached. `null` when no call or several providers matched, or the provider is not available to you.'
              }),
              ...callFigureProperties,
              tools: v.array(
                v.object(
                  {
                    name: v.string({
                      name: 'name',
                      description: 'The tool name on the server.',
                      examples: ['create_issue']
                    }),
                    ...callFigureProperties
                  },
                  { name: 'tool', description: 'A tool of the server and how it was called.' }
                ),
                {
                  name: 'tools',
                  description: `The tools of the server, most called first. At most ${maxMcpTools.toLocaleString('en-US')} across all servers.`
                }
              )
            },
            { name: 'mcp_server', description: 'An MCP server and how its tools were called.' }
          ),
          {
            name: 'items',
            description: `The MCP servers with a name, most called first. At most ${maxMcpServers.toLocaleString('en-US')}.`
          }
        ),
        truncated: truncatedSchema('servers or tools')
      },
      {
        name: 'mcp_server_usage',
        description: `How often the tools of each MCP server were called over a range, with failures. ${sourceNote}`
      }
    )
  )
  .build();

let providerCallFigureProperties = {
  calls: count('calls', 'Tool calls.'),
  failed: count('failed', 'Calls that ended in an error, a timeout, a refusal or a block.')
};

let presentProviderCallFigures = (figures: AgentTrackingProviderCallFigures) => ({
  calls: figures.calls,
  failed: figures.failed
});

export let v1AgentTrackingProviderCallsPresenter = Presenter.create(
  agentTrackingProviderCallsType
)
  .presenter(async ({ providerCalls }) => ({
    object: 'agent_tracking.provider_calls' as const,

    range: presentAgentTrackingRange(providerCalls.range),
    group_by: providerCalls.groupBy,
    provider_id: providerCalls.providerId,
    tool_key: providerCalls.toolKey,
    total: presentProviderCallFigures(providerCalls.total),
    items: providerCalls.items.map(item => ({
      kind: item.kind,
      key: item.key,
      member: item.member ? presentAgentTrackingMember(item.member) : null,
      repository: item.repository ? presentAgentTrackingRepository(item.repository) : null,
      client: item.client ? { family: item.client.family, name: item.client.name } : null,
      ...presentProviderCallFigures(item)
    }))
  }))
  .schema(
    v.object(
      {
        object: v.literal('agent_tracking.provider_calls', {
          description: 'String representing the object’s type.'
        }),

        range: agentTrackingRangeSchema,
        group_by: v.enumOf(providerCallGroups, {
          name: 'group_by',
          description: 'What the calls are grouped by.'
        }),
        provider_id: v.nullable(
          v.string({
            name: 'provider_id',
            description: 'The provider the calls were narrowed to. `null` for every provider.',
            examples: ['pro_0mhNnEqM7XQb3vXq8gD2']
          })
        ),
        tool_key: v.nullable(
          v.string({
            name: 'tool_key',
            description: 'The tool the calls were narrowed to. `null` for every tool.',
            examples: ['create_issue']
          })
        ),
        total: v.object(providerCallFigureProperties, {
          name: 'total',
          description: 'All counted calls in the range, including those not listed.'
        }),
        items: v.array(
          v.object(
            {
              kind: v.enumOf([...providerCallGroups, 'unknown', 'other'], {
                name: 'kind',
                description:
                  '`unknown` for calls without a repository or member. `other` for the calls of every group past the listed ones.'
              }),
              key: v.string({
                name: 'key',
                description:
                  'The repository or member ID, the client family, `unknown` or `other`. Unique within the list.',
                examples: ['aten_0mhNnEqM7XQb3vXq8gD2', 'claude_code', 'unknown']
              }),
              member: v.nullable(agentTrackingMemberSchema),
              repository: v.nullable(agentTrackingRepositorySchema),
              client: v.nullable(agentTrackingClientSchema),
              ...providerCallFigureProperties
            },
            { name: 'group', description: 'The calls of one repository, member or client.' }
          ),
          {
            name: 'items',
            description: `The groups with the most calls first, at most ${providerCallsLimit}, then \`other\` when more groups had calls.`
          }
        )
      },
      {
        name: 'provider_calls',
        description: `MCP tool calls of AI coding agents that reached a Metorial provider, by repository, member or client. Only Claude Code and Codex calls are matched to Metorial’s own tool calls, a few minutes after they happen. ${sourceNote}`
      }
    )
  )
  .build();
