import { describe, expect, it } from 'vitest';
import { sessionListFilter, sessionScopeFilter } from '../src/lib/listFilter';

let organization = { id: 'ator_1' };

describe('session list filter', () => {
  it('scopes to the organization and leaves out filters that are not given', () => {
    expect(sessionListFilter(organization, {})).toEqual({
      organizationId: 'ator_1',
      empty: { $ne: true }
    });
    expect(
      sessionScopeFilter(organization, { instanceIds: ['atin_1'], userIds: ['aten_1'] })
    ).toEqual({ organizationId: 'ator_1', instanceId: { $in: ['atin_1'] } });
  });

  it('keeps a null user, so sessions without a user can be selected', () => {
    expect(sessionListFilter(organization, { userIds: ['aten_1', null] })).toEqual({
      organizationId: 'ator_1',
      empty: { $ne: true },
      'observed.userId': { $in: ['aten_1', null] }
    });
    expect(sessionListFilter(organization, { userIds: [null] })['observed.userId']).toEqual({
      $in: [null]
    });
  });

  it('matches models by the settled summary and the range by start', () => {
    let from = new Date('2026-11-01T00:00:00Z');
    let to = new Date('2026-11-02T00:00:00Z');

    expect(
      sessionListFilter(organization, {
        modelIds: ['claude-sonnet-4-5'],
        from,
        to,
        states: ['ended']
      })
    ).toEqual({
      organizationId: 'ator_1',
      empty: { $ne: true },
      'summary.models.modelId': { $in: ['claude-sonnet-4-5'] },
      state: { $in: ['ended'] },
      startedAt: { $gte: from, $lt: to }
    });
  });

  it('bounds last activity apart from the start', () => {
    let from = new Date('2026-11-01T00:00:00Z');
    let to = new Date('2026-11-02T00:00:00Z');

    expect(
      sessionListFilter(organization, { lastActivityFrom: from, lastActivityTo: to })
    ).toEqual({
      organizationId: 'ator_1',
      empty: { $ne: true },
      lastActivityAt: { $gte: from, $lt: to }
    });
    expect(sessionListFilter(organization, { lastActivityFrom: from })).toEqual({
      organizationId: 'ator_1',
      empty: { $ne: true },
      lastActivityAt: { $gte: from }
    });
  });

  it('selects sessions with a model outside the catalog by a null model', () => {
    expect(sessionListFilter(organization, { modelIds: ['claude-sonnet-4-5', null] })).toEqual(
      {
        organizationId: 'ator_1',
        empty: { $ne: true },
        'summary.models': {
          $elemMatch: {
            $or: [
              { modelId: { $in: ['claude-sonnet-4-5'] } },
              { modelId: { $exists: false } },
              { modelId: null }
            ]
          }
        }
      }
    );
  });

  it('matches the client family the session was started with', () => {
    expect(sessionListFilter(organization, { clientFamilies: ['claude-code'] })).toEqual({
      organizationId: 'ator_1',
      empty: { $ne: true },
      'client.family': { $in: ['claude-code'] }
    });
  });

  it('matches repositories, branches, tickets and pull requests', () => {
    expect(
      sessionListFilter(organization, {
        repoIds: ['aten_repo_1'],
        branches: ['ivan/mt-365-title'],
        ticketRefs: ['MT-365', '#42'],
        pullRequests: ['github.com/acme/api#7']
      })
    ).toEqual({
      organizationId: 'ator_1',
      empty: { $ne: true },
      'context.repoIds': { $in: ['aten_repo_1'] },
      'context.branch': { $in: ['ivan/mt-365-title'] },
      'context.ticketRefs': { $in: ['MT-365', '#42'] },
      'summary.pullRequestRefs.key': { $in: ['github.com/acme/api#7'] }
    });
  });

  it('matches the Metorial providers the session reached', () => {
    expect(sessionListFilter(organization, { metorialProviderIds: ['pro_1'] })).toEqual({
      organizationId: 'ator_1',
      empty: { $ne: true },
      'summary.metorial.providerIds': { $in: ['pro_1'] }
    });
  });

  it('leaves out sessions in which nothing happened, also when scoped by instance', () => {
    expect(sessionListFilter(organization, { instanceIds: ['atin_1'] })).toEqual({
      organizationId: 'ator_1',
      instanceId: { $in: ['atin_1'] },
      empty: { $ne: true }
    });
    expect(sessionScopeFilter(organization, {})).toEqual({ organizationId: 'ator_1' });
  });

  it('treats an empty list as matching nothing, not as no filter', () => {
    expect(sessionListFilter(organization, { userIds: [] })['observed.userId']).toEqual({
      $in: []
    });
  });
});
