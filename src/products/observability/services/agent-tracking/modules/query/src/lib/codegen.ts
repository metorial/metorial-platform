import type { TimeUnit } from '@mtsrc/agent-tracking-query-spec';
import { type DatasetDef, type ResolvedField, sourceKindPath, sourceKinds } from '../catalog';
import { cyclicExpression, type Predicate, reportedDay, toExpression } from './predicate';
import { type EffectiveScope, scan as scanStages, type Stage } from './scope';
import type { AggregateMeasure, BoundDimension, TimeRange } from './types';

export let maxGroups = 10_000;

export let mappedGroupsFactor = 5;

export let maxDistinctValues = 10_000;

type Expression = unknown;

// A mapped dimension whose values are mapped inside Mongo (needed when percentiles can't be merged
// after the fact): base values and their mapped values as parallel literal arrays.
export type MappingTable = {
  bases: unknown[];
  values: (string | null)[];
  raws?: unknown[];
  rawValues?: (string | null)[];
};

export type SplitFilter = { ids: string[] };

export type GroupScan = {
  dataset: DatasetDef;
  scope: EffectiveScope;
  range: TimeRange;
  timeZone: string;
  predicate: Predicate;
  dims: BoundDimension[];
  measures: AggregateMeasure[];
  wheres: Map<string, Predicate>;
  allocation: 'full' | 'split';
  splitFilters: SplitFilter[];
  mappingTables?: Map<number, MappingTable>;
  excludeDaily?: boolean;
  reported?: { path: string; where?: Predicate };
  cap: number;
};

let unwound = (index: number) => `_u${index}`;

let weightSum = (index: number) => `_s${index}`;

export let accumulatorName = (index: number) => `a${index}`;

export let keyName = (index: number) => `k${index}`;

export let rawKeyName = (index: number) => `r${index}`;

let ref = (path: string) => `$${path}`;

let isDailyAware = (dataset: DatasetDef) => !!dataset.dailyBuckets;

export let fieldValue = (field: ResolvedField): Expression => {
  let source = field.source;

  switch (source.kind) {
    case 'stored':
      return source.decimal ? { $toDouble: ref(source.path) } : ref(source.path);
    case 'coalesce':
      return source.paths
        .slice(0, -1)
        .reduceRight<Expression>(
          (fallback, path) => ({ $ifNull: [ref(path), fallback] }),
          ref(source.paths.at(-1)!)
        );
    case 'sum':
      return { $add: source.paths.map(path => ({ $ifNull: [ref(path), 0] })) };
    case 'size':
      return { $size: { $ifNull: [ref(source.path), []] } };
    default:
      throw new Error(`Field "${field.name}" has no numeric value.`);
  }
};

export let bucketExpression = (d: {
  dataset: DatasetDef;
  unit: TimeUnit;
  timeZone: string;
}): Expression => {
  let time = ref(d.dataset.timeField);
  let truncate = (date: Expression) => ({
    $dateTrunc: {
      date,
      unit: d.unit,
      timezone: d.timeZone,
      ...(d.unit == 'week' ? { startOfWeek: 'monday' } : {})
    }
  });

  if (!isDailyAware(d.dataset)) return truncate(time);

  // Daily aggregates can't be split, so they stay on the calendar day the source reported,
  // whatever the viewer's time zone (07 §8.2).
  return {
    $cond: [
      { $eq: [ref(d.dataset.dailyBuckets!.minutesPath), 1440] },
      truncate(reportedDay(time, d.timeZone)),
      truncate(time)
    ]
  };
};

export let binLabels = (bins: number[]) => [
  `<${bins[0]}`,
  ...bins.slice(0, -1).map((edge, index) => `${edge}-${bins[index + 1]}`),
  `>=${bins.at(-1)}`
];

let binExpression = (value: Expression, bins: number[]): Expression => {
  let labels = binLabels(bins);

  return {
    $switch: {
      branches: [
        { case: { $eq: [{ $ifNull: [value, null] }, null] }, then: null },
        ...bins.map((edge, index) => ({ case: { $lt: [value, edge] }, then: labels[index] }))
      ],
      default: labels.at(-1)
    }
  };
};

let tableLookup = (value: Expression, bases: unknown[], values: (string | null)[]) => ({
  $let: {
    vars: { index: { $indexOfArray: [{ $literal: bases }, value] } },
    in: {
      $cond: [
        { $lt: ['$$index', 0] },
        null,
        { $arrayElemAt: [{ $literal: values }, '$$index'] }
      ]
    }
  }
});

// Dimensions that need an `$unwind`: one document becomes one row per value.
export let unwindsOf = (dim: BoundDimension) => {
  let source = dim.field.source;
  return (
    source.kind == 'kind' ||
    source.kind == 'tag' ||
    source.kind == 'sourceKinds' ||
    (source.kind == 'entityAttribute' && source.via.kind == 'kind') ||
    !!dim.field.array
  );
};

let arrayPathOf = (dataset: DatasetDef, field: ResolvedField) => {
  let source = field.source;
  if (source.kind == 'array') return source.path;
  if (source.kind == 'mapped') return source.base;
  if (source.kind == 'entityAttribute' && source.via.kind == 'field') {
    return (dataset.fields[source.via.field]!.source as { path: string }).path;
  }

  throw new Error(`Field "${field.name}" isn't an array.`);
};

let kindEntries = (dataset: DatasetDef, key: string, level: number | 'all') => {
  let kinds = dataset.kinds;
  if (kinds?.kind != 'embedded') throw new Error(`"${dataset.name}" has no embedded kinds.`);

  let cond: Expression[] = [{ $eq: ['$$this.kind', key] }];
  if (level != 'all')
    cond.push({ $eq: [{ $ifNull: [`$$this.${kinds.depthKey}`, 0] }, level] });

  return {
    $filter: {
      input: { $ifNull: [ref(kinds.arrayPath), []] },
      cond: cond.length == 1 ? cond[0] : { $and: cond }
    }
  };
};

let unwindStages = (scan: GroupScan, dim: BoundDimension, index: number): Stage[] => {
  let { dataset } = scan;
  let source = dim.field.source;
  let name = unwound(index);
  let fields: Record<string, Expression> = {};
  let kinds = dataset.kinds?.kind == 'embedded' ? dataset.kinds : undefined;

  if (
    source.kind == 'kind' ||
    (source.kind == 'entityAttribute' && source.via.kind == 'kind')
  ) {
    let key = source.key;
    let level = source.kind == 'kind' ? dim.level : 0;

    fields[name] = kindEntries(dataset, key, level);
    if (scan.allocation == 'split' && kinds) {
      fields[weightSum(index)] = {
        $sum: { $map: { input: fields[name], in: `$$this.${kinds.weightKey}` } }
      };
    }
  } else if (source.kind == 'tag') {
    fields[name] = {
      $setUnion: [
        {
          $map: {
            input: {
              $filter: {
                input: { $ifNull: [ref(dataset.tagsPath!), []] },
                cond: { $eq: ['$$this.k', source.key] }
              }
            },
            in: '$$this.v'
          }
        },
        []
      ]
    };
  } else if (source.kind == 'sourceKinds') {
    fields[name] = {
      $concatArrays: sourceKinds.map(kind => ({
        $cond: [{ $eq: [{ $ifNull: [ref(sourceKindPath(kind)), null] }, null] }, [], [kind]]
      }))
    };
  } else {
    fields[name] = {
      $setUnion: [{ $ifNull: [ref(arrayPathOf(dataset, dim.field)), []] }, []]
    };
  }

  // Expressions in one $addFields see the input document, so the weight sum is built from the
  // value expression itself rather than from the field it defines.
  if (scan.allocation == 'split' && !fields[weightSum(index)]) {
    fields[weightSum(index)] = { $size: fields[name] };
  }

  return [
    { $addFields: fields },
    { $unwind: { path: `$${name}`, preserveNullAndEmptyArrays: true } }
  ];
};

let unwoundValue = (scan: GroupScan, dim: BoundDimension, index: number) => {
  let source = dim.field.source;
  let kinds = scan.dataset.kinds?.kind == 'embedded' ? scan.dataset.kinds : undefined;

  if (
    (source.kind == 'kind' ||
      (source.kind == 'entityAttribute' && source.via.kind == 'kind')) &&
    kinds
  ) {
    return `$${unwound(index)}.${kinds.idKey}`;
  }

  return `$${unwound(index)}`;
};

export let keyExpression = (
  scan: GroupScan,
  dim: BoundDimension,
  index: number
): Expression => {
  let source = dim.field.source;
  let value: Expression;

  if (unwindsOf(dim)) {
    value = unwoundValue(scan, dim, index);
  } else if (source.kind == 'time') {
    value = bucketExpression({
      dataset: scan.dataset,
      unit: source.unit,
      timeZone: scan.timeZone
    });
  } else if (source.kind == 'cyclic') {
    value = cyclicExpression({
      unit: source.unit,
      path: scan.dataset.timeField,
      timeZone: scan.timeZone,
      ...(scan.dataset.dailyBuckets
        ? { dailyPath: scan.dataset.dailyBuckets.minutesPath }
        : {})
    });
  } else if (source.kind == 'exists') {
    value = { $ne: [{ $ifNull: [ref(source.path), null] }, null] };
  } else if (source.kind == 'mapped') {
    value = ref(source.base);
  } else if (source.kind == 'entityAttribute' && source.via.kind == 'field') {
    value = ref((scan.dataset.fields[source.via.field]!.source as { path: string }).path);
  } else if (dim.bins) {
    value = fieldValue(dim.field);
  } else if (source.kind == 'stored') {
    value = ref(source.path);
  } else {
    throw new Error(`Field "${dim.field.name}" can't be grouped.`);
  }

  let table = scan.mappingTables?.get(index);
  if (table && source.kind == 'mapped') {
    let mapped = tableLookup(value, table.bases, table.values);
    if (!source.raw || !table.raws) return mapped;

    return {
      $cond: [
        { $eq: [{ $ifNull: [value, null] }, null] },
        tableLookup(ref(source.raw), table.raws, table.rawValues ?? []),
        mapped
      ]
    };
  }

  return dim.bins ? binExpression(value, dim.bins) : value;
};

export let weightExpression = (scan: GroupScan): Expression => {
  if (scan.allocation != 'split') return 1;

  let kinds = scan.dataset.kinds?.kind == 'embedded' ? scan.dataset.kinds : undefined;
  let factors: Expression[] = [];

  scan.dims.forEach((dim, index) => {
    if (!unwindsOf(dim)) return;

    let source = dim.field.source;
    let isKind =
      source.kind == 'kind' || (source.kind == 'entityAttribute' && source.via.kind == 'kind');
    let sum = `$${weightSum(index)}`;

    if (isKind && kinds && source.kind == 'kind' && dim.level == 'all') {
      factors.push({ $ifNull: [`$${unwound(index)}.${kinds.weightKey}`, 1] });
    } else if (isKind && kinds) {
      factors.push({
        $cond: [
          { $gt: [sum, 0] },
          { $divide: [{ $ifNull: [`$${unwound(index)}.${kinds.weightKey}`, 0] }, sum] },
          1
        ]
      });
    } else {
      factors.push({ $cond: [{ $gt: [sum, 0] }, { $divide: [1, sum] }, 1] });
    }
  });

  if (kinds) {
    for (let filter of scan.splitFilters) {
      let matching = {
        $filter: {
          input: { $ifNull: [ref(kinds.arrayPath), []] },
          cond: { $in: [`$$this.${kinds.idKey}`, { $literal: filter.ids }] }
        }
      };

      factors.push({
        $cond: [
          { $gt: [{ $size: matching }, 0] },
          {
            $min: [1, { $sum: { $map: { input: matching, in: `$$this.${kinds.weightKey}` } } }]
          },
          1
        ]
      });
    }
  }

  if (!factors.length) return 1;
  if (factors.length == 1) return factors[0];

  return { $multiply: factors };
};

let weighted = (value: Expression, weight: Expression) =>
  weight === 1 ? value : { $multiply: [value, weight] };

// Distinct values of a multi-valued field (an array, or every attributed entity of a kind).
let distinctValue = (scan: GroupScan, field: ResolvedField): Expression => {
  let source = field.source;
  let kinds = scan.dataset.kinds?.kind == 'embedded' ? scan.dataset.kinds : undefined;

  if (source.kind == 'kind' && kinds) {
    return {
      $map: {
        input: kindEntries(scan.dataset, source.key, 'all'),
        in: `$$this.${kinds.idKey}`
      }
    };
  }
  if (source.kind == 'array') return { $ifNull: [ref(source.path), []] };
  if (source.kind == 'stored') return ref(source.path);

  throw new Error(`Field "${field.name}" can't be counted distinctly.`);
};

export let isFlattenedDistinct = (measure: AggregateMeasure) =>
  measure.fn == 'countDistinct' &&
  (measure.field?.source.kind == 'kind' || !!measure.field?.array);

let accumulators = (scan: GroupScan, weight: Expression) => {
  let result: Record<string, Expression> = {};

  scan.measures.forEach((measure, index) => {
    let name = accumulatorName(index);
    let where = scan.wheres.get(measure.name);
    let cond = where ? toExpression(where) : null;
    let guarded = (value: Expression, otherwise: Expression) =>
      cond ? { $cond: [cond, value, otherwise] } : value;

    switch (measure.fn) {
      case 'count':
        result[name] = { $sum: weighted(guarded(1, 0), weight) };
        break;
      case 'sum':
        result[name] = {
          $sum: weighted(
            guarded({ $toDouble: { $ifNull: [fieldValue(measure.field!), 0] } }, 0),
            weight
          )
        };
        break;
      case 'avg': {
        let value = { $toDouble: fieldValue(measure.field!) };
        let present = { $ne: [{ $ifNull: [fieldValue(measure.field!), null] }, null] };
        let counted = cond ? { $and: [cond, present] } : present;

        result[name] = { $sum: weighted({ $cond: [counted, value, 0] }, weight) };
        result[`${name}_n`] = { $sum: weighted({ $cond: [counted, 1, 0] }, weight) };
        break;
      }
      case 'min':
      case 'max':
        result[name] = { [`$${measure.fn}`]: guarded(fieldValue(measure.field!), null) };
        break;
      case 'countDistinct':
        result[name] = { $addToSet: guarded(distinctValue(scan, measure.field!), '$$REMOVE') };
        break;
      case 'percentile':
        result[name] = {
          $percentile: {
            input: guarded({ $toDouble: fieldValue(measure.field!) }, null),
            p: [measure.q],
            method: 'approximate'
          }
        };
        break;
    }
  });

  return result;
};

export let groupKey = (scan: GroupScan) => {
  let key: Record<string, Expression> = {};

  scan.dims.forEach((dim, index) => {
    key[keyName(index)] = keyExpression(scan, dim, index);

    let source = dim.field.source;
    if (source.kind == 'mapped' && source.raw && !scan.mappingTables?.has(index)) {
      key[rawKeyName(index)] = {
        $cond: [{ $eq: [{ $ifNull: [ref(source.base), null] }, null] }, ref(source.raw), null]
      };
    }
  });

  return key;
};

export let hourDimensions = (dims: BoundDimension[]) =>
  dims.some(
    dim =>
      (dim.field.source.kind == 'time' && dim.field.source.unit == 'hour') ||
      (dim.field.source.kind == 'cyclic' && dim.field.source.unit == 'hourOfDay')
  );

let baseStages = (scan: GroupScan): Stage[] => {
  let extra =
    scan.excludeDaily && scan.dataset.dailyBuckets
      ? { [scan.dataset.dailyBuckets.minutesPath]: { $ne: 1440 } }
      : undefined;

  let stages = scanStages({
    dataset: scan.dataset,
    scope: scan.scope,
    range: scan.range,
    predicate: scan.predicate,
    ...(extra ? { extra } : {})
  });

  scan.dims.forEach((dim, index) => {
    if (unwindsOf(dim)) stages.push(...unwindStages(scan, dim, index));
  });

  return stages;
};

export let groupPipeline = (scan: GroupScan): Stage[] => {
  let weight = weightExpression(scan);
  let key = groupKey(scan);
  let stages = baseStages(scan);

  if (scan.reported) {
    let where = scan.reported.where ? toExpression(scan.reported.where) : null;
    let amount = { $toDouble: { $ifNull: [`$${scan.reported.path}.amount`, 0] } };

    stages.push(
      { $unwind: `$${scan.reported.path}` },
      {
        $group: {
          _id: {
            ...key,
            unit: `$${scan.reported.path}.unit`,
            basis: `$${scan.reported.path}.basis`
          },
          amount: { $sum: weighted(where ? { $cond: [where, amount, 0] } : amount, weight) }
        }
      },
      { $limit: scan.cap * 4 + 1 }
    );

    return stages;
  }

  stages.push(
    { $group: { _id: key, ...accumulators(scan, weight) } },
    { $limit: scan.cap + 1 }
  );

  let distincts: Record<string, Expression> = {};
  scan.measures.forEach((measure, index) => {
    if (measure.fn == 'countDistinct') {
      distincts[accumulatorName(index)] = {
        $slice: [`$${accumulatorName(index)}`, maxDistinctValues + 1]
      };
    }
  });
  if (Object.keys(distincts).length) stages.push({ $addFields: distincts });

  return stages;
};

export let groupCap = (dims: BoundDimension[]) =>
  dims.some(
    dim => dim.field.source.kind == 'mapped' || dim.field.source.kind == 'entityAttribute'
  )
    ? maxGroups * mappedGroupsFactor
    : maxGroups;

export let dailyCheckPipeline = (d: {
  dataset: DatasetDef;
  scope: EffectiveScope;
  range: TimeRange;
  predicate: Predicate;
}): Stage[] => [
  ...scanStages({ ...d, extra: { [d.dataset.dailyBuckets!.minutesPath]: 1440 } }),
  { $limit: 1 },
  { $count: 'count' }
];

export let distinctPipeline = (d: {
  dataset: DatasetDef;
  scope: EffectiveScope;
  range: TimeRange;
  predicate: Predicate;
  path: string;
  array?: boolean;
  limit: number;
}): Stage[] => [
  ...scanStages(d),
  ...(d.array ? [{ $unwind: `$${d.path}` }] : []),
  { $group: { _id: `$${d.path}` } },
  { $limit: d.limit + 1 }
];
