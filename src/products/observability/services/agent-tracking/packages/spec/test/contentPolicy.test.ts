import { stricterContentPolicy } from '../src';
import { describe, expect, it } from 'vitest';

describe('stricterContentPolicy', () => {
  it('takes the less capturing mode per role', () => {
    expect(
      stricterContentPolicy(
        { defaultMode: 'full', roles: { path: 'basic' } },
        { defaultMode: 'shape', roles: { prompt: 'full' } }
      )
    ).toEqual({ defaultMode: 'shape', roles: { prompt: 'full', path: 'basic' } });
  });

  it('never widens either policy', () => {
    expect(stricterContentPolicy({ defaultMode: 'basic' }, { defaultMode: 'full' })).toEqual({
      defaultMode: 'basic'
    });
  });
});
