import { describe, expect, it } from 'vitest';
import type { SessionClassification } from '@mtsrc/agent-tracking-store';
import { contextHash } from '../src/lib/features';
import {
  kindsResolvedElsewhere,
  resolveClassificationSettings,
  shouldClassify
} from '../src/lib/policy';
import { sessionDocument } from './fixtures';

let context = {
  workspaceIds: ['aten_ws'],
  repoIds: ['aten_repo'],
  ticketRefs: [],
  tags: [],
  pathStored: false
};

let classified = (overrides: Partial<SessionClassification>) =>
  sessionDocument({
    context,
    classification: {
      status: 'needs_review',
      runs: 1,
      clefCalls: 1,
      contextHash: contextHash(context),
      results: [],
      at: new Date(),
      ...overrides
    }
  });

describe('resolveClassificationSettings', () => {
  it('defaults to deterministic stages on, AI off and a 0.8 threshold', () => {
    expect(resolveClassificationSettings({})).toEqual({
      enabled: true,
      threshold: 0.8,
      ai: { enabled: false, model: 'clef' }
    });
    expect(
      resolveClassificationSettings({
        classification: {
          enabled: false,
          threshold: 0.6,
          ai: { enabled: true, model: 'clef-flash' }
        }
      })
    ).toEqual({ enabled: false, threshold: 0.6, ai: { enabled: true, model: 'clef-flash' } });
  });
});

describe('shouldClassify', () => {
  it('runs first after the first completed turn or when idle without a run', () => {
    let session = sessionDocument({ context });

    expect(shouldClassify({ session, reason: 'turn_completed' })).toBe(true);
    expect(shouldClassify({ session, reason: 'idle' })).toBe(true);
  });

  it('does not run again on later turns', () => {
    expect(shouldClassify({ session: classified({}), reason: 'turn_completed' })).toBe(false);
  });

  it('re-runs once on idle when the first run stayed below the threshold', () => {
    expect(shouldClassify({ session: classified({}), reason: 'idle' })).toBe(true);
    expect(
      shouldClassify({ session: classified({ status: 'pending' }), reason: 'idle' })
    ).toBe(true);
    expect(shouldClassify({ session: classified({ runs: 2 }), reason: 'idle' })).toBe(false);
  });

  it('re-runs on idle after a skipped run only when the context changed', () => {
    let skipped = classified({ status: 'skipped' });
    expect(shouldClassify({ session: skipped, reason: 'idle' })).toBe(false);

    skipped.context = { ...context, ticketRefs: ['ENG-1'] };
    expect(shouldClassify({ session: skipped, reason: 'idle' })).toBe(true);
  });

  it('never runs automatically after an accepted or reviewed result', () => {
    let accepted = classified({ status: 'accepted' });
    accepted.context = { ...context, repoIds: ['aten_other'] };

    expect(shouldClassify({ session: accepted, reason: 'idle' })).toBe(false);
    expect(
      shouldClassify({ session: classified({ status: 'rejected' }), reason: 'idle' })
    ).toBe(false);
  });

  it('always runs when the customer asks for it', () => {
    expect(
      shouldClassify({
        session: classified({ status: 'accepted', runs: 5 }),
        reason: 'manual'
      })
    ).toBe(true);
  });
});

describe('kindsResolvedElsewhere', () => {
  it('collects kinds from non-classifier entries and manual assignments', () => {
    let kinds = kindsResolvedElsewhere({
      attribution: {
        entries: [
          { kind: 'project', entityId: 'aten_p', source: 'derived', weight: 1 },
          { kind: 'cost_center', entityId: 'aten_c', source: 'classifier', weight: 1 }
        ],
        dimIds: [],
        version: 1,
        inputsHash: '',
        computedAt: new Date()
      },
      manual: [{ kind: 'custom:department', entityId: null, at: new Date() }]
    });

    expect([...kinds].sort()).toEqual(['custom:department', 'project']);
  });
});
