import { v } from '@lowerdeck/validation';
import type {
  AgentTrackingCost,
  AgentTrackingMember,
  AgentTrackingProvider,
  AgentTrackingRepository,
  AgentTrackingSpendCost,
  AgentTrackingTicket,
  AgentTrackingTokens
} from '@metorial/module-agent-tracking-query';

let moneyDescription =
  'An integer in micro-dollars: millionths of a US dollar, so 12345678 is $12.345678.';

export let agentTrackingMicrosSchema = (name: string, description: string) =>
  v.number({ name, description: `${description} ${moneyDescription}`, examples: [12345678] });

export let agentTrackingNullableMicrosSchema = (name: string, description: string) =>
  v.nullable(agentTrackingMicrosSchema(name, description));

export let agentTrackingCostSchema = v.object(
  {
    currency: v.literal('usd', { description: 'The currency of every amount. Always usd.' }),
    total_micros: agentTrackingNullableMicrosSchema(
      'total_micros',
      "The best figure for the cost. Agent tracking picks one basis per session: billed where a provider bill exists, else contract prices where a price override applies, else the agent's own estimate, else list prices computed by Metorial. It covers only the requests with a known cost (see requests_without_cost on spend figures). On spend figures: 0 when there was no usage, null when there was usage and none of it had a known cost. On a session: null while none of its requests has a known cost. On a member: null when none of the counted sessions has a known cost; it covers only the sessions with one."
    ),
    billed_micros: agentTrackingNullableMicrosSchema(
      'billed_micros',
      'The part of total_micros that comes from provider bills. Not an estimate. Null when no bill covers this usage.'
    ),
    estimated_micros: agentTrackingNullableMicrosSchema(
      'estimated_micros',
      "The part of total_micros that is an estimate: total_micros minus billed_micros, never below 0. It mixes the agent's own estimates, contract prices and list prices, and how much of each is not recorded. Null when total_micros is null."
    ),
    is_estimate: v.boolean({
      name: 'is_estimate',
      description:
        'Whether any part of total_micros is an estimate. Show the total as approximate when true.'
    }),
    reported_by_client_micros: agentTrackingNullableMicrosSchema(
      'reported_by_client_micros',
      'The costs the agent reported itself (for Claude Code, its own estimate at list prices), summed over all usage covered here, including usage whose total uses another basis. A comparison figure, not a part of total_micros. Null when the agent reported no cost.'
    ),
    list_price_micros: agentTrackingNullableMicrosSchema(
      'list_price_micros',
      'The usage covered here, priced by Metorial at list prices whatever basis total_micros uses. A comparison figure, not a part of total_micros. It covers only the requests whose model has a list price (see requests_without_list_price on spend figures), so it can cover less usage than total_micros or reported_by_client_micros. On spend figures: 0 when there was no usage, null when there was usage and none of it had a list price. On a session: null while none of its requests has a list price. On a member: null when none of the counted sessions has a list price; it covers only the sessions with one.'
    )
  },
  {
    name: 'cost',
    description:
      'A cost with its basis. estimated_micros is total_micros minus billed_micros, never below 0, so the two add up to total_micros only while billed_micros is at most total_micros; reported_by_client_micros and list_price_micros describe the same usage for comparison and are not parts of total_micros.'
  }
);

export let agentTrackingSpendCostSchema = v.intersection([
  agentTrackingCostSchema,
  v.object({
    requests_without_cost: v.number({
      name: 'requests_without_cost',
      description:
        'Model requests whose cost is not known: neither the agent nor the price list gave one. Counted per usage slice (the requests of one session to one model in 15 minutes), so requests in a slice that has any cost count as priced. When above 0, total_micros covers only the other requests. Usage an agent reports per turn, as Cursor does, has tokens but no requests, so it is not counted here.'
    }),
    requests_without_list_price: v.number({
      name: 'requests_without_list_price',
      description:
        'Model requests that list_price_micros does not cover, because Metorial has no list price for their model (usually a model the catalog does not have yet, or usage recorded before the catalog knew its model). Counted per usage slice like requests_without_cost. When above 0, list_price_micros covers only requests minus this many, and is not comparable with total_micros or reported_by_client_micros.'
    })
  })
]);

export let presentAgentTrackingCost = (cost: AgentTrackingCost) => ({
  currency: 'usd' as const,
  total_micros: cost.totalMicros,
  billed_micros: cost.billedMicros,
  estimated_micros: cost.estimatedMicros,
  is_estimate: cost.isEstimate,
  reported_by_client_micros: cost.reportedByClientMicros,
  list_price_micros: cost.listPriceMicros
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

export let agentTrackingClientSchema = v.object(
  {
    family: v.string({
      name: 'family',
      description:
        'The client family, such as `claude_code`. A family Metorial does not know is passed on as the client reported it.',
      examples: ['claude_code']
    }),
    name: v.nullable(
      v.string({
        name: 'name',
        description: 'The display name of a known client family.',
        examples: ['Claude Code']
      })
    )
  },
  { name: 'client', description: 'The AI coding agent, on a `client` value or item.' }
);

export let agentTrackingRepositorySchema = v.object(
  {
    id: v.string({
      name: 'id',
      description: 'Unique ID.',
      examples: ['aten_0mhNnEqM7XQb3vXq8gD2']
    }),
    provider: v.nullable(
      v.string({
        name: 'provider',
        description:
          'The Git provider or host as recorded for the remote. `null` when the repository is not known.',
        examples: ['github.com']
      })
    ),
    host: v.nullable(
      v.string({
        name: 'host',
        description:
          'The host name the repository lives on. Show it with the name unless it is `github.com`, `gitlab.com` or `bitbucket.org`. `null` when it is not a valid host name.',
        examples: ['github.com', 'git.acme.io']
      })
    ),
    owner: v.nullable(
      v.string({
        name: 'owner',
        description:
          'The account, organization or group path that holds the repository. `null` when the repository is not known.',
        examples: ['acme']
      })
    ),
    name: v.nullable(
      v.string({
        name: 'name',
        description:
          'The repository name without its owner. `null` when the repository is not known.',
        examples: ['api']
      })
    ),
    url: v.nullable(
      v.string({
        name: 'url',
        description:
          'The https address of the repository, built from its host, owner and name. `null` when they do not form a valid address, and for IP address and internationalized hosts.',
        examples: ['https://github.com/acme/api']
      })
    )
  },
  { name: 'repository', description: 'A Git repository agent sessions ran in.' }
);

export let presentAgentTrackingRepository = (repository: AgentTrackingRepository) => ({
  id: repository.id,
  provider: repository.provider,
  host: repository.host,
  owner: repository.owner,
  name: repository.name,
  url: repository.url
});

export let agentTrackingProviderSchema = v.object(
  {
    id: v.string({
      name: 'id',
      description: 'Unique ID.',
      examples: ['pro_0mhNnEqM7XQb3vXq8gD2']
    }),
    name: v.nullable(
      v.string({
        name: 'name',
        description:
          'Display name. `null` when the provider is not available to you, such as without the `instance.provider:read` scope.',
        examples: ['Linear']
      })
    )
  },
  {
    name: 'provider',
    description: 'A Metorial provider that MCP tool calls of AI coding agents reached.'
  }
);

export let presentAgentTrackingProvider = (provider: AgentTrackingProvider) => ({
  id: provider.id,
  name: provider.name
});

export let agentTrackingTicketSchema = v.object(
  {
    key: v.string({
      name: 'key',
      description:
        'The ticket key found in the branch name or a commit message, or on a commit an issue number such as `#42`. Use a key as `ticket` in filters.',
      examples: ['ENG-123', '#42']
    }),
    url: v.nullable(
      v.string({
        name: 'url',
        description:
          "The ticket link from the organization's template, or for an issue number the issue in the session's one GitHub or GitLab repository. `null` otherwise.",
        examples: ['https://linear.app/acme/issue/ENG-123']
      })
    )
  },
  { name: 'ticket', description: 'A ticket an agent session worked on.' }
);

export let presentAgentTrackingTicket = (ticket: AgentTrackingTicket) => ({
  key: ticket.key,
  url: ticket.url
});

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
