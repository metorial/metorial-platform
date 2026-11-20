import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { parseAmount } from '@mtsrc/agent-tracking-cost';
import { datasets, type DatasetDef } from '@mtsrc/agent-tracking-module-query';
import { isSummaryStale } from '@mtsrc/agent-tracking-module-sessions';
import { createStore } from '@mtsrc/agent-tracking-store';
import {
  buildEventDocuments,
  buildSessionDocuments,
  createDayPlanner,
  dayStartOf,
  type OrgContext
} from '../../src/bench/documents';
import { resolveSeedShape, smokeSeedShape } from '../../src/bench/shape';
import { buildEventTemplates } from '../../src/bench/templates';
import { dayMs } from '../../src/lib/clock';
import { defaultTrafficProfile } from '../../src/load/profile';

let shape = resolveSeedShape(smokeSeedShape);

let anchor = new Date('2026-11-18T15:30:00Z');

let org: OrgContext = {
  index: 0,
  organizationId: 'ator_bench',
  projectId: 'atpr_bench',
  instanceIds: ['atin_bench_0', 'atin_bench_1'],
  userIds: Array.from({ length: shape.developers }, (_, index) => `aten_user_${index}`),
  anchor
};

let {
  sessions: Session,
  usageSlices: Slice,
  events: Event
} = createStore('mongodb://127.0.0.1:1/unconnected');

let { usage: usageDataset, requests: requestsDataset } = datasets;

let pathValue = (document: unknown, path: string) =>
  path
    .split('.')
    .reduce<unknown>(
      (value, key) => (value as Record<string, unknown> | undefined)?.[key],
      document
    );

let storedPath = (dataset: DatasetDef, field: string) => {
  let source = dataset.fields[field]!.source;
  if (source.kind != 'stored') throw new Error(`${field} is not stored`);

  return source.path;
};

let decimal = (value: unknown) => parseAmount(value)!;

describe('seed plan', () => {
  it('lands near the target slice count over the seeded days', () => {
    let planner = createDayPlanner(shape, 1);
    let slices = 0;
    let sessions = 0;

    for (let day = 0; day < shape.days; day++) {
      for (let plan of planner.planDay(org, day)) {
        sessions++;
        slices += plan.slices.length;
      }
    }

    expect(planner.meanSlicesPerSession).toBeGreaterThan(2);
    expect(planner.meanSlicesPerSession).toBeLessThan(4);
    expect(
      Math.abs(slices - shape.slicesPerOrganization) / shape.slicesPerOrganization
    ).toBeLessThan(0.08);
    expect(sessions).toBeGreaterThan(0);
  });

  it('is deterministic, so a resumed seed writes the same ids', () => {
    let first = createDayPlanner(shape, 9).planDay(org, 5);
    let second = createDayPlanner(shape, 9).planDay(org, 5);

    expect(first.map(plan => plan.key)).toEqual(second.map(plan => plan.key));
    expect(first).toEqual(second);
  });

  it('keeps sessions inside their day and before the anchor', () => {
    let planner = createDayPlanner(shape, 4);

    for (let day of [0, shape.days - 1]) {
      let start = dayStartOf(anchor, shape, day).getTime();

      for (let plan of planner.planDay(org, day)) {
        expect(plan.startedAt.getTime()).toBeGreaterThanOrEqual(start);
        expect(plan.startedAt.getTime()).toBeLessThan(start + dayMs);
        expect(plan.endedAt.getTime()).toBeLessThanOrEqual(anchor.getTime());
      }
    }
  });
});

describe('seeded documents', () => {
  let planner = createDayPlanner(shape, 1);
  let plans = planner.planDay(org, shape.days - 2).slice(0, 25);

  it('builds sessions and slices the store models and the list accept', async () => {
    expect(plans.length).toBeGreaterThan(0);

    for (let plan of plans) {
      let { session, slices } = buildSessionDocuments({ shape, org, plan, now: anchor });

      await expect(new Session(session).validate()).resolves.toBeUndefined();
      expect(isSummaryStale(session)).toBe(false);
      expect(session.frozen).toBeUndefined();
      expect(session.observed.userId).toMatch(/^aten_user_/);
      expect(session.summary!.models.map(model => model.modelId).every(Boolean)).toBe(true);
      expect(slices).toHaveLength(plan.slices.length);

      let sliceCost = slices.reduce((sum, slice) => sum + decimal(slice.costUsd), 0n);
      expect(sliceCost).toBe(
        plan.slices.reduce((sum, slice) => sum + decimal(slice.costUsd.toFixed(9)), 0n)
      );
      expect(slices.reduce((sum, slice) => sum + slice.requests, 0)).toBe(
        session.summary!.requests
      );
      expect(slices.filter(slice => slice.sessionsStarted == 1)).toHaveLength(1);

      for (let slice of slices) {
        await expect(new Slice(slice).validate()).resolves.toBeUndefined();
        expect(slice.sessionKey).toBe(session._id);
        expect(slice.instanceId).toBe(session.instanceId);
        expect(slice.expiresAt.getTime()).toBeGreaterThan(anchor.getTime());

        for (let field of ['user', 'model', 'metorial.instance', 'billing.mode']) {
          expect(pathValue(slice, storedPath(usageDataset, field))).toBeDefined();
        }
        expect(pathValue(slice, storedPath(usageDataset, 'cost.usd'))).toBeInstanceOf(
          mongoose.Types.Decimal128
        );
      }
    }
  });

  it('marks sessions older than record retention frozen', () => {
    let old = planner.planDay(org, 0)[0]!;
    let { session } = buildSessionDocuments({
      shape,
      org,
      plan: old,
      now: new Date(anchor.getTime() + 200 * dayMs)
    });

    expect(session.frozen).toBe(true);
  });

  it('builds events from the ingest path in the shape the requests dataset reads', async () => {
    let templates = await buildEventTemplates(defaultTrafficProfile, 1);
    let plan = plans[0]!;
    let events = buildEventDocuments({ shape, org, plan, count: 400, templates, seed: 1 });
    let requests = events.filter(
      event => event.type == 'model.request' && event.source.role == 'primary'
    );

    expect(new Set(events.map(event => event._id)).size).toBe(400);
    expect(requests.length).toBeGreaterThan(100);

    for (let event of events) {
      await expect(new Event(event).validate()).resolves.toBeUndefined();
      expect(event.organizationId).toBe(org.organizationId);
      expect(event.ctx.sessionKey).toBe(plan.key);
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(plan.startedAt.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(plan.lastActivityAt.getTime());
      expect(event.content ?? []).toEqual([]);
    }

    let ok = requests.find(event => event.data.outcome == 'ok')!;
    expect(pathValue(ok, storedPath(requestsDataset, 'model.raw'))).toBeTypeOf('string');
    expect(pathValue(ok, storedPath(requestsDataset, 'user'))).toBe(
      org.userIds[plan.userIndex]
    );
    expect(pathValue(ok, 'data.usage.cacheRead')).toBeTypeOf('number');
    expect(pathValue(ok, 'data.cost.amount')).toBeInstanceOf(mongoose.Types.Decimal128);
  });
});
