import { describe, expect, it } from 'vitest';
import { defaultTeamView, resolveTeamView } from './state';
import { resolveSavedSelection, savedViewErrorMessage, sortSavedViews } from './saved';

let view = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  kind: 'practices',
  params: { version: 1, flaggedOnly: true },
  ...extra
});

describe('saved view list', () => {
  it('sorts by name without case', () => {
    let list = sortSavedViews([
      view('atvw_1', 'zeta'),
      view('atvw_2', 'Alpha'),
      view('atvw_3', 'beta')
    ]);

    expect(list.map(item => item.id)).toEqual(['atvw_2', 'atvw_3', 'atvw_1']);
  });
});

describe('resolving the saved view of a link', () => {
  let resolve = (d: Partial<Parameters<typeof resolveSavedSelection>[0]>) =>
    resolveSavedSelection({
      savedId: 'atvw_1',
      urlKind: 'practices',
      views: [view('atvw_1', 'Mine')],
      listFailed: false,
      ...d
    });

  it('finds a readable view of the same kind', () => {
    let selection = resolve({});

    expect(selection.status).toBe('found');
    expect(selection.status == 'found' && selection.state).toEqual(
      resolveTeamView('practices', { flaggedOnly: true })
    );
  });

  it('waits for the list, reports a failure, then an unavailable view', () => {
    expect(resolve({ views: null }).status).toBe('loading');
    expect(resolve({ views: [], listFailed: true }).status).toBe('error');
    expect(resolve({ views: [] }).status).toBe('unavailable');
    expect(resolve({ savedId: null }).status).toBe('none');
  });

  it('reports a view of another kind, an unknown kind or format as unavailable', () => {
    expect(resolve({ urlKind: 'leaderboard' }).status).toBe('unavailable');
    expect(resolve({ views: [view('atvw_1', 'Future', { kind: 'heatmap' })] }).status).toBe(
      'unavailable'
    );
    expect(
      resolve({ views: [view('atvw_1', 'Mine', { params: { version: 9 } })] }).status
    ).toBe('unavailable');
  });

  it('opens a recent view of a link without a view parameter', () => {
    let recent = view('atvw_1', 'Mine', {
      kind: 'recent',
      params: { version: 1, range: 'today' }
    });

    expect(resolve({ views: [recent], urlKind: defaultTeamView().kind }).status).toBe('found');
  });
});

describe('saved view errors', () => {
  it('explains a taken name and the view limit', () => {
    expect(savedViewErrorMessage({ status: 409, code: 'conflict' })).toBe(
      'A saved view with this name already exists. Choose another name.'
    );
    expect(savedViewErrorMessage({ code: 'conflict' })).toContain('already exists');
    expect(savedViewErrorMessage({ status: 400, code: 'view_limit_exceeded' })).toContain(
      '50 saved views'
    );
  });

  it('passes on name problems from the API', () => {
    expect(
      savedViewErrorMessage({
        status: 400,
        code: 'invalid_data',
        errors: [{ path: ['name'], message: 'The name must have 1 to 80.' }]
      })
    ).toBe('The name must have 1 to 80.');
  });

  it('leaves every other error to the standard error', () => {
    expect(
      savedViewErrorMessage({
        status: 400,
        code: 'invalid_data',
        errors: [{ path: ['params', 'model_ids'], message: 'Required.' }]
      })
    ).toBeNull();
    expect(savedViewErrorMessage({ status: 500 })).toBeNull();
    expect(savedViewErrorMessage(null)).toBeNull();
  });
});
