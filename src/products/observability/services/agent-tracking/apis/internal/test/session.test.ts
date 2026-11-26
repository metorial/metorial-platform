import type { SessionDocument, SessionSummary } from '@mtsrc/agent-tracking-store';
import { describe, expect, it } from 'vitest';
import { sessionPresenter } from '../src/presenters/session';

let emptyTokens = { inputUncached: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 };

let summary = (overrides: Partial<SessionSummary> = {}) =>
  ({
    durationMs: 0,
    turns: 0,
    prompts: 0,
    requests: 0,
    failedRequests: 0,
    retries: 0,
    toolCalls: 0,
    toolCallsByClass: {},
    mcpServers: [],
    subagents: [],
    models: [],
    tokens: emptyTokens,
    costReported: [],
    lines: { added: 12, removed: 3 },
    commits: 1,
    pullRequests: 1,
    errorsByClass: {},
    compactions: 0,
    ...overrides
  }) as SessionSummary;

let session = (d: {
  context?: Partial<SessionDocument['context']>;
  summary?: SessionSummary;
}) =>
  ({
    _id: 'sk_1',
    organizationId: 'org_1',
    projectId: 'prj_1',
    instanceId: 'ins_1',
    origin: 'native',
    versions: { summary: 4, attribution: 1, facts: 4 },
    client: { family: 'codex' },
    rootSessionKey: 'sk_1',
    startedAt: new Date('2026-11-25T10:00:00Z'),
    lastActivityAt: new Date('2026-11-25T10:10:00Z'),
    lastObservedAt: new Date('2026-11-25T10:10:00Z'),
    state: 'active',
    observed: { clientUserIds: [], clientInstallationIds: [] },
    context: {
      workspaceIds: [],
      repoIds: [],
      ticketRefs: [],
      tags: [],
      pathStored: false,
      ...d.context
    },
    ...(d.summary
      ? { summary: d.summary, summaryWatermark: new Date('2026-11-25T10:10:00Z') }
      : {}),
    expiresAt: new Date('2027-11-25T00:00:00Z')
  }) as SessionDocument;

describe('sessionPresenter', () => {
  it('returns the Desktop context and the commit and pull request refs', () => {
    let presented = sessionPresenter({
      session: session({
        context: {
          branch: 'ivan/mt-365-title',
          defaultBranch: 'main',
          worktree: true,
          subPath: 'services/api',
          permissionMode: 'acceptEdits',
          title: 'Fix login',
          ticketRefs: ['MT-365']
        },
        summary: summary({
          commitRefs: [
            {
              sha: 'a'.repeat(40),
              at: new Date('2026-11-25T10:05:00Z'),
              ticketRefs: ['MT-365']
            }
          ],
          pullRequestRefs: [
            {
              key: 'github.com/acme/api#7',
              provider: 'github.com',
              repository: 'acme/api',
              number: 7,
              kind: 'opened'
            }
          ]
        })
      }),
      titles: true
    });

    expect(presented.context).toMatchObject({
      branch: 'ivan/mt-365-title',
      defaultBranch: 'main',
      worktree: true,
      subPath: 'services/api',
      permissionMode: 'acceptEdits',
      title: 'Fix login',
      ticketRefs: ['MT-365']
    });
    expect(presented.summary).toMatchObject({
      lines: { added: 12, removed: 3 },
      commitRefs: [
        {
          sha: 'a'.repeat(40),
          at: new Date('2026-11-25T10:05:00Z'),
          branch: null,
          ticketRefs: ['MT-365'],
          aiAuthored: null
        }
      ],
      pullRequestRefs: [
        {
          key: 'github.com/acme/api#7',
          provider: 'github.com',
          repository: 'acme/api',
          number: 7,
          kind: 'opened'
        }
      ]
    });
  });

  it('hides a stored title while session titles are off', () => {
    let presented = sessionPresenter({
      session: session({ context: { title: 'Fix login' } }),
      titles: false
    });

    expect(presented.context.title).toBeNull();
  });

  it('fills in empty values for sessions summarized before the refs existed', () => {
    let presented = sessionPresenter({
      session: session({ summary: summary() }),
      titles: true
    });

    expect(presented.context).toMatchObject({
      defaultBranch: null,
      worktree: null,
      subPath: null,
      permissionMode: null,
      title: null
    });
    expect(presented.summary).toMatchObject({ commitRefs: [], pullRequestRefs: [] });
  });
});
