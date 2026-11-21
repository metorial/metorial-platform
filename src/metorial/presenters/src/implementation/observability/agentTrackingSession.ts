import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { agentTrackingSessionDetailType, agentTrackingSessionType } from '../../types';
import {
  agentTrackingCostSchema,
  agentTrackingMemberSchema,
  agentTrackingModelSchema,
  agentTrackingSpendFiguresProperties,
  agentTrackingTokensSchema,
  agentTrackingUnknownModelNamesSchema,
  presentAgentTrackingCost,
  presentAgentTrackingMember,
  presentAgentTrackingSpendCost,
  presentAgentTrackingTokens
} from './agentTrackingCommon';

export let v1AgentTrackingSessionPresenter = Presenter.create(agentTrackingSessionType)
  .presenter(async ({ session }) => ({
    object: 'agent_tracking.session' as const,

    id: session.id,
    state: session.state,
    member: session.member ? presentAgentTrackingMember(session.member) : null,
    client: {
      family: session.client.family,
      name: session.client.name,
      surface: session.client.surface,
      version: session.client.version
    },
    models: session.models.map(model => ({ id: model.id, name: model.name })),
    unknown_model_names: session.unknownModelNames,
    billing_modes: session.billingModes,

    cost: presentAgentTrackingCost(session.cost),
    tokens: presentAgentTrackingTokens(session.tokens),
    requests: session.requests,
    summary_pending: session.summaryPending,

    started_at: session.startedAt,
    last_activity_at: session.lastActivityAt,
    ended_at: session.endedAt
  }))
  .schema(
    v.object({
      object: v.literal('agent_tracking.session', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description:
          'The unique identifier of the session. The same agent session always has the same id.',
        examples: ['atse_3f9c2a71d04b5e8a96c1f0d2b7e4a513']
      }),
      state: v.enumOf(['active', 'idle', 'ended'], {
        name: 'state',
        description: 'Whether the session is running, waiting, or over.'
      }),
      member: v.nullable(agentTrackingMemberSchema),
      client: v.object(
        {
          family: v.string({
            name: 'family',
            description: 'The AI coding agent.',
            examples: ['claude_code']
          }),
          name: v.nullable(
            v.string({
              name: 'name',
              description: 'The display name of the agent, when Metorial knows it.',
              examples: ['Claude Code']
            })
          ),
          surface: v.nullable(
            v.string({
              name: 'surface',
              description: 'Where the agent ran, as it reported it.',
              examples: ['cli']
            })
          ),
          version: v.nullable(
            v.string({
              name: 'version',
              description: 'The agent version it reported.',
              examples: ['2.1.317']
            })
          )
        },
        { name: 'client', description: 'The AI coding agent that ran the session.' }
      ),
      models: v.array(agentTrackingModelSchema, {
        name: 'models',
        description:
          'The models the session used, as matched to the model catalog. Filled in when the session settles, about 30 seconds after its requests arrive.'
      }),
      unknown_model_names: agentTrackingUnknownModelNamesSchema(
        'Models the session used that are not matched to the model catalog, so they have no id and are left out of models: a model the catalog does not have yet, or usage recorded before the catalog knew it (matched again only by a rebuild). Filled in when the session settles.'
      ),
      billing_modes: v.array(v.enumOf(['included', 'overage', 'api', 'unknown']), {
        name: 'billing_modes',
        description:
          'How the usage of the session was billed: included (covered by a subscription, cost at list prices), overage, api or unknown.'
      }),

      cost: agentTrackingCostSchema,
      tokens: agentTrackingTokensSchema,
      requests: v.number({ name: 'requests', description: 'Model requests.' }),
      summary_pending: v.boolean({
        name: 'summary_pending',
        description:
          'Whether newer usage has arrived than models, cost and tokens include yet. They catch up within about 30 seconds.'
      }),

      started_at: v.date({ name: 'started_at', description: 'When the session started.' }),
      last_activity_at: v.date({
        name: 'last_activity_at',
        description: 'When the session was last active. Sessions are listed by this.'
      }),
      ended_at: v.nullable(
        v.date({
          name: 'ended_at',
          description: 'When the session ended, or null while it may continue.'
        })
      )
    })
  )
  .build();

export let v1AgentTrackingSessionDetailPresenter = Presenter.create(
  agentTrackingSessionDetailType
)
  .presenter(async ({ session }, opts) => {
    let row = await v1AgentTrackingSessionPresenter.present({ session }, opts).run();

    return {
      ...row,
      object: 'agent_tracking.session_detail' as const,

      usage_by_model: session.usageByModel.map(item => ({
        kind: item.kind,
        key: item.key,
        model: item.model ? { id: item.model.id, name: item.model.name } : null,
        unknown_model_names: item.unknownModelNames,
        share: item.share,
        cost: presentAgentTrackingSpendCost(item.cost),
        requests: item.requests,
        tokens: presentAgentTrackingTokens(item.tokens)
      }))
    };
  })
  .schema(
    v.object({
      ...v1AgentTrackingSessionPresenter.schema.properties,
      object: v.literal('agent_tracking.session_detail', {
        description: "String representing the object's type"
      }),

      usage_by_model: v.array(
        v.object({
          kind: v.enumOf(['model', 'unknown'], {
            name: 'kind',
            description:
              'model for a model in the model catalog; unknown for usage whose model is not matched to the catalog (Unknown Model, see unknown_model_names).'
          }),
          key: v.string({
            name: 'key',
            description: 'The model id, or unknown. Unique within the session.',
            examples: ['claude-sonnet-4-5', 'unknown']
          }),
          model: v.nullable(agentTrackingModelSchema),
          unknown_model_names: agentTrackingUnknownModelNamesSchema(
            'On the unknown item: the models of the session that make it up. Empty on every other item.'
          ),
          share: v.nullable(
            v.number({
              name: 'share',
              description:
                'The share of the cost of the session, from 0 to 1. Null when that cost is zero or unknown.'
            })
          ),
          ...agentTrackingSpendFiguresProperties
        }),
        {
          name: 'usage_by_model',
          description:
            'Requests, tokens and cost of the session per model, most expensive first. Read from the same usage as the spend endpoints, so it fills in when the session settles, about 30 seconds after its requests arrive. Models without requests, tokens or cost are left out.'
        }
      )
    }) as any
  )
  .build();
