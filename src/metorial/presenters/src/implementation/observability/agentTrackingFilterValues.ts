import { v } from '@lowerdeck/validation';
import { filterFieldKeys, requestRecordDays } from '@metorial/module-agent-tracking-query';
import { Presenter } from '@metorial/presenter';
import { agentTrackingFilterValuesType } from '../../types';
import {
  agentTrackingClientSchema,
  agentTrackingMemberSchema,
  agentTrackingModelSchema,
  agentTrackingProviderSchema,
  agentTrackingRangeSchema,
  agentTrackingRepositorySchema,
  presentAgentTrackingMember,
  presentAgentTrackingProvider,
  presentAgentTrackingRange,
  presentAgentTrackingRepository
} from './agentTrackingCommon';

export let v1AgentTrackingFilterValuesPresenter = Presenter.create(
  agentTrackingFilterValuesType
)
  .presenter(async ({ filterValues }) => ({
    object: 'agent_tracking.filter_values' as const,

    field: filterValues.field,
    range: presentAgentTrackingRange(filterValues.range),
    truncated: filterValues.truncated,

    items: filterValues.items.map(item => ({
      value: item.value,
      kind: item.kind,
      member: item.member ? presentAgentTrackingMember(item.member) : null,
      model: item.model ? { id: item.model.id, name: item.model.name } : null,
      client: item.client ? { family: item.client.family, name: item.client.name } : null,
      repository: item.repository ? presentAgentTrackingRepository(item.repository) : null,
      provider: item.provider ? presentAgentTrackingProvider(item.provider) : null,
      requests: item.requests
    }))
  }))
  .schema(
    v.object({
      object: v.literal('agent_tracking.filter_values', {
        description: "String representing the object's type"
      }),

      field: v.enumOf(filterFieldKeys, {
        name: 'field',
        description: 'The filter the values are for.'
      }),
      range: agentTrackingRangeSchema,
      truncated: v.boolean({
        name: 'truncated',
        description: 'Whether more values exist than were returned. Narrow them with search.'
      }),

      items: v.array(
        v.object({
          value: v.string({
            name: 'value',
            description:
              'The value to pass as `member_id`, `model_id`, `client_family`, `repository_id`, `branch`, `ticket` or `provider_id`, or as `seat` to member insights. `unknown` selects usage without a member (Unknown Member), or usage whose model is not matched to the model catalog (Unknown Model). Seat values are passed on as the agent reported them on its requests.',
            examples: [
              'aten_0mhNnEqM7XQb3vXq8gD2',
              'claude-sonnet-4-5',
              'claude_code',
              'premium',
              'ENG-123',
              'pro_0mhNnEqM7XQb3vXq8gD2',
              'unknown'
            ]
          }),
          kind: v.enumOf([...filterFieldKeys, 'unknown'], {
            name: 'kind',
            description:
              'The field the value is for, or `unknown` for the Unknown Member or Unknown Model option.'
          }),
          member: v.nullable(agentTrackingMemberSchema),
          model: v.nullable(agentTrackingModelSchema),
          client: v.nullable(agentTrackingClientSchema),
          repository: v.nullable(agentTrackingRepositorySchema),
          provider: v.nullable(agentTrackingProviderSchema),
          requests: v.nullable(
            v.number({
              name: 'requests',
              description: `Model requests in the range, for ordering. Seat values count request records, which are kept for ${requestRecordDays} days. Provider values count the tool calls in the range that reached the provider. \`null\` for the \`unknown\` option, which is offered without being counted, and for values described by \`value\`.`
            })
          )
        }),
        {
          name: 'items',
          description:
            'Values seen in the range, most requests first, at most 100. The unknown option (Unknown Member or Unknown Model) comes last, unless a search leaves it out. With value: exactly those values, whether or not they sent usage, unknown last.'
        }
      )
    })
  )
  .build();
