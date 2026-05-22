import type {
  ControlDatabase,
  ResolvedDatabase,
  ResolvedDep,
  ResolvedGraph
} from '../types';
import { PRESET_PORTS } from '../types';

let collectFromGraph = (graph: ResolvedGraph): ControlDatabase[] => {
  let databases: ControlDatabase[] = [...(graph.config.databases ?? [])];

  for (let dep of graph.deps) {
    if (dep.kind === 'control' && dep.children && (dep.config.scope ?? 'service') === 'service') {
      databases.push(...(dep.children.config.databases ?? []));
    }
  }

  return databases;
};

export let collectDatabases = (graph: ResolvedGraph): ControlDatabase[] => {
  let seen = new Map<string, ControlDatabase>();

  for (let db of collectFromGraph(graph)) {
    let key = `${db.adapter}:${db.name}`;
    let existing = seen.get(key);
    if (existing) {
      let dep = db.dep ?? 'postgres';
      let existingDep = existing.dep ?? 'postgres';
      if (existingDep !== dep || (existing.owner ?? '') !== (db.owner ?? '')) {
        throw new Error(
          `Conflicting database declaration for "${db.name}": ${JSON.stringify(existing)} vs ${JSON.stringify(db)}`
        );
      }
      continue;
    }
    seen.set(key, db);
  }

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
};

let findPostgresDep = (graph: ResolvedGraph, depName: string): ResolvedDep | undefined =>
  graph.deps.find(d => d.name === depName && d.kind === 'preset' && d.config.preset === 'postgres');

let resolvePostgresDatabase = (
  db: ControlDatabase,
  graph: ResolvedGraph
): ResolvedDatabase => {
  if (db.adapter !== 'postgres') {
    throw new Error(`Unsupported database adapter "${db.adapter}" for database "${db.name}"`);
  }

  let depName = db.dep ?? 'postgres';
  let postgresDep = findPostgresDep(graph, depName);
  if (!postgresDep) {
    throw new Error(`Database "${db.name}" references postgres dep "${depName}" which is not in the graph`);
  }

  let depEnv = postgresDep.config.env ?? {
    POSTGRES_USER: 'postgres',
    POSTGRES_PASSWORD: 'postgres',
    POSTGRES_DB: 'postgres'
  };

  let user = db.owner ?? depEnv.POSTGRES_USER ?? 'postgres';
  let password = depEnv.POSTGRES_PASSWORD ?? 'postgres';
  let host = postgresDep.alias;
  let port = postgresDep.port ?? PRESET_PORTS.postgres ?? 5432;

  return {
    name: db.name,
    adapter: 'postgres',
    dep: depName,
    owner: user,
    user,
    password,
    host,
    port,
    encoding: db.encoding ?? 'UTF8'
  };
};

export let resolveDatabases = (graph: ResolvedGraph): Record<string, ResolvedDatabase> => {
  let databases: Record<string, ResolvedDatabase> = {};

  for (let db of collectDatabases(graph)) {
    databases[db.name] = resolvePostgresDatabase(db, graph);
  }

  return databases;
};

export let postgresDatabasesForDep = (
  graph: ResolvedGraph,
  depName: string
): ResolvedDatabase[] =>
  Object.values(graph.databases ?? {}).filter(
    db => db.adapter === 'postgres' && db.dep === depName
  );
