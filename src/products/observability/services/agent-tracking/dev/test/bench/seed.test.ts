import { describe, expect, it } from 'vitest';
import { canaryProblem, seedDecision, type SeedMarker } from '../../src/bench/seed';
import { resolveSeedShape, smokeSeedShape } from '../../src/bench/shape';

let shape = resolveSeedShape(smokeSeedShape);

let marker = (overrides: Partial<SeedMarker>) =>
  ({ seed: 1, shape, status: 'seeding', ...overrides }) as SeedMarker;

describe('seed decision', () => {
  it('starts on an empty database and resumes or finishes a matching marker', () => {
    expect(seedDecision(null, 1, shape)).toBe('start');
    expect(seedDecision(marker({}), 1, shape)).toBe('resume');
    expect(seedDecision(marker({ status: 'complete' }), 1, shape)).toBe('complete');
  });

  it('refuses a marker written with another seed or shape', () => {
    expect(seedDecision(marker({}), 2, shape)).toBe('refuse');
    expect(seedDecision(marker({ status: 'complete' }), 1, { ...shape, days: 41 })).toBe(
      'refuse'
    );
  });
});

describe('canary check', () => {
  let expected = { expectedKeys: ['a', 'b', 'c'], expectedRequests: 42 };

  it('passes when the service returns exactly the canary, in any order', () => {
    expect(canaryProblem({ ...expected, keys: ['c', 'a', 'b'], requests: 42 })).toBeNull();
  });

  it('names a service that reads another store', () => {
    expect(canaryProblem({ ...expected, keys: [], requests: 0 })).toMatch(
      /returned 0 sessions, the canary wrote 3/
    );
    expect(canaryProblem({ ...expected, keys: ['a', 'b', 'x'], requests: 42 })).toMatch(
      /session.list/
    );
    expect(canaryProblem({ ...expected, keys: ['a', 'b', 'c'], requests: 40 })).toMatch(
      /counted 40 requests, the canary wrote 42/
    );
  });
});
