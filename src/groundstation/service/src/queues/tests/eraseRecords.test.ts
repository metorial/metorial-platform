import { describe, expect, it } from 'vitest';
import { eraseCollections, eraseFilter, planScopeErasure } from '../eraseRecords';

describe('planScopeErasure', () => {
  it('erases every collection of an organization, session links per instance', () => {
    let jobs = planScopeErasure({
      scope: { organizationId: 'gor_1' },
      instanceIds: ['gin_1', 'gin_2']
    });

    let byOrganization = jobs.filter(job => job.collection != 'sessionLinks');
    let links = jobs.filter(job => job.collection == 'sessionLinks');

    expect(byOrganization.map(job => job.collection).sort()).toEqual(
      eraseCollections.filter(collection => collection != 'sessionLinks').sort()
    );
    expect(byOrganization.every(job => job.scope.organizationId == 'gor_1')).toBe(true);
    expect(links.map(job => job.scope)).toEqual([
      { organizationId: 'gor_1', instanceId: 'gin_1' },
      { organizationId: 'gor_1', instanceId: 'gin_2' }
    ]);
  });

  it('erases a project per instance where a collection has no project id', () => {
    let jobs = planScopeErasure({
      scope: { organizationId: 'gor_1', projectId: 'gpr_1' },
      instanceIds: ['gin_1']
    });

    let collections = (scope: object) =>
      jobs
        .filter(job => JSON.stringify(job.scope) == JSON.stringify(scope))
        .map(job => job.collection)
        .sort();

    expect(collections({ organizationId: 'gor_1', projectId: 'gpr_1' })).toEqual([
      'contentTexts',
      'events',
      'measurements',
      'sessions',
      'usageSlices'
    ]);
    expect(collections({ organizationId: 'gor_1', instanceId: 'gin_1' })).toEqual([
      'sessionLinks',
      'sourceHealth'
    ]);
  });

  it('erases an instance with one job per collection', () => {
    let jobs = planScopeErasure({
      scope: { organizationId: 'gor_1', instanceId: 'gin_1' },
      instanceIds: ['gin_1']
    });

    expect(jobs).toHaveLength(eraseCollections.length);
  });

  it('skips per-instance collections when a scope has no instances', () => {
    let jobs = planScopeErasure({ scope: { organizationId: 'gor_1' }, instanceIds: [] });

    expect(jobs.map(job => job.collection)).not.toContain('sessionLinks');
  });
});

describe('eraseFilter', () => {
  it('filters by every scope field the collection stores', () => {
    let scope = { organizationId: 'gor_1', instanceId: 'gin_1' };

    expect(eraseFilter('events', scope)).toEqual(scope);
    expect(eraseFilter('sessionLinks', scope)).toEqual({ instanceId: 'gin_1' });
    expect(
      eraseFilter('sourceHealth', { organizationId: 'gor_1', projectId: 'gpr_1' })
    ).toEqual({ organizationId: 'gor_1' });
  });
});
