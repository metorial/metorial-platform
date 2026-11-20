import { v } from '@lowerdeck/validation';
import type {
  AgentTrackingCost,
  AgentTrackingMember,
  AgentTrackingSpendCost,
  AgentTrackingTokens
} from '@metorial/module-agent-tracking-query';

let moneyDescription =
  'A decimal string in US dollars with up to 9 decimal places, never rounded to cents.';

let money = (name: string, description: string) =>
  v.nullable(
    v.string({
      name,
      description: `${description} ${moneyDescription}`,
      examples: ['12.345678']
    })
  );

export let agentTrackingCostSchema = v.object(
  {
    currency: v.literal('usd', { description: 'The currency of every amount. Always usd.' }),
    total: money(
      'total',
      "The best figure for the cost. Agent tracking picks one basis per session: billed where a provider bill exists, else contract prices where a price override applies, else the agent's own estimate, else list prices computed by Metorial. It covers only the requests with a known cost (see requests_without_cost on spend figures). On spend figures: 0 when there were no requests, null when there were requests and none had a known cost. On a session: null while none of its requests has a known cost."
    ),
    billed: money(
      'billed',
      'The part of total that comes from provider bills. Not an estimate. Null when no bill covers this usage.'
    ),
    estimated: money(
      'estimated',
      "The part of total that is an estimate: total minus billed. It mixes the agent's own estimates, contract prices and list prices, and how much of each is not recorded. Null when total is null."
    ),
    is_estimate: v.boolean({
      name: 'is_estimate',
      description:
        'Whether any part of total is an estimate. Show the total as approximate when true.'
    }),
    reported_by_client: money(
      'reported_by_client',
      'The costs the agent reported itself (for Claude Code, its own estimate at list prices), summed over all usage covered here, including usage whose total uses another basis. A comparison figure, not a part of total. Null when the agent reported no cost.'
    ),
    list_price: money(
      'list_price',
      'The usage covered here, priced by Metorial at list prices whatever basis total uses. A comparison figure, not a part of total. It covers only the requests whose model has a list price (see requests_without_list_price on spend figures), so it can cover less usage than total or reported_by_client. On spend figures: 0 when there were no requests, null when there were requests and none had a list price. On a session: null while none of its requests has a list price.'
    )
  },
  {
    name: 'cost',
    description:
      'A cost with its basis. billed plus estimated is total; reported_by_client and list_price describe the same usage for comparison and are not parts of total.'
  }
);

let agentTrackingSpendCostSchema = v.intersection([
  agentTrackingCostSchema,
  v.object({
    requests_without_cost: v.number({
      name: 'requests_without_cost',
      description:
        'Model requests whose cost is not known: neither the agent nor the price list gave one. Counted per usage slice (the requests of one session to one model in 15 minutes), so requests in a slice that has any cost count as priced. When above 0, total covers only the other requests.'
    }),
    requests_without_list_price: v.number({
      name: 'requests_without_list_price',
      description:
        'Model requests that list_price does not cover, because Metorial has no list price for their model (usually a model the catalog does not have yet, or usage recorded before the catalog knew its model). Counted per usage slice like requests_without_cost. When above 0, list_price covers only requests minus this many, and is not comparable with total or reported_by_client.'
    })
  })
]);

export let presentAgentTrackingCost = (cost: AgentTrackingCost) => ({
  currency: 'usd' as const,
  total: cost.total,
  billed: cost.billed,
  estimated: cost.estimated,
  is_estimate: cost.isEstimate,
  reported_by_client: cost.reportedByClient,
  list_price: cost.listPrice
});

export let presentAgentTrackingSpendCost = (cost: AgentTrackingSpendCost) => ({
  ...presentAgentTrackingCost(cost),
  requests_without_cost: cost.requestsWithoutCost,
  requests_without_list_price: cost.requestsWithoutListPrice
});

let tokenCount = (name: string, description: string) =>
  v.number({ name, description: `${description} A count of tokens.` });

export let agentTrackingTokensSchema = v.object(
  {
    input: tokenCount('input', 'Input tokens not read from the cache.'),
    cache_read: tokenCount('cache_read', 'Input tokens read from the prompt cache.'),
    cache_write: tokenCount('cache_write', 'Input tokens written to the prompt cache.'),
    output: tokenCount('output', 'Output tokens.'),
    reasoning: tokenCount(
      'reasoning',
      'Reasoning tokens, where the agent reports them apart.'
    ),
    total: tokenCount('total', 'All of the above.')
  },
  {
    name: 'tokens',
    description: 'Tokens by kind. Tokens the agent did not report count as 0.'
  }
);

export let presentAgentTrackingTokens = (tokens: AgentTrackingTokens) => ({
  input: tokens.input,
  cache_read: tokens.cacheRead,
  cache_write: tokens.cacheWrite,
  output: tokens.output,
  reasoning: tokens.reasoning,
  total: tokens.total
});

export let agentTrackingMemberProperties = {
  object: v.literal('agent_tracking.member', {
    description: "String representing the object's type"
  }),

  id: v.string({
    name: 'id',
    description:
      'The id the usage of this member is recorded under. Use it as member_id in filters. When a member seen only in telemetry was merged into another one (usually the matched Metorial member), usage recorded before the merge keeps the old id and shows the details of the member it was merged into.',
    examples: ['aten_0mhNnEqM7XQb3vXq8gD2']
  }),
  name: v.nullable(
    v.string({
      name: 'name',
      description: 'The name of the matched Metorial member, else the name the agent reported.'
    })
  ),
  email: v.nullable(
    v.string({
      name: 'email',
      description:
        "The matched Metorial member's email, else the first email the agent reported. Null when no email is known.",
      examples: ['ada@example.com']
    })
  ),
  emails: v.array(v.string(), {
    name: 'emails',
    description: 'Every email the agents reported for this member.'
  }),
  matched: v.boolean({
    name: 'matched',
    description:
      'Whether the member is a Metorial member of this organization, matched by email. An unmatched member was seen only in telemetry.'
  }),
  consumer: v.nullable(
    v.object(
      {
        id: v.nullable(
          v.string({
            name: 'id',
            description:
              'The id of the consumer in this instance, for linking to it. Null when the matched member is not a consumer of this instance.'
          })
        ),
        name: v.string({ name: 'name', description: 'The name in Metorial.' }),
        email: v.string({ name: 'email', description: 'The email in Metorial.' })
      },
      {
        name: 'consumer',
        description: 'The matched Metorial member, or null when the member is not matched.'
      }
    )
  ),
  needs_review: v.boolean({
    name: 'needs_review',
    description:
      'Whether the member was created past the daily limit of new members for an ingestion key and should be checked.'
  })
};

export let agentTrackingMemberSchema = v.object(agentTrackingMemberProperties, {
  name: 'member',
  description: 'A person who has sent usage from an AI coding agent.'
});

export let presentAgentTrackingMember = (member: AgentTrackingMember) => ({
  object: 'agent_tracking.member' as const,

  id: member.id,
  name: member.name,
  email: member.email,
  emails: member.emails,
  matched: member.matched,
  consumer: member.consumer
    ? { id: member.consumer.id, name: member.consumer.name, email: member.consumer.email }
    : null,
  needs_review: member.needsReview
});

export let agentTrackingUnknownModelNamesSchema = (description: string) =>
  v.array(v.string(), {
    name: 'unknown_model_names',
    description: `${description} These are the model names exactly as the agent reported them; they are not model ids and cannot be used as model_id (use unknown).`
  });

export let agentTrackingModelSchema = v.object(
  {
    id: v.string({
      name: 'id',
      description: 'The model id. Use it as model_id in filters.',
      examples: ['claude-sonnet-4-5']
    }),
    name: v.nullable(
      v.string({ name: 'name', description: 'The model name, or null when it is not known.' })
    )
  },
  { name: 'model', description: 'A model.' }
);

export let agentTrackingRangeSchema = v.object(
  {
    preset: v.nullable(
      v.string({
        name: 'preset',
        description: 'The preset the range was resolved from, or null for an explicit range.',
        examples: ['last_30_days']
      })
    ),
    from: v.date({ name: 'from', description: 'The start of the range, inclusive.' }),
    to: v.date({ name: 'to', description: 'The end of the range, exclusive.' }),
    time_zone: v.string({
      name: 'time_zone',
      description: 'The IANA time zone days are counted in.',
      examples: ['Europe/Berlin']
    })
  },
  { name: 'range', description: 'The time range the figures cover.' }
);

export let presentAgentTrackingRange = (range: {
  preset: string | null;
  from: Date;
  to: Date;
  timeZone: string;
}) => ({
  preset: range.preset,
  from: range.from,
  to: range.to,
  time_zone: range.timeZone
});

export let agentTrackingSpendFiguresProperties = {
  cost: agentTrackingSpendCostSchema,
  requests: v.number({ name: 'requests', description: 'Model requests.' }),
  tokens: agentTrackingTokensSchema
};
