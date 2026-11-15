import { describe, expect, it } from 'vitest';
import { toCandidate } from '../src/lib/candidates';
import { buildFeatures, clefState, contextHash, labelFeatures } from '../src/lib/features';
import { sessionDocument } from './fixtures';

let session = sessionDocument({
  client: { family: 'cursor' },
  context: {
    workspaceIds: ['aten_ws'],
    repoIds: ['aten_repo_a', 'aten_repo_b'],
    branch: 'eng-42-fix-invoices',
    ticketRefs: ['ENG-42', 'ENG-42'],
    tags: [
      { k: 'team', v: 'payments', origin: 'source' },
      { k: 'env', v: 'ci', origin: 'environment' }
    ],
    pathStored: true
  },
  summary: {
    mcpServers: ['linear', 'linear', 'github'],
    toolCallsByClass: { edit: 4, shell: 2 }
  } as any
});

describe('buildFeatures', () => {
  it('collects repo, workspace, ticket, tag, client, tool and team features', () => {
    let features = buildFeatures({
      session,
      repos: [
        { id: 'aten_repo_a', name: 'acme/billing-api', attributes: {} },
        {
          id: 'aten_repo_b',
          name: null,
          attributes: {},
          identifiers: [{ type: 'remote', value: 'github.com/acme/web' }]
        }
      ],
      workspaces: [{ id: 'aten_ws', name: null, attributes: { label: 'billing-api' } }],
      teamNames: ['Payments', 'Platform', 'Payments']
    });

    expect(features).toEqual({
      repoIds: ['aten_repo_a', 'aten_repo_b'],
      workspaceIds: ['aten_ws'],
      repos: ['acme/billing-api', 'github.com/acme/web'],
      branch: 'eng-42-fix-invoices',
      ticketRefs: ['ENG-42'],
      workspaceLabel: 'billing-api',
      tags: { team: 'payments', env: 'ci' },
      clientFamily: 'cursor',
      mcpServers: ['linear', 'github'],
      toolClasses: { edit: 4, shell: 2 },
      fileExts: {},
      teamNames: ['Payments', 'Platform'],
      path: undefined,
      firstPrompt: undefined
    });
  });

  it('only carries path and prompt text that was passed in, truncated', () => {
    let features = buildFeatures({
      session,
      repos: [],
      workspaces: [],
      teamNames: [],
      path: '/Users/dev/acme/billing-api',
      firstPrompt: 'x'.repeat(5000)
    });

    expect(features.path).toBe('/Users/dev/acme/billing-api');
    expect(features.firstPrompt).toHaveLength(2000);
    expect(features.repos).toEqual([]);
  });

  it('builds the clef state without entity ids', () => {
    let state = clefState(
      buildFeatures({
        session,
        repos: [{ id: 'aten_repo_a', name: 'acme/billing-api', attributes: {} }],
        workspaces: [],
        teamNames: []
      })
    );

    expect(state.repo).toBe('acme/billing-api');
    expect(state).not.toHaveProperty('repoIds');
    expect(state).not.toHaveProperty('workspaceIds');
    expect(JSON.stringify(state)).not.toContain('aten_');
  });
});

describe('contextHash', () => {
  it('ignores order and changes when context grows', () => {
    let base = { repoIds: ['a', 'b'], workspaceIds: ['w'], ticketRefs: ['ENG-1'] };

    expect(contextHash(base)).toBe(
      contextHash({ repoIds: ['b', 'a'], workspaceIds: ['w'], ticketRefs: ['ENG-1'] })
    );
    expect(contextHash(base)).not.toBe(
      contextHash({ ...base, ticketRefs: ['ENG-1', 'ENG-2'] })
    );
    expect(contextHash(base)).not.toBe(contextHash({ ...base, workspaceIds: ['w', 'x'] }));
  });
});

describe('labelFeatures', () => {
  it('stores the ids priors match on', () => {
    expect(labelFeatures(session)).toEqual({
      repoIds: ['aten_repo_a', 'aten_repo_b'],
      workspaceIds: ['aten_ws'],
      branch: 'eng-42-fix-invoices',
      ticketRefs: ['ENG-42', 'ENG-42'],
      clientFamily: 'cursor'
    });
  });
});

describe('toCandidate', () => {
  it('reads classifier attributes defensively', () => {
    expect(
      toCandidate({
        id: 'aten_1',
        kind: 'project',
        name: 'Billing',
        slug: 'billing',
        attributes: {
          description: ' Billing revamp ',
          keywords: ['invoice', 3, ''],
          repos: 'acme/billing-api',
          ticketPrefixes: ['bill', 'FIN']
        },
        scopeProjectOid: null,
        scopeInstanceOid: BigInt(1)
      })
    ).toEqual({
      id: 'aten_1',
      kind: 'project',
      name: 'Billing',
      description: 'Billing revamp',
      keywords: ['invoice'],
      repos: ['acme/billing-api'],
      ticketPrefixes: ['BILL', 'FIN'],
      scoped: true
    });
  });
});
