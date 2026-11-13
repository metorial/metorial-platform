import { billingModes } from '@metorial/groundstation-spec';
import { describe, expect, it } from 'vitest';
import { isOverrideActiveAt, matchOverride, overrideSpecificity } from '../match';
import { override, overrideRequest } from './fixtures';

let targetIds = {
  offering: 'anthropic:claude-sonnet-4-5',
  model: 'claude-sonnet-4-5',
  family: 'claude-sonnet',
  lab: 'anthropic',
  agent: 'claude-code',
  vendor: 'anthropic',
  all: null
} as const;

let targeted = (target: keyof typeof targetIds, input: Parameters<typeof override>[0] = {}) =>
  override({ target, targetId: targetIds[target], ...input });

describe('matchOverride specificity', () => {
  it('orders targets from offering to all', () => {
    expect(overrideSpecificity).toEqual([
      'offering',
      'model',
      'family',
      'lab',
      'agent',
      'vendor',
      'all'
    ]);
  });

  for (let [index, target] of overrideSpecificity.entries()) {
    it(`picks the ${target} override over every less specific one`, () => {
      let candidates = overrideSpecificity
        .slice(index)
        .map(candidate => targeted(candidate, { priority: candidate == target ? 0 : 100 }));

      expect(matchOverride(candidates.reverse(), overrideRequest())?.target).toBe(target);
    });
  }

  it('matches each target against its own request field', () => {
    for (let target of overrideSpecificity) {
      if (target == 'all') continue;

      expect(matchOverride([targeted(target)], overrideRequest())?.target).toBe(target);
      expect(
        matchOverride([targeted(target, { targetId: 'something-else' })], overrideRequest())
      ).toBeUndefined();
    }
  });

  it('never matches a target whose request field is unknown', () => {
    let request = overrideRequest({
      offeringId: undefined,
      modelId: undefined,
      familyId: undefined,
      labId: undefined,
      agentId: undefined,
      vendorId: undefined
    });

    let candidates = overrideSpecificity
      .filter(target => target != 'all')
      .map(t => targeted(t));
    expect(matchOverride(candidates, request)).toBeUndefined();
    expect(matchOverride([...candidates, targeted('all')], request)?.target).toBe('all');
  });
});

describe('matchOverride scope and tie-breaks', () => {
  it('applies only to its own organization', () => {
    expect(
      matchOverride([override({ organizationId: 'gor_b' })], overrideRequest())
    ).toBeUndefined();
  });

  it('applies a project-scoped override only to that project', () => {
    let scoped = override({ projectId: 'gpr_a' });

    expect(matchOverride([scoped], overrideRequest())).toBe(scoped);
    expect(matchOverride([scoped], overrideRequest({ projectId: 'gpr_b' }))).toBeUndefined();
    expect(matchOverride([scoped], overrideRequest({ projectId: null }))).toBeUndefined();
  });

  it('prefers a project-scoped override over an organization one at the same specificity', () => {
    let organizationWide = targeted('model', { priority: 50 });
    let projectScoped = targeted('model', { projectId: 'gpr_a' });

    expect(matchOverride([organizationWide, projectScoped], overrideRequest())).toBe(
      projectScoped
    );
  });

  it('keeps specificity above project scope', () => {
    let projectWide = override({ projectId: 'gpr_a' });
    let organizationModel = targeted('model');

    expect(matchOverride([projectWide, organizationModel], overrideRequest())).toBe(
      organizationModel
    );
  });

  it('prefers the higher priority, then the later validFrom, then the newer id', () => {
    let low = targeted('model', { priority: 1 });
    let high = targeted('model', { priority: 2 });
    expect(matchOverride([high, low], overrideRequest())).toBe(high);
    expect(matchOverride([low, high], overrideRequest())).toBe(high);

    let early = targeted('model', { validFrom: new Date('2026-01-01T00:00:00Z') });
    let late = targeted('model', { validFrom: new Date('2026-02-01T00:00:00Z') });
    expect(matchOverride([late, early], overrideRequest())).toBe(late);
    expect(matchOverride([early, late], overrideRequest())).toBe(late);

    let older = targeted('model', { id: 'gpo_0001' });
    let newer = targeted('model', { id: 'gpo_0002' });
    expect(matchOverride([older, newer], overrideRequest())).toBe(newer);
    expect(matchOverride([newer, older], overrideRequest())).toBe(newer);
  });

  it('requires the vendor condition when one is set', () => {
    let bedrockOnly = targeted('model', { vendorId: 'aws-bedrock' });

    expect(matchOverride([bedrockOnly], overrideRequest())).toBeUndefined();
    expect(matchOverride([bedrockOnly], overrideRequest({ vendorId: 'aws-bedrock' }))).toBe(
      bedrockOnly
    );
    expect(
      matchOverride([bedrockOnly], overrideRequest({ vendorId: undefined }))
    ).toBeUndefined();
  });

  it('matches every request for target all, subject to the vendor condition', () => {
    let everything = override();
    let anthropic = override({ vendorId: 'anthropic' });

    expect(matchOverride([everything], overrideRequest({ modelId: undefined }))).toBe(
      everything
    );
    expect(
      matchOverride([anthropic], overrideRequest({ vendorId: 'openai' }))
    ).toBeUndefined();
  });
});

describe('matchOverride billing modes', () => {
  it('matches every billing mode without a condition', () => {
    let any = override();

    for (let billingMode of billingModes) {
      expect(matchOverride([any], overrideRequest({ billingMode }))).toBe(any);
    }
  });

  it('matches only the listed billing modes', () => {
    let plan = override({ billingModes: ['included', 'overage'] });

    expect(matchOverride([plan], overrideRequest({ billingMode: 'included' }))).toBe(plan);
    expect(matchOverride([plan], overrideRequest({ billingMode: 'overage' }))).toBe(plan);
    expect(matchOverride([plan], overrideRequest({ billingMode: 'api' }))).toBeUndefined();
    expect(matchOverride([plan], overrideRequest({ billingMode: 'unknown' }))).toBeUndefined();
  });

  it('treats unknown as a mode that can be listed', () => {
    let unresolved = override({ billingModes: ['unknown'] });

    expect(matchOverride([unresolved], overrideRequest({ billingMode: 'unknown' }))).toBe(
      unresolved
    );
    expect(
      matchOverride([unresolved], overrideRequest({ billingMode: 'included' }))
    ).toBeUndefined();
  });

  it('prefers an override limited to billing modes after specificity and project scope', () => {
    let any = targeted('model', { priority: 50 });
    let api = targeted('model', { billingModes: ['api'] });
    let request = overrideRequest({ billingMode: 'api' });

    expect(matchOverride([any, api], request)).toBe(api);
    expect(matchOverride([api, any], request)).toBe(api);

    let projectAny = targeted('model', { projectId: 'gpr_a' });
    expect(matchOverride([api, projectAny], request)).toBe(projectAny);

    let offering = targeted('offering');
    expect(matchOverride([api, offering], request)).toBe(offering);
  });

  it('falls back to an override without a condition for other modes', () => {
    let any = targeted('model');
    let api = targeted('model', { billingModes: ['api'] });

    expect(matchOverride([any, api], overrideRequest({ billingMode: 'included' }))).toBe(any);
  });
});

describe('override validity', () => {
  let bounded = override({
    validFrom: new Date('2026-03-01T00:00:00Z'),
    validTo: new Date('2026-04-01T00:00:00Z')
  });

  it('includes validFrom and excludes validTo', () => {
    expect(isOverrideActiveAt(bounded, new Date('2026-03-01T00:00:00Z'))).toBe(true);
    expect(isOverrideActiveAt(bounded, new Date('2026-03-31T23:59:59.999Z'))).toBe(true);
    expect(isOverrideActiveAt(bounded, new Date('2026-04-01T00:00:00Z'))).toBe(false);
    expect(isOverrideActiveAt(bounded, new Date('2026-02-28T23:59:59.999Z'))).toBe(false);
  });

  it('stays active without validTo', () => {
    expect(isOverrideActiveAt(override(), new Date('2099-01-01T00:00:00Z'))).toBe(true);
  });

  it('never applies an archived override, even to its validity', () => {
    let archived = targeted('offering', { archivedAt: new Date('2026-03-10T00:00:00Z') });
    let fallback = override();

    expect(isOverrideActiveAt(archived, new Date('2026-03-04T10:00:00Z'))).toBe(false);
    expect(matchOverride([archived, fallback], overrideRequest())).toBe(fallback);
  });

  it('falls back to a less specific override outside the specific one’s validity', () => {
    let specific = targeted('model', { validTo: new Date('2026-03-01T00:00:00Z') });
    let fallback = override();

    expect(matchOverride([specific, fallback], overrideRequest())).toBe(fallback);
    expect(
      matchOverride([specific, fallback], overrideRequest({ at: new Date('2026-02-01') }))
    ).toBe(specific);
  });
});
