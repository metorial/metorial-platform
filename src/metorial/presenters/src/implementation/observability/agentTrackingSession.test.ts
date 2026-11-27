import { describe, expect, it } from 'vitest';

import {
  v1AgentTrackingSessionDetailPresenter,
  v1AgentTrackingSessionPresenter
} from './agentTrackingSession';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

let tokens = { input: 1, cacheRead: 2, cacheWrite: 0, output: 3, reasoning: 0, total: 6 };

let cost = {
  totalMicros: 1000,
  billedMicros: null,
  estimatedMicros: 1000,
  isEstimate: true,
  reportedByClientMicros: 1000,
  listPriceMicros: 900
};

let repository = {
  id: 'aten_repo',
  provider: 'github.com',
  host: 'github.com',
  owner: 'acme',
  name: 'api',
  url: 'https://github.com/acme/api'
};

let session = {
  id: 'atse_c0ffee',
  state: 'ended' as const,
  member: null,
  client: { family: 'claude_code', name: 'Claude Code', surface: 'cli', version: '2.1.317' },
  models: [],
  unknownModelNames: [],
  billingModes: [],
  cost,
  tokens,
  requests: 3,
  summaryPending: false,
  context: {
    repositories: [repository],
    branch: 'ada/eng-12-login',
    defaultBranch: 'main',
    head: 'a'.repeat(40),
    worktree: false,
    subPath: 'services/api',
    permissionMode: 'acceptEdits',
    title: null,
    tickets: [{ key: 'ENG-12', url: 'https://linear.app/acme/issue/ENG-12' }],
    pullRequests: [
      {
        key: 'github.com/acme/api#7',
        provider: 'github.com',
        host: 'github.com',
        repository: 'acme/api',
        number: 7,
        kind: 'opened' as const,
        url: 'https://github.com/acme/api/pull/7'
      }
    ],
    commitCount: 1,
    pullRequestCount: 1,
    lines: { added: 12, removed: 3 }
  },
  providers: [
    { id: 'pro_linear', name: 'Linear' },
    { id: 'pro_gone', name: null }
  ],
  startedAt: new Date('2026-11-17T09:00:00Z'),
  lastActivityAt: new Date('2026-11-17T10:00:00Z'),
  endedAt: null
};

describe('agent tracking session presenters', () => {
  it('presents the context of a session in snake case, without commits on the list', async () => {
    let presented = await v1AgentTrackingSessionPresenter.present({ session }, context).run();

    expect(presented.context).toEqual({
      repositories: [repository],
      branch: 'ada/eng-12-login',
      default_branch: 'main',
      head: 'a'.repeat(40),
      worktree: false,
      sub_path: 'services/api',
      permission_mode: 'acceptEdits',
      title: null,
      tickets: [{ key: 'ENG-12', url: 'https://linear.app/acme/issue/ENG-12' }],
      pull_requests: [
        {
          key: 'github.com/acme/api#7',
          provider: 'github.com',
          host: 'github.com',
          repository: 'acme/api',
          number: 7,
          kind: 'opened',
          url: 'https://github.com/acme/api/pull/7'
        }
      ],
      commit_count: 1,
      pull_request_count: 1,
      lines: { added: 12, removed: 3 }
    });
    expect(presented).not.toHaveProperty('commits');
  });

  it('presents the providers the session reached, a provider Metorial cannot show without a name', async () => {
    let presented = await v1AgentTrackingSessionPresenter.present({ session }, context).run();

    expect(presented.providers).toEqual([
      { id: 'pro_linear', name: 'Linear' },
      { id: 'pro_gone', name: null }
    ]);
  });

  it('adds the commits of the session to the detail', async () => {
    let committedAt = new Date('2026-11-17T09:30:00Z');

    let presented = await v1AgentTrackingSessionDetailPresenter
      .present(
        {
          session: {
            ...session,
            usageByModel: [],
            commits: [
              {
                sha: 'c'.repeat(40),
                committedAt,
                branch: null,
                tickets: [{ key: '#42', url: null }],
                aiAuthored: true
              }
            ]
          }
        },
        context
      )
      .run();

    expect(presented).toMatchObject({
      object: 'agent_tracking.session_detail',
      context: { branch: 'ada/eng-12-login', commit_count: 1 },
      commits: [
        {
          sha: 'c'.repeat(40),
          committed_at: committedAt,
          branch: null,
          tickets: [{ key: '#42', url: null }],
          ai_authored: true
        }
      ]
    });
  });
});
