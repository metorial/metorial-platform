import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  verdicts: new Map<string, string>(),
  holdPending: false,
  defaultConfig: null as any
}));

vi.mock('@metorial-subspace/module-security-review-request', () => ({
  getSkillSecurityVerdicts: vi.fn(async () => mocks.verdicts)
}));

vi.mock('@metorial/db', () => ({
  db: {
    skillConfiguration: { findFirst: vi.fn(async () => mocks.defaultConfig) },
    project: {
      findUniqueOrThrow: vi.fn(async () => ({ skillReviewHoldPending: mocks.holdPending }))
    }
  }
}));

let { getWithheldSkillIds } = await import('./securityReviewPolicy');
let { strictestSecurityReviewPolicy } = await import('./combineConfigs');

let config = (securityReviewPolicy: 'off' | 'warn' | 'block') =>
  ({
    allowScripts: true,
    allowedFileExtensions: [],
    allowNonStandardDirectories: true,
    securityReviewPolicy
  }) as any;

let withheld = async (d: { configs: any[]; skills?: { skill: { id: string } }[] }) =>
  await getWithheldSkillIds({
    projectOid: 1n,
    instanceOid: 1n,
    skills: d.skills ?? [
      { skill: { id: 'fail' } },
      { skill: { id: 'pending' } },
      { skill: { id: 'dismissed' } },
      { skill: { id: 'warn' } },
      { skill: { id: 'unreviewed' } }
    ],
    configs: d.configs
  });

describe('strictestSecurityReviewPolicy', () => {
  it('picks the strictest policy', () => {
    expect(strictestSecurityReviewPolicy([])).toBe('off');
    expect(strictestSecurityReviewPolicy(['off', 'warn'])).toBe('warn');
    expect(strictestSecurityReviewPolicy(['warn', 'block', 'off'])).toBe('block');
  });
});

describe('getWithheldSkillIds', () => {
  beforeEach(() => {
    mocks.verdicts = new Map([
      ['fail', 'fail'],
      ['pending', 'pending'],
      ['dismissed', 'dismissed'],
      ['warn', 'warn']
    ]);
    mocks.holdPending = false;
    mocks.defaultConfig = null;
  });

  it('withholds nothing unless a configuration blocks', async () => {
    expect([...(await withheld({ configs: [config('warn'), config('off')] }))]).toEqual([]);
  });

  it('withholds failing skills under block, but not dismissed, warned or unreviewed ones', async () => {
    expect([...(await withheld({ configs: [config('warn'), config('block')] }))]).toEqual([
      'fail'
    ]);
  });

  it('holds pending skills back only when the project opts in', async () => {
    mocks.holdPending = true;

    expect([...(await withheld({ configs: [config('block')] }))].sort()).toEqual([
      'fail',
      'pending'
    ]);
  });

  it('falls back to the default configuration when nothing else applies', async () => {
    mocks.defaultConfig = config('block');

    expect([...(await withheld({ configs: [null, undefined] }))]).toEqual(['fail']);
  });

  it('applies a per-skill configuration on top of the shared ones', async () => {
    let result = await withheld({
      configs: [config('off')],
      skills: [
        { skill: { id: 'fail' }, skillConfiguration: config('block') } as any,
        { skill: { id: 'pending' } }
      ]
    });

    expect([...result]).toEqual(['fail']);
  });
});
