import type { AgentTrackingClient } from '@mtsrc/agent-tracking-api-internal';
import type { RecordDocument, Store } from '@mtsrc/agent-tracking-store';
import { createSampler, seedOf } from '../lib/random';
import type { TrafficProfile } from '../load/profile';
import {
  buildEventDocuments,
  buildSessionDocuments,
  createDayPlanner,
  dayStartOf,
  type DayPlanner,
  type OrgContext,
  type SessionPlan
} from './documents';
import type { SeedShape } from './shape';
import {
  deleteMarker,
  deleteWhere,
  insertAll,
  markerId,
  organizationCollections,
  saveMarker
} from './store';
import { buildEventTemplates } from './templates';

let organizationRefPrefix = 'atbench-org-';

let canaryRefPrefix = 'atbench-canary-';

let eventFlushSize = 20_000;

let canarySessions = 3;

type MarkerOrganization = OrgContext & { ref: string; nextDay: number };

type MarkerCanary = {
  ref: string;
  organizationId: string;
  projectId: string;
  instanceIds: string[];
};

export type SeedMarker = {
  _id: typeof markerId;
  createdAt: Date;
  updatedAt: Date;
  status: 'seeding' | 'complete';
  seed: number;
  anchor: Date;
  shape: SeedShape;
  organizations: MarkerOrganization[];
  canary?: MarkerCanary;
  canaryVerified?: { at: Date; sessions: number; requests: number };
  verified?: { at: Date; organizations: number };
  lastError?: string;
  written: { sessions: number; slices: number; events: number };
};

type SeedLog = (message: string) => void;

class StoreNotServedError extends Error {}

export let seedDecision = (marker: SeedMarker | null, seed: number, shape: SeedShape) => {
  if (!marker) return 'start';
  if (marker.seed != seed || JSON.stringify(marker.shape) != JSON.stringify(shape)) {
    return 'refuse';
  }

  return marker.status == 'complete' ? 'complete' : 'resume';
};

export let canaryProblem = (d: {
  keys: string[];
  expectedKeys: string[];
  requests: number;
  expectedRequests: number;
}) => {
  if (JSON.stringify([...d.keys].sort()) != JSON.stringify([...d.expectedKeys].sort())) {
    return `session.list returned ${d.keys.length} sessions, the canary wrote ${d.expectedKeys.length}`;
  }
  if (d.requests != d.expectedRequests) {
    return `query.run counted ${d.requests} requests, the canary wrote ${d.expectedRequests}`;
  }

  return null;
};

let ensureOrganization = async (d: {
  client: AgentTrackingClient;
  ref: string;
  instances: number;
  developers: number;
  index: number;
  anchor: Date;
}) => {
  let { client } = d;

  let organization = await client.organization.upsert({
    ref: d.ref,
    name: `Agent Tracking bench ${d.ref}`
  });
  let project = await client.project.upsert({
    organizationId: organization.id,
    ref: `${d.ref}-project`,
    name: 'Bench project'
  });

  let instanceIds: string[] = [];
  for (let index = 0; index < d.instances; index++) {
    let instance = await client.instance.upsert({
      organizationId: organization.id,
      projectId: project.id,
      ref: `${d.ref}-instance-${index}`,
      name: `Bench instance ${index}`
    });
    instanceIds.push(instance.id);
  }

  let userIds: string[] = [];
  for (let index = 0; index < d.developers; index++) {
    let label = String(index + 1).padStart(4, '0');
    let entity = await client.entity.upsert({
      organizationId: organization.id,
      kind: 'user',
      ref: `${d.ref}-user-${label}`,
      name: `Bench Developer ${label}`
    });
    userIds.push(entity.id);
  }

  return {
    index: d.index,
    ref: d.ref,
    organizationId: organization.id,
    projectId: project.id,
    instanceIds,
    userIds,
    anchor: d.anchor
  };
};

let totalRequestsOf = (result: unknown) => {
  let value = result as {
    totals?: Record<string, unknown> | null;
    rows?: Record<string, unknown>[];
  };
  let total = value.totals?.requests;
  if (typeof total == 'number') return total;

  return (value.rows ?? []).reduce(
    (sum, row) => sum + (typeof row.requests == 'number' ? row.requests : 0),
    0
  );
};

let usageRequests = async (d: {
  client: AgentTrackingClient;
  organizationId: string;
  from: Date;
  to: Date;
}) =>
  totalRequestsOf(
    await d.client.query.run({
      organizationId: d.organizationId,
      query: {
        atq: '0',
        dataset: 'usage',
        range: { from: d.from.toISOString(), to: d.to.toISOString() },
        measures: ['requests'],
        totals: true,
        labels: false
      }
    })
  );

let removeOrganizationData = async (
  store: Store,
  organizationId: string,
  instanceIds: string[]
) => {
  let collections = store.collections();

  for (let name of organizationCollections) {
    await deleteWhere(collections[name], { organizationId });
  }
  await deleteWhere(collections.sessionLinks, { instanceId: { $in: instanceIds } });
};

let removeCanary = async (d: {
  store: Store;
  client: AgentTrackingClient;
  marker: SeedMarker;
}) => {
  let canary = d.marker.canary;
  if (!canary) return;

  await removeOrganizationData(d.store, canary.organizationId, canary.instanceIds);
  await d.client.organization.erase({ organizationId: canary.organizationId }).catch(() => {});

  delete d.marker.canary;
};

let canaryPlans = (planner: DayPlanner, shape: SeedShape, org: OrgContext) => {
  let plans: SessionPlan[] = [];

  for (let day = shape.days - 1; day >= 0 && plans.length < canarySessions; day--) {
    plans.push(...planner.planDay(org, day).slice(0, canarySessions - plans.length));
  }

  return plans;
};

// Writes a handful of sessions for a throwaway organization and asks the service behind the RPC
// for them. If it does not return exactly those, it reads another database, and seeding the
// bulk would benchmark nothing.
let verifyCanary = async (d: {
  store: Store;
  client: AgentTrackingClient;
  marker: SeedMarker;
  planner: DayPlanner;
  log: SeedLog;
  fresh: boolean;
}) => {
  let { store, client, marker } = d;
  let shape = marker.shape;

  await removeCanary(d);

  let created = await ensureOrganization({
    client,
    ref: `${canaryRefPrefix}${marker.seed}-${Date.now()}`,
    instances: 1,
    developers: 1,
    index: -1,
    anchor: marker.anchor
  });

  marker.canary = {
    ref: created.ref,
    organizationId: created.organizationId,
    projectId: created.projectId,
    instanceIds: created.instanceIds
  };
  await saveMarker(store, marker);

  let plans = canaryPlans(d.planner, shape, created);
  let sessions = [];
  let slices = [];

  for (let plan of plans) {
    let built = buildSessionDocuments({ shape, org: created, plan, now: marker.anchor });
    sessions.push(built.session);
    slices.push(...built.slices);
  }

  let collections = store.collections();
  await insertAll(collections.sessions, sessions);
  await insertAll(collections.usageSlices, slices);

  let expectedKeys = sessions.map(session => session._id);
  let expectedRequests = slices.reduce((sum, slice) => sum + slice.requests, 0);
  let problem: string | null = null;

  try {
    let page = await client.session.list({
      organizationId: created.organizationId,
      instanceIds: created.instanceIds,
      limit: 10
    });
    let requests = await usageRequests({
      client,
      organizationId: created.organizationId,
      from: dayStartOf(marker.anchor, shape, 0),
      to: marker.anchor
    });

    problem = canaryProblem({
      keys: page.items.map(item => item.sessionKey),
      expectedKeys,
      requests,
      expectedRequests
    });
  } catch (error) {
    problem = `the canary reads failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  await removeCanary(d);

  if (problem) {
    marker.lastError = problem;

    if (d.fresh && marker.organizations.length == 0) await deleteMarker(store);
    else await saveMarker(store, marker);

    throw new StoreNotServedError(
      `The RPC service at --rpc-url is not reading this store (${problem}). Point --rpc-url at an API task whose AGENT_TRACKING_MONGO_URL is the database named by --mongo-url-env. The canary organization was removed.`
    );
  }

  marker.canaryVerified = {
    at: new Date(),
    sessions: expectedKeys.length,
    requests: expectedRequests
  };
  await saveMarker(store, marker);
  d.log(
    `canary: the service returned the ${expectedKeys.length} canary sessions and ${expectedRequests} requests`
  );
};

let assertSeededYearHasRequests = async (d: {
  store: Store;
  client: AgentTrackingClient;
  marker: SeedMarker;
}) => {
  for (let org of d.marker.organizations) {
    let requests = await usageRequests({
      client: d.client,
      organizationId: org.organizationId,
      from: dayStartOf(d.marker.anchor, d.marker.shape, 0),
      to: d.marker.anchor
    });

    if (requests == 0) {
      d.marker.lastError = `organization ${org.index}: query.run counts no requests in the seeded year`;
      await saveMarker(d.store, d.marker);

      throw new StoreNotServedError(
        `The service does not return what was seeded (${d.marker.lastError}). The marker stays incomplete, so bench refuses to run.`
      );
    }
  }
};

// The store package logs its index builds with console.log; stdout carries the JSON result.
let buildIndexes = async (store: Store) => {
  let log = console.log;
  console.log = console.error;

  try {
    await store.ensureIndexes();
  } finally {
    console.log = log;
  }
};

export let seedStore = async (d: {
  store: Store;
  marker: SeedMarker | null;
  client: AgentTrackingClient;
  shape: SeedShape;
  profile: TrafficProfile;
  seed: number;
  log: SeedLog;
}) => {
  let { store, client, log } = d;
  let marker = d.marker;
  let fresh = !marker;
  let decision = seedDecision(marker, d.seed, d.shape);

  if (decision == 'refuse') {
    throw new Error(
      `The database was seeded with seed ${marker!.seed} and another shape. Run cleanup first, or pass the same --seed and shape to resume.`
    );
  }

  if (decision == 'complete') {
    log('the database is already seeded with this seed and shape');
    return marker!;
  }

  await buildIndexes(store);

  if (!marker) {
    let now = new Date();
    marker = {
      _id: markerId,
      createdAt: now,
      updatedAt: now,
      status: 'seeding',
      seed: d.seed,
      anchor: now,
      shape: d.shape,
      organizations: [],
      written: { sessions: 0, slices: 0, events: 0 }
    };
    await saveMarker(store, marker);
    log(`marker written; anchor ${now.toISOString()}`);
  }

  let planner = createDayPlanner(d.shape, d.seed);

  if (!marker.canaryVerified) {
    await verifyCanary({ store, client, marker, planner, log, fresh });
  }

  for (let index = marker.organizations.length; index < d.shape.organizations; index++) {
    let organization = await ensureOrganization({
      client,
      ref: `${organizationRefPrefix}${d.seed}-${index}`,
      instances: d.shape.instancesPerOrganization,
      developers: d.shape.developers,
      index,
      anchor: marker.anchor
    });

    marker.organizations.push({ ...organization, nextDay: 0 });
    marker.updatedAt = new Date();
    await saveMarker(store, marker);
    log(
      `organization ${index}: ${organization.organizationId}, ${organization.userIds.length} users`
    );
  }

  let templates = await buildEventTemplates(d.profile, d.seed);

  log(
    `plan: ${Math.round(planner.sessionsPerOrganization)} sessions and about ${d.shape.slicesPerOrganization} slices per organization (${planner.meanSlicesPerSession.toFixed(2)} slices per session)`
  );

  let collections = store.collections();

  for (let org of marker.organizations) {
    let eventsPerSession = planner.eventsPerSession(org);
    let firstEventDay = d.shape.days - d.shape.eventDays;

    for (let day = org.nextDay; day < d.shape.days; day++) {
      let plans = planner.planDay(org, day);
      let sampler = createSampler(seedOf(d.seed, org.index, day, 'event-counts'));
      let sessions = [];
      let slices = [];
      let events: RecordDocument[] = [];
      let eventsWritten = 0;
      let eventsBuilt = 0;

      for (let plan of plans) {
        let built = buildSessionDocuments({ shape: d.shape, org, plan, now: marker.anchor });
        sessions.push(built.session);
        slices.push(...built.slices);

        if (day >= firstEventDay) {
          let whole = Math.floor(eventsPerSession);
          let count = whole + (sampler.bool(eventsPerSession - whole) ? 1 : 0);
          events.push(
            ...buildEventDocuments({
              shape: d.shape,
              org,
              plan,
              count,
              templates,
              seed: d.seed
            })
          );
        }

        if (events.length >= eventFlushSize) {
          eventsBuilt += events.length;
          eventsWritten += await insertAll(collections.events, events);
          events = [];
        }
      }

      eventsBuilt += events.length;

      let written = {
        sessions: await insertAll(collections.sessions, sessions),
        slices: await insertAll(collections.usageSlices, slices),
        events: eventsWritten + (await insertAll(collections.events, events))
      };

      // The day's progress lands in one marker write, after its documents, so a resumed day is
      // counted once: its inserts are idempotent and its counts were never saved.
      org.nextDay = day + 1;
      marker.written.sessions += written.sessions;
      marker.written.slices += written.slices;
      marker.written.events += written.events;
      marker.updatedAt = new Date();
      await saveMarker(store, marker);

      if (day % 10 == 0 || day == d.shape.days - 1) {
        log(
          `organization ${org.index} day ${day + 1}/${d.shape.days}: ${sessions.length} sessions, ${slices.length} slices, ${eventsBuilt} events`
        );
      }
    }
  }

  await assertSeededYearHasRequests({ store, client, marker });

  marker.status = 'complete';
  marker.verified = { at: new Date(), organizations: marker.organizations.length };
  delete marker.lastError;
  marker.updatedAt = new Date();
  await saveMarker(store, marker);

  return marker;
};

export let cleanupStore = async (d: {
  store: Store;
  marker: SeedMarker;
  client: AgentTrackingClient;
  eraseOrganizations: boolean;
  log: SeedLog;
}) => {
  let { store, marker } = d;

  await removeCanary({ store, client: d.client, marker });

  for (let org of marker.organizations) {
    await removeOrganizationData(store, org.organizationId, org.instanceIds);
    d.log(`organization ${org.index}: bench documents deleted`);

    if (d.eraseOrganizations) {
      await d.client.organization.erase({ organizationId: org.organizationId });
      d.log(`organization ${org.index}: erase requested`);
    }
  }

  await deleteMarker(store);
  d.log('marker removed');
};
