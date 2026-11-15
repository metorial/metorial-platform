import type {
  SecuritySpecCensus,
  SecuritySpecCensusClassification
} from '@metorial-subspace/db';
import { createHash } from 'node:crypto';

export let CENSUS_WINDOW_DAYS = 14;

let DISJOINT_OVERLAP = 0.2;

export type CensusTool = {
  key: string;
  description?: string | null;
  inputSchema?: unknown;
  annotations?: unknown;
};

export type CensusObservation = {
  credentialKey: string;
  observedAt: Date;
  tools: CensusTool[];
};

let canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value == 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, canonicalize((value as any)[key])])
    );
  }
  return value;
};

let sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export let hashTool = (tool: CensusTool) =>
  sha256(
    JSON.stringify(
      canonicalize({
        key: tool.key,
        description: (tool.description ?? '').replace(/\s+/g, ' ').trim(),
        inputSchema: tool.inputSchema ?? null,
        annotations: tool.annotations ?? null
      })
    )
  );

export let hashToolSet = (tools: CensusTool[]) => {
  let definitions = Object.fromEntries(
    [...tools]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(tool => [tool.key, hashTool(tool)])
  );
  return { hash: sha256(JSON.stringify(definitions)), definitions };
};

let overlap = (a: string[], b: string[]) => {
  let setB = new Set(b);
  let shared = a.filter(key => setB.has(key)).length;
  let union = new Set([...a, ...b]).size;
  return union == 0 ? 1 : shared / union;
};

export let classifySpecCensus = (d: {
  observations: CensusObservation[];
  now?: Date;
}): SecuritySpecCensus => {
  let now = d.now ?? new Date();
  let windowStart = new Date(now.getTime() - CENSUS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  let observations = d.observations
    .filter(observation => observation.observedAt >= windowStart)
    .sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());

  let specs = new Map<
    string,
    {
      definitions: Record<string, string>;
      firstSeenAt: Date;
      lastSeenAt: Date;
      credentials: Set<string>;
    }
  >();
  let latestByCredential = new Map<string, string>();

  for (let observation of observations) {
    let { hash, definitions } = hashToolSet(observation.tools);
    let spec = specs.get(hash) ?? {
      definitions,
      firstSeenAt: observation.observedAt,
      lastSeenAt: observation.observedAt,
      credentials: new Set<string>()
    };

    spec.lastSeenAt = observation.observedAt;
    spec.credentials.add(observation.credentialKey);
    specs.set(hash, spec);
    latestByCredential.set(observation.credentialKey, hash);
  }

  let concurrent = [...new Set(latestByCredential.values())];
  let divergentTools: string[] = [];
  let addedTools: string[] = [];
  let removedTools: string[] = [];
  let classification: SecuritySpecCensusClassification = 'stable';

  if (specs.size > 1 && concurrent.length == 1) {
    classification = 'evolved';

    let current = specs.get(concurrent[0]!)!;
    let previous = [...specs.entries()]
      .filter(([hash]) => hash != concurrent[0])
      .sort((a, b) => b[1].lastSeenAt.getTime() - a[1].lastSeenAt.getTime())[0]![1];

    addedTools = Object.keys(current.definitions).filter(
      key => !(key in previous.definitions)
    );
    removedTools = Object.keys(previous.definitions).filter(
      key => !(key in current.definitions)
    );
  }

  if (concurrent.length > 1) {
    let definitionsByKey = new Map<string, Set<string>>();
    for (let hash of concurrent) {
      for (let [key, definition] of Object.entries(specs.get(hash)!.definitions)) {
        let set = definitionsByKey.get(key) ?? new Set<string>();
        set.add(definition);
        definitionsByKey.set(key, set);
      }
    }

    divergentTools = [...definitionsByKey.entries()]
      .filter(([, definitions]) => definitions.size > 1)
      .map(([key]) => key)
      .sort();

    if (divergentTools.length) {
      classification = 'divergent_definitions';
    } else {
      let keySets = concurrent.map(hash => Object.keys(specs.get(hash)!.definitions));
      let isDisjoint = keySets.some((a, i) =>
        keySets.slice(i + 1).some(b => overlap(a, b) < DISJOINT_OVERLAP)
      );
      classification = isDisjoint ? 'disjoint' : 'scoped_subset';
    }
  }

  return {
    classification,
    windowDays: CENSUS_WINDOW_DAYS,
    computedAt: now.toISOString(),
    hashes: [...specs.entries()].map(([hash, spec]) => ({
      hash,
      firstSeenAt: spec.firstSeenAt.toISOString(),
      lastSeenAt: spec.lastSeenAt.toISOString(),
      credentials: spec.credentials.size,
      toolKeys: Object.keys(spec.definitions)
    })),
    divergentTools,
    addedTools,
    removedTools
  };
};
