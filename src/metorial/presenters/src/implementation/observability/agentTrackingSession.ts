import { v } from '@lowerdeck/validation';
import type { AgentTrackingSessionContext } from '@metorial/module-agent-tracking-query';
import { Presenter } from '@metorial/presenter';
import { agentTrackingSessionDetailType, agentTrackingSessionType } from '../../types';
import {
  agentTrackingCostSchema,
  agentTrackingMemberSchema,
  agentTrackingModelSchema,
  agentTrackingProviderSchema,
  agentTrackingRepositorySchema,
  agentTrackingSpendFiguresProperties,
  agentTrackingTicketSchema,
  agentTrackingTokensSchema,
  agentTrackingUnknownModelNamesSchema,
  presentAgentTrackingCost,
  presentAgentTrackingMember,
  presentAgentTrackingProvider,
  presentAgentTrackingRepository,
  presentAgentTrackingSpendCost,
  presentAgentTrackingTicket,
  presentAgentTrackingTokens
} from './agentTrackingCommon';

let presentContext = (context: AgentTrackingSessionContext) => ({
  repositories: context.repositories.map(presentAgentTrackingRepository),
  branch: context.branch,
  default_branch: context.defaultBranch,
  head: context.head,
  worktree: context.worktree,
  sub_path: context.subPath,
  permission_mode: context.permissionMode,
  title: context.title,
  tickets: context.tickets.map(presentAgentTrackingTicket),
  pull_requests: context.pullRequests.map(pullRequest => ({
    key: pullRequest.key,
    provider: pullRequest.provider,
    host: pullRequest.host,
    repository: pullRequest.repository,
    number: pullRequest.number,
    kind: pullRequest.kind,
    url: pullRequest.url
  })),
  commit_count: context.commitCount,
  pull_request_count: context.pullRequestCount,
  lines: { added: context.lines.added, removed: context.lines.removed }
});

let contextSchema = v.object(
  {
    repositories: v.array(agentTrackingRepositorySchema, {
      name: 'repositories',
      description: 'The Git repositories the session ran in. Empty when none was reported.'
    }),
    branch: v.nullable(
      v.string({
        name: 'branch',
        description: 'The Git branch the session was on. `null` when none was reported.',
        examples: ['ada/eng-123-login']
      })
    ),
    default_branch: v.nullable(
      v.string({
        name: 'default_branch',
        description:
          'The default branch of the repository, as the device saw it. `null` when not reported.',
        examples: ['main']
      })
    ),
    head: v.nullable(
      v.string({
        name: 'head',
        description: 'The commit checked out, as last reported. `null` when not reported.',
        examples: ['3f9c2a71d04b5e8a96c1f0d2b7e4a51300c1d2e3']
      })
    ),
    worktree: v.nullable(
      v.boolean({
        name: 'worktree',
        description:
          'Whether the session ran in a linked Git worktree rather than the main checkout. `null` when not reported.'
      })
    ),
    sub_path: v.nullable(
      v.string({
        name: 'sub_path',
        description:
          'The folder inside the repository the session ran in, relative to its root. `null` at the root or when not reported.',
        examples: ['services/api']
      })
    ),
    permission_mode: v.nullable(
      v.string({
        name: 'permission_mode',
        description:
          'The permission mode the agent ran in, as the agent names it. `null` when not reported.',
        examples: ['acceptEdits']
      })
    ),
    title: v.nullable(
      v.string({
        name: 'title',
        description:
          'The title of the session as the agent named it. `null` unless the organization has Session Titles turned on.'
      })
    ),
    tickets: v.array(agentTrackingTicketSchema, {
      name: 'tickets',
      description: 'Ticket keys found in the branch name and commit messages, at most 64.'
    }),
    pull_requests: v.array(
      v.object({
        key: v.string({
          name: 'key',
          description: 'Identifies the pull request. Use it as `pull_request` in filters.',
          examples: ['github.com/acme/api#7']
        }),
        provider: v.string({
          name: 'provider',
          description: 'The Git provider or host of the repository, as recorded.',
          examples: ['github.com']
        }),
        host: v.nullable(
          v.string({
            name: 'host',
            description:
              'The host name of the repository. Show it with the pull request unless it is `github.com`, `gitlab.com` or `bitbucket.org`. `null` when it is not a valid host name.',
            examples: ['github.com']
          })
        ),
        repository: v.string({
          name: 'repository',
          description: 'The owner and name of the repository.',
          examples: ['acme/api']
        }),
        number: v.number({
          name: 'number',
          description: 'Number of the pull request in its repository, as in its URL.'
        }),
        kind: v.enumOf(['opened', 'linked'], {
          name: 'kind',
          description:
            '`opened` when the session opened the pull request, `linked` when it only referred to an existing one.'
        }),
        url: v.nullable(
          v.string({
            name: 'url',
            description:
              'A link to the pull request on public GitHub, GitLab or Bitbucket, or on a self-hosted GitHub or GitLab host that one of the session repositories uses. `null` otherwise.',
            examples: ['https://github.com/acme/api/pull/7']
          })
        )
      }),
      {
        name: 'pull_requests',
        description: 'Pull requests the session opened or linked, newest first, at most 20.'
      }
    ),
    commit_count: v.number({
      name: 'commit_count',
      description: 'Commits made during the session.'
    }),
    pull_request_count: v.number({
      name: 'pull_request_count',
      description:
        'Pull requests the session opened or linked, including any past the 20 listed.'
    }),
    lines: v.object(
      {
        added: v.number({ name: 'added', description: 'Lines added.' }),
        removed: v.number({ name: 'removed', description: 'Lines removed.' })
      },
      {
        name: 'lines',
        description: 'Lines of code the session changed, as the agent reported them.'
      }
    )
  },
  {
    name: 'context',
    description:
      'Where the session worked: repository, branch, tickets and pull requests, as reported by Metorial Desktop or the agent. Links are built by Metorial, never taken from the device.'
  }
);

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

    context: presentContext(session.context),
    providers: session.providers.map(presentAgentTrackingProvider),

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

      context: contextSchema,
      providers: v.array(agentTrackingProviderSchema, {
        name: 'providers',
        description:
          'Metorial providers the MCP tool calls of the session reached, at most 16. Only Claude Code and Codex calls are matched, a few minutes after they happen.'
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
      })),

      commits: session.commits.map(commit => ({
        sha: commit.sha,
        committed_at: commit.committedAt,
        branch: commit.branch,
        tickets: commit.tickets.map(presentAgentTrackingTicket),
        ai_authored: commit.aiAuthored
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
      ),

      commits: v.array(
        v.object({
          sha: v.string({
            name: 'sha',
            description: 'The full commit hash.',
            examples: ['3f9c2a71d04b5e8a96c1f0d2b7e4a51300c1d2e3']
          }),
          committed_at: v.date({
            name: 'committed_at',
            description: 'When the commit was made.'
          }),
          branch: v.nullable(
            v.string({
              name: 'branch',
              description: 'The branch the commit was made on. `null` when not reported.'
            })
          ),
          tickets: v.array(agentTrackingTicketSchema, {
            name: 'tickets',
            description: 'Tickets and issue numbers named in the commit message.'
          }),
          ai_authored: v.nullable(
            v.boolean({
              name: 'ai_authored',
              description:
                'Whether the commit is marked as written with an AI coding agent, such as by a co-author trailer. `null` when not reported.'
            })
          )
        }),
        {
          name: 'commits',
          description: 'Commits made during the session, newest first, at most 50.'
        }
      )
    }) as any
  )
  .build();
