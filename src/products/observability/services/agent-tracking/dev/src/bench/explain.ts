import { sessionListQuery } from '@mtsrc/agent-tracking-module-sessions';
import type { SessionDocument, Store } from '@mtsrc/agent-tracking-store';
import type { Clock } from '../lib/clock';
import { dashboardPageSize } from './queries';
import type { SeedMarker } from './seed';

type ListInput = Parameters<typeof sessionListQuery<'lastActivity'>>[0];

type ExplainShape = {
  name: string;
  filter: Record<string, unknown>;
  sort: Record<string, 1 | -1>;
};

export type ExplainResult = {
  name: string;
  indexes: string[];
  blockingSort: boolean;
  collectionScan: boolean;
  keysExamined: number | null;
  docsExamined: number | null;
  returned: number | null;
  timeMs: number | null;
  stages: string[];
};

type PlanNode = Record<string, unknown>;

// DocumentDB reports counters as strings.
let numberAt = (node: PlanNode, keys: string[]) => {
  for (let key of keys) {
    let value = typeof node[key] == 'string' ? Number(node[key]) : node[key];
    if (typeof value == 'number' && Number.isFinite(value)) return value;
  }

  return null;
};

// MongoDB and DocumentDB nest plans differently (inputStage, inputStages, shards, executionStages),
// so the walk visits every object and collects stages and index names wherever they appear.
export let readExplain = (name: string, explain: unknown): ExplainResult => {
  let stages: string[] = [];
  let indexes = new Set<string>();
  let root = (explain ?? {}) as PlanNode;
  let queryPlanner = (root.queryPlanner ?? {}) as PlanNode;
  let executionStats = (root.executionStats ?? {}) as PlanNode;

  let walk = (node: unknown) => {
    if (!node || typeof node != 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);

    let record = node as PlanNode;
    if (typeof record.stage == 'string') stages.push(record.stage);
    if (typeof record.indexName == 'string') indexes.add(record.indexName);

    for (let [key, value] of Object.entries(record)) {
      if (key != 'rejectedPlans' && typeof value == 'object') walk(value);
    }
  };

  walk(queryPlanner.winningPlan);
  walk(executionStats.executionStages);

  return {
    name,
    indexes: [...indexes],
    blockingSort: stages.some(stage => stage == 'SORT' || stage == 'SORT_KEY_GENERATOR'),
    collectionScan: stages.includes('COLLSCAN'),
    keysExamined: numberAt(executionStats, ['totalKeysExamined', 'keysExamined']),
    docsExamined: numberAt(executionStats, ['totalDocsExamined', 'docsExamined']),
    returned:
      numberAt(executionStats, ['nReturned']) ??
      numberAt((executionStats.executionStages ?? {}) as PlanNode, ['nReturned']),
    timeMs:
      numberAt(executionStats, ['executionTimeMillis', 'executionTimeMillisEstimate']) ??
      numberAt((executionStats.executionStages ?? {}) as PlanNode, [
        'executionTimeMillisEstimate'
      ]),
    stages: [...new Set(stages)]
  };
};

let shapeOf = (
  name: string,
  d: Omit<ListInput, 'orderBy' | 'side'> & { side?: ListInput['side'] }
): ExplainShape => ({
  name,
  ...sessionListQuery({ ...d, orderBy: 'lastActivity', side: d.side ?? 'after' })
});

let positionOf = (session: Pick<SessionDocument, '_id' | 'lastActivityAt'>) => ({
  lastActivityAt: session.lastActivityAt,
  sessionKey: session._id
});

// The queries `sessionService.listSessions` sends for the dashboard's pages, built by the same
// `sessionListQuery`.
export let explainShapes = async (d: { store: Store; marker: SeedMarker }) => {
  let org = d.marker.organizations[0];
  if (!org) throw new Error('The marker lists no organizations; seed first.');

  let { sessions } = d.store.collections();
  let organization = { id: org.organizationId };
  let instance = { instanceIds: [org.instanceIds[0]!] };
  let modelId = d.marker.shape.models[0]!.id;

  let positionsFor = async (order: ListInput['order']) => {
    let forward = shapeOf('', { organization, filters: instance, order });
    let backward = shapeOf('', { organization, filters: instance, order, side: 'before' });
    let projection = { _id: 1, lastActivityAt: 1 };

    let middle = await sessions
      .find(forward.filter, {
        sort: forward.sort,
        projection,
        skip: dashboardPageSize,
        limit: 1
      })
      .next();
    let nearEnd = await sessions
      .find(backward.filter, {
        sort: backward.sort,
        projection,
        skip: dashboardPageSize,
        limit: 1
      })
      .next();
    let end = await sessions
      .find(backward.filter, { sort: backward.sort, projection, limit: 1 })
      .next();

    if (!middle || !nearEnd || !end) throw new Error('Too few seeded sessions to page.');

    return { middle: positionOf(middle), nearEnd: positionOf(nearEnd), end: positionOf(end) };
  };

  let shapes: ExplainShape[] = [
    shapeOf('1 organization', { organization, filters: {}, order: 'desc' }),
    shapeOf('2 organization + instance', { organization, filters: instance, order: 'desc' }),
    shapeOf('3a organization + instance + one user', {
      organization,
      filters: { ...instance, userIds: org.userIds.slice(0, 1) },
      order: 'desc'
    }),
    shapeOf('3b organization + instance + three users ($in)', {
      organization,
      filters: { ...instance, userIds: org.userIds.slice(0, 3) },
      order: 'desc'
    }),
    shapeOf('4 organization + instance + model', {
      organization,
      filters: { ...instance, modelIds: [modelId] },
      order: 'desc'
    })
  ];

  for (let order of ['desc', 'asc'] as const) {
    let positions = await positionsFor(order);

    for (let side of ['after', 'before'] as const) {
      shapes.push(
        shapeOf(`5 position ${side}, ${order}`, {
          organization,
          filters: instance,
          order,
          side,
          position: positions.middle
        })
      );
    }

    shapes.push(
      shapeOf(`6 last page after, ${order}`, {
        organization,
        filters: instance,
        order,
        position: positions.nearEnd
      }),
      shapeOf(`6 last page before, ${order}`, {
        organization,
        filters: instance,
        order,
        side: 'before',
        position: positions.end
      })
    );
  }

  let results: ExplainResult[] = [];

  for (let shape of shapes) {
    let explain = await sessions
      .find(shape.filter, { sort: shape.sort, limit: dashboardPageSize + 1 })
      .explain('executionStats');

    results.push(readExplain(shape.name, explain));
  }

  return results;
};

let indexNameOf = (keys: Record<string, unknown>) =>
  Object.entries(keys)
    .map(([key, value]) => `${key}_${value}`)
    .join('_');

export let sessionListIndexes = (store: Store) =>
  store.sessions.schema
    .indexes()
    .map(([keys, options]) => ({ keys: keys as Record<string, 1 | -1>, options }))
    .filter(index => 'lastActivityAt' in index.keys && '_id' in index.keys);

export let timeSessionIndexBuilds = async (d: { store: Store; clock: Clock }) => {
  let { sessions } = d.store.collections();
  let documents = await sessions.estimatedDocumentCount();
  let builds: { index: string; ms: number }[] = [];

  for (let index of sessionListIndexes(d.store)) {
    let name = indexNameOf(index.keys);

    if (await sessions.indexExists(name)) await sessions.dropIndex(name);

    let started = d.clock.now();
    await sessions.createIndex(index.keys, { ...(index.options as object), name });
    builds.push({ index: name, ms: Math.round(d.clock.now() - started) });
  }

  return { documents, builds };
};
