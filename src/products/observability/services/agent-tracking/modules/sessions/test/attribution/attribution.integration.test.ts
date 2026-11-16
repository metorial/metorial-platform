import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { usageSliceService } from '@mtsrc/agent-tracking-module-usage';
import { entityService, linkService } from '@mtsrc/agent-tracking-module-entities';
import { ruleService } from '@mtsrc/agent-tracking-module-rules';
import { expectServiceError } from '@mtsrc/agent-tracking-testing';
import { cleanDatabase } from '@mtsrc/agent-tracking-db/test/setup';
import { remapMergedEntity } from '../../src/queues/reattribute';
import { lateRemapDelayMs } from '../../src/listeners';
import { sessionAttributionService } from '../../src/services/sessionAttribution';
import { reattributeSession } from '../../src/lib/reattribute';
import {
  collections,
  day,
  daysAgo,
  entriesOf,
  inlineQueues,
  setupScope,
  slice,
  store
} from './fixtures';

let repoOwnerMatch = { field: 'repo.owner', op: 'eq', value: 'acme' } as const;

describe('attribution', () => {
  beforeEach(async () => {
    await cleanDatabase();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await store.close();
  });

  it('re-attributes sessions in reach when a rule is created and rewrites their slices', async () => {
    let queues = inlineQueues();
    let scope = await setupScope();

    let repo = await scope.entity({
      kind: 'repo',
      ref: 'acme-api',
      identifiers: [{ type: 'remote', value: 'github/acme/api' }]
    });
    let billing = await scope.entity({ kind: 'project', ref: 'billing', name: 'Billing' });

    let recent = await scope.session({
      startedAt: daysAgo(10),
      context: { repoIds: [repo.id] }
    });
    let old = await scope.session({ startedAt: daysAgo(40), context: { repoIds: [repo.id] } });

    await reattributeSession({ sessionKey: recent._id });
    await reattributeSession({ sessionKey: old._id });
    await usageSliceService.writeSessionSlices({
      sessionKey: recent._id,
      slices: [slice({ bucket: recent.startedAt, sessionsStarted: 1 })]
    });

    expect(entriesOf(await scope.getSession(recent._id), 'project')).toEqual([]);

    let rule = await ruleService.createRule({
      organization: scope.organization,
      target: billing,
      input: { name: 'Acme repos', match: repoOwnerMatch },
      reach: 'past_30_days'
    });
    await queues.drain();

    let updated = await scope.getSession(recent._id);
    expect(entriesOf(updated, 'project')).toEqual([
      expect.objectContaining({ entityId: billing.id, source: 'rule', ruleId: rule.id })
    ]);
    expect(updated.attribution?.dimIds).toContain(billing.id);
    expect(entriesOf(await scope.getSession(old._id), 'project')).toEqual([]);

    expect(Date.now() - rule.validFrom.getTime()).toBeGreaterThan(29 * day);
    await reattributeSession({ sessionKey: old._id, force: true });
    expect(entriesOf(await scope.getSession(old._id), 'project')).toEqual([]);

    let { usageSlices } = await collections();
    let [stored] = await usageSlices.find({ sessionKey: recent._id }).toArray();
    expect(stored?.dims).toEqual([
      { kind: 'project', id: billing.id, w: 1 },
      { kind: 'repo', id: repo.id, w: 1 }
    ]);
    expect(stored?.dimIds).toContain(billing.id);

    let tested = await ruleService.testRule({
      organization: scope.organization,
      target: billing,
      input: { match: repoOwnerMatch, priority: 10 }
    });
    expect(tested).toMatchObject({
      sessionsEvaluated: 1,
      sessionsMatched: 1,
      sessionsChanged: 0
    });
  });

  it('never applies a from-now rule to older sessions, even when they are re-attributed', async () => {
    let queues = inlineQueues();
    let scope = await setupScope();

    let ada = await scope.user('ada', 'ada@acme.com');
    let payments = await scope.entity({ kind: 'team', ref: 'payments' });
    let repo = await scope.entity({
      kind: 'repo',
      ref: 'acme-api',
      identifiers: [{ type: 'remote', value: 'github/acme/api' }]
    });
    let billing = await scope.entity({ kind: 'project', ref: 'billing' });
    let existing = await scope.session({
      startedAt: daysAgo(5),
      observed: { userId: ada.id },
      context: { repoIds: [repo.id] }
    });
    await reattributeSession({ sessionKey: existing._id });

    let rule = await ruleService.createRule({
      organization: scope.organization,
      target: billing,
      input: { name: 'Acme repos', match: repoOwnerMatch },
      reach: 'from_now'
    });
    await queues.drain();

    expect(Date.now() - rule.validFrom.getTime()).toBeLessThan(60_000);
    expect(entriesOf(await scope.getSession(existing._id), 'project')).toEqual([]);

    await linkService.upsertLink({
      organization: scope.organization,
      from: ada,
      to: payments,
      input: { type: 'member_of', reach: 'past_30_days' }
    });
    await queues.drain();

    let relinked = await scope.getSession(existing._id);
    expect(entriesOf(relinked, 'team')).toEqual([
      expect.objectContaining({ entityId: payments.id })
    ]);
    expect(entriesOf(relinked, 'project')).toEqual([]);

    let later = await scope.session({
      startedAt: new Date(),
      context: { repoIds: [repo.id] }
    });
    await reattributeSession({ sessionKey: later._id });

    expect(entriesOf(await scope.getSession(later._id), 'project')).toEqual([
      expect.objectContaining({ entityId: billing.id, source: 'rule' })
    ]);
  });

  it('moves validFrom when an edit changes attribution, not when a rule is renamed', async () => {
    let queues = inlineQueues();
    let scope = await setupScope();

    let billing = await scope.entity({ kind: 'project', ref: 'billing' });
    let session = await scope.session({ startedAt: daysAgo(10) });

    let created = await ruleService.createRule({
      organization: scope.organization,
      target: billing,
      input: {
        name: 'Claude Code',
        match: { field: 'client.family', op: 'eq', value: 'claude-code' }
      },
      reach: 'past_30_days'
    });
    await queues.drain();
    expect(entriesOf(await scope.getSession(session._id), 'project')).toHaveLength(1);

    let renamed = await ruleService.updateRule({
      organization: scope.organization,
      rule: created,
      input: { name: 'Claude' },
      reach: 'from_now'
    });
    expect(renamed.validFrom).toEqual(created.validFrom);
    expect(queues.pending).toEqual([]);

    let edited = await ruleService.updateRule({
      organization: scope.organization,
      rule: renamed,
      input: { match: { field: 'client.family', op: 'glob', value: 'claude*' } },
      reach: 'from_now'
    });
    expect(edited.validFrom.getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(queues.pending).toHaveLength(1);
  });

  it('honours link reach when memberships change', async () => {
    let queues = inlineQueues();
    let scope = await setupScope();

    let ada = await scope.user('ada', 'ada@acme.com');
    let payments = await scope.entity({ kind: 'team', ref: 'payments' });
    let growth = await scope.entity({ kind: 'team', ref: 'growth' });

    let session = await scope.session({ startedAt: daysAgo(3), observed: { userId: ada.id } });
    await reattributeSession({ sessionKey: session._id });

    await linkService.upsertLink({
      organization: scope.organization,
      from: ada,
      to: payments,
      input: { type: 'member_of', reach: 'from_now' }
    });
    await queues.drain();

    expect(entriesOf(await scope.getSession(session._id), 'team')).toEqual([]);

    await linkService.upsertLink({
      organization: scope.organization,
      from: ada,
      to: growth,
      input: { type: 'member_of', reach: 'past_30_days' }
    });
    await queues.drain();

    expect(entriesOf(await scope.getSession(session._id), 'team')).toEqual([
      expect.objectContaining({ entityId: growth.id, source: 'derived', via: [ada.id] })
    ]);
  });

  it('assigns and clears a kind manually', async () => {
    let scope = await setupScope();

    let billing = await scope.entity({ kind: 'project', ref: 'billing' });
    let checkout = await scope.entity({ kind: 'project', ref: 'checkout', slug: 'checkout' });
    let session = await scope.session({
      context: {
        tags: [{ k: 'metorial.project', v: 'checkout', origin: 'source' }]
      }
    });
    await reattributeSession({ sessionKey: session._id });

    expect(entriesOf(await scope.getSession(session._id), 'project')).toEqual([
      expect.objectContaining({ entityId: checkout.id, source: 'tag' })
    ]);

    let assigned = await sessionAttributionService.assignSession({
      organization: scope.organization,
      sessionKey: session._id,
      kind: 'project',
      entityId: billing.id
    });
    expect(entriesOf(assigned, 'project')).toEqual([
      expect.objectContaining({ entityId: billing.id, source: 'manual' })
    ]);

    let cleared = await sessionAttributionService.assignSession({
      organization: scope.organization,
      sessionKey: session._id,
      kind: 'project',
      entityId: null
    });
    expect(cleared.manual).toEqual([]);
    expect(entriesOf(cleared, 'project')).toEqual([
      expect.objectContaining({ entityId: checkout.id, source: 'tag' })
    ]);

    await expectServiceError(
      sessionAttributionService.assignSession({
        organization: scope.organization,
        sessionKey: session._id,
        kind: 'user',
        entityId: null
      }),
      'bad_request'
    );
    await expectServiceError(
      sessionAttributionService.assignSession({
        organization: scope.organization,
        sessionKey: session._id,
        kind: 'team',
        entityId: billing.id
      }),
      'bad_request'
    );

    let other = await setupScope();
    await expectServiceError(
      sessionAttributionService.assignSession({
        organization: other.organization,
        sessionKey: session._id,
        kind: 'project',
        entityId: null
      }),
      'not_found'
    );
  });

  it('remaps a merged entity in sessions and slices and re-attributes them', async () => {
    let queues = inlineQueues();
    let scope = await setupScope();

    let winner = await scope.entity({ kind: 'repo', ref: 'api' });
    let loser = await scope.entity({ kind: 'repo', ref: 'api-mirror' });
    let billing = await scope.entity({ kind: 'project', ref: 'billing' });

    await linkService.upsertLink({
      organization: scope.organization,
      from: winner,
      to: billing,
      input: { type: 'part_of', reach: 'past_30_days' }
    });

    let session = await scope.session({ context: { repoIds: [loser.id] } });
    await reattributeSession({ sessionKey: session._id });
    await usageSliceService.writeSessionSlices({
      sessionKey: session._id,
      slices: [slice({ bucket: session.startedAt })]
    });

    expect(entriesOf(await scope.getSession(session._id), 'project')).toEqual([]);

    await entityService.mergeEntities({ organization: scope.organization, winner, loser });

    let job = {
      organizationId: scope.organization.id,
      winnerId: winner.id,
      loserId: loser.id
    };
    expect(queues.mergeAdd).toHaveBeenCalledWith(job);
    expect(queues.mergeAdd).toHaveBeenCalledWith(
      { ...job, late: true },
      { delay: lateRemapDelayMs }
    );
    expect(lateRemapDelayMs).toBe(3 * 60 * 1000);

    await remapMergedEntity(queues.merges.shift()!);

    let lateStamped = await scope.session({ context: { repoIds: [loser.id] } });
    await reattributeSession({ sessionKey: lateStamped._id });
    await queues.drain();

    let late = await scope.getSession(lateStamped._id);
    expect(late.context.repoIds).toEqual([winner.id]);
    expect(late.attribution?.dimIds).not.toContain(loser.id);
    expect(entriesOf(late, 'project')).toEqual([
      expect.objectContaining({ entityId: billing.id })
    ]);

    let merged = await scope.getSession(session._id);
    expect(merged.context.repoIds).toEqual([winner.id]);
    expect(entriesOf(merged, 'repo')).toEqual([
      expect.objectContaining({ entityId: winner.id })
    ]);
    expect(entriesOf(merged, 'project')).toEqual([
      expect.objectContaining({ entityId: billing.id, source: 'derived' })
    ]);
    expect(merged.attribution?.dimIds).not.toContain(loser.id);

    let { usageSlices } = await collections();
    let [stored] = await usageSlices.find({ sessionKey: session._id }).toArray();
    expect(stored?.repoIds).toEqual([winner.id]);
    expect(stored?.dimIds).toContain(billing.id);
    expect(stored?.dimIds).not.toContain(loser.id);
  });
});
