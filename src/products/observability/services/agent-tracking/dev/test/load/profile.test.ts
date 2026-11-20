import { describe, expect, it } from 'vitest';
import { createSampler } from '../../src/lib/random';
import { percentile } from '../../src/lib/stats';
import { defaultTrafficProfile, resolveTrafficProfile } from '../../src/load/profile';
import { createBatchStream, developerOf } from '../../src/load/synth';

let fixedClock = () => Date.parse('2026-11-18T12:00:00Z');

describe('traffic profile', () => {
  it('merges overrides onto the defaults and validates them', () => {
    let profile = resolveTrafficProfile({
      developers: 20,
      tokens: { output: { median: 10, p90: 20 } }
    });

    expect(profile.developers).toBe(20);
    expect(profile.tokens.output).toEqual({
      ...defaultTrafficProfile.tokens.output,
      median: 10,
      p90: 20
    });
    expect(profile.tokens.cacheRead).toEqual(defaultTrafficProfile.tokens.cacheRead);
    expect(() => resolveTrafficProfile({ developers: 0 })).toThrow(/developers/);
  });

  it('only accepts reserved example domains for synthetic identities', () => {
    expect(() => resolveTrafficProfile({ identityDomain: 'metorial.com' })).toThrow(
      /reserved/
    );
    expect(resolveTrafficProfile({ identityDomain: 'bench.test' }).identityDomain).toBe(
      'bench.test'
    );
  });
});

describe('sampling', () => {
  it('draws log-normal values around the stated median and 90th percentile', () => {
    let sampler = createSampler(7);
    let values = Array.from({ length: 20_000 }, () =>
      sampler.spread({ median: 100, p90: 400 })
    ).sort((a, b) => a - b);

    expect(percentile(values, 50)!).toBeGreaterThan(92);
    expect(percentile(values, 50)!).toBeLessThan(108);
    expect(percentile(values, 90)!).toBeGreaterThan(360);
    expect(percentile(values, 90)!).toBeLessThan(440);
  });

  it('respects bounds and weights', () => {
    let sampler = createSampler(3);
    let values = Array.from({ length: 2_000 }, () =>
      sampler.count({ median: 5, p90: 50, min: 2, max: 9 })
    );
    let picks = Array.from({ length: 10_000 }, () =>
      sampler.weighted([
        { value: 'a', weight: 9 },
        { value: 'b', weight: 1 }
      ])
    );

    expect(Math.min(...values)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...values)).toBeLessThanOrEqual(9);
    expect(picks.filter(pick => pick == 'b').length).toBeGreaterThan(800);
    expect(picks.filter(pick => pick == 'b').length).toBeLessThan(1_200);
  });
});

describe('synthetic Claude Code telemetry', () => {
  it('is deterministic for a seed', () => {
    let first = createBatchStream({
      profile: defaultTrafficProfile,
      seed: 11,
      developers: 5,
      clock: fixedClock
    });
    let second = createBatchStream({
      profile: defaultTrafficProfile,
      seed: 11,
      developers: 5,
      clock: fixedClock
    });

    for (let index = 0; index < 20; index++) {
      expect(
        JSON.stringify(first.next(), (_, value) =>
          typeof value == 'bigint' ? String(value) : value
        )
      ).toBe(
        JSON.stringify(second.next(), (_, value) =>
          typeof value == 'bigint' ? String(value) : value
        )
      );
    }
  });

  it('uses synthetic identities and carries no content', () => {
    let stream = createBatchStream({
      profile: defaultTrafficProfile,
      seed: 5,
      developers: 3,
      clock: fixedClock
    });
    let forbidden = [
      'prompt',
      'tool_input',
      'tool_parameters',
      'response',
      'error',
      'file_path',
      'cwd'
    ];

    for (let index = 0; index < 200; index++) {
      let batch = stream.next();
      let email = batch.group.resource!.attributes!['user.email'];

      expect(email).toMatch(/^dev-\d{4}@loadtest\.example$/);
      expect(batch.group.items.length).toBe(batch.expected.length);

      for (let item of batch.group.items) {
        for (let key of forbidden) expect(item.attributes).not.toHaveProperty(key);
      }
    }
  });

  it('keeps one session per export and names developers stably', () => {
    let stream = createBatchStream({
      profile: defaultTrafficProfile,
      seed: 2,
      developers: 4,
      clock: fixedClock
    });

    for (let index = 0; index < 50; index++) {
      let batch = stream.next();
      let sessions = new Set(batch.group.items.map(item => item.attributes!['session.id']));

      expect([...sessions]).toEqual([batch.sessionId]);
      expect(batch.developer.index).toBeLessThan(4);
    }

    expect(developerOf(defaultTrafficProfile, 2, 0)).toEqual(
      developerOf(defaultTrafficProfile, 2, 0)
    );
  });
});
