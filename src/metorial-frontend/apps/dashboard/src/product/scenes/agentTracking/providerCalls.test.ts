import { describe, expect, it } from 'vitest';
import { agentCallGroups, providerCallRows, providerLabel } from './providerCalls';

let settings = { loaded: true, failed: false, hideIndividuals: false };

let repository = {
  id: 'aten_repo',
  provider: 'github.com',
  host: 'github.com',
  owner: 'acme',
  name: 'api',
  url: 'https://github.com/acme/api'
};

let member = { id: 'aten_ada', name: 'Ada', email: 'ada@example.com' };

let item = (overrides: Record<string, unknown>) => ({
  kind: 'repository',
  key: 'aten_repo',
  member: null,
  repository: null,
  calls: 1,
  failed: 0,
  ...overrides
});

let hrefs = {
  repositoryHref: (id: string) => `/sessions?repositoryId=${id}`,
  memberHref: (id: string) => `/members/${id}`
};

describe('agentCallGroups', () => {
  it('shows both cards only when agent tracking is available and individuals are shown', () => {
    expect(agentCallGroups({ available: true, settings })).toEqual(['repository', 'member']);
  });

  it('shows nothing when agent tracking is not available', () => {
    expect(agentCallGroups({ available: false, settings })).toEqual([]);
  });

  it('shows nothing while the settings load, when they fail, or when individuals are hidden', () => {
    expect(
      agentCallGroups({ available: true, settings: { ...settings, loaded: false } })
    ).toEqual([]);
    expect(
      agentCallGroups({ available: true, settings: { ...settings, failed: true } })
    ).toEqual([]);
    expect(
      agentCallGroups({ available: true, settings: { ...settings, hideIndividuals: true } })
    ).toEqual([]);
  });
});

describe('providerCallRows', () => {
  it('links repositories to their sessions and leaves unknown and other rows unlinked', () => {
    let rows = providerCallRows(
      [
        item({ repository, calls: 7, failed: 2 }),
        item({ kind: 'unknown', key: 'unknown', calls: 3 }),
        item({ kind: 'other', key: 'other', calls: 1 })
      ],
      { groupBy: 'repository', ...hrefs }
    );

    expect(rows).toEqual([
      {
        key: 'aten_repo',
        label: 'acme/api',
        href: '/sessions?repositoryId=aten_repo',
        count: 7,
        errorCount: 2
      },
      { key: 'unknown', label: 'Unknown Repository', href: null, count: 3, errorCount: 0 }
    ]);
  });

  it('links members to their agent usage', () => {
    let rows = providerCallRows(
      [
        item({ kind: 'member', key: 'aten_ada', member, calls: 2 }),
        item({ kind: 'unknown', key: 'unknown' })
      ],
      { groupBy: 'member', ...hrefs }
    );

    expect(rows).toEqual([
      { key: 'aten_ada', label: 'Ada', href: '/members/aten_ada', count: 2, errorCount: 0 },
      { key: 'unknown', label: 'Unknown Member', href: null, count: 1, errorCount: 0 }
    ]);
  });
});

describe('providerLabel', () => {
  it('names a provider Metorial cannot show neutrally', () => {
    expect(providerLabel({ name: 'Linear' })).toBe('Linear');
    expect(providerLabel({ name: null })).toBe('Unknown Provider');
  });
});
