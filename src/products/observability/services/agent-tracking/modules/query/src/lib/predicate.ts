export type CompareOp = 'eq' | 'ne' | 'in' | 'nin' | 'gt' | 'gte' | 'lt' | 'lte';

export type Predicate =
  | { t: 'and'; items: Predicate[] }
  | { t: 'or'; items: Predicate[] }
  | { t: 'not'; item: Predicate }
  | { t: 'const'; value: boolean }
  | { t: 'cmp'; path: string; op: CompareOp; value: unknown; array?: boolean }
  | { t: 'null'; path: string; array?: boolean }
  | { t: 'regex'; path: string; patterns: string[]; array?: boolean }
  | { t: 'all'; path: string; values: unknown[] }
  | { t: 'elem'; path: string; item: Predicate }
  | {
      t: 'cyclic';
      unit: 'hourOfDay' | 'dayOfWeek';
      path: string;
      timeZone: string;
      op: CompareOp;
      value: unknown;
      dailyPath?: string;
    };

export let always: Predicate = { t: 'const', value: true };

export let never: Predicate = { t: 'const', value: false };

export let and = (items: Predicate[]): Predicate => {
  let flat = items.flatMap(item => (item.t == 'and' ? item.items : [item]));
  if (flat.some(item => item.t == 'const' && !item.value)) return never;

  let kept = flat.filter(item => !(item.t == 'const' && item.value));
  if (!kept.length) return always;
  if (kept.length == 1) return kept[0]!;

  return { t: 'and', items: kept };
};

export let or = (items: Predicate[]): Predicate => {
  let flat = items.flatMap(item => (item.t == 'or' ? item.items : [item]));
  if (flat.some(item => item.t == 'const' && item.value)) return always;

  let kept = flat.filter(item => !(item.t == 'const' && !item.value));
  if (!kept.length) return never;
  if (kept.length == 1) return kept[0]!;

  return { t: 'or', items: kept };
};

export let not = (item: Predicate): Predicate => {
  if (item.t == 'const') return { t: 'const', value: !item.value };
  if (item.t == 'not') return item.item;

  return { t: 'not', item };
};

export let escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let mongoOps: Record<CompareOp, string> = {
  eq: '$eq',
  ne: '$ne',
  in: '$in',
  nin: '$nin',
  gt: '$gt',
  gte: '$gte',
  lt: '$lt',
  lte: '$lte'
};

let regexOf = (pattern: string) => new RegExp(pattern, 'i');

// Every predicate compiles to a find-style query for the first `$match`, and to an aggregation
// expression for conditional accumulators. The two must agree; `predicate.test.ts` checks both.
export let toQuery = (predicate: Predicate): Record<string, unknown> => {
  switch (predicate.t) {
    case 'and':
      return { $and: predicate.items.map(toQuery) };
    case 'or':
      return { $or: predicate.items.map(toQuery) };
    case 'not':
      return { $nor: [toQuery(predicate.item)] };
    case 'const':
      return predicate.value ? {} : { _id: { $in: [] } };
    case 'cmp':
      return { [predicate.path]: { [mongoOps[predicate.op]]: predicate.value } };
    case 'null':
      return predicate.array
        ? { $or: [{ [predicate.path]: null }, { [predicate.path]: { $size: 0 } }] }
        : { [predicate.path]: null };
    case 'regex':
      return { [predicate.path]: { $in: predicate.patterns.map(regexOf) } };
    case 'all':
      return { [predicate.path]: { $all: predicate.values } };
    case 'elem':
      return { [predicate.path]: { $elemMatch: toQuery(predicate.item) } };
    case 'cyclic':
      return { $expr: toExpression(predicate) };
  }
};

let literal = (value: unknown): unknown => {
  if (typeof value == 'string' && value.startsWith('$')) return { $literal: value };
  if (Array.isArray(value))
    return value.some(item => typeof item == 'string' && item.startsWith('$'))
      ? { $literal: value }
      : value;

  return value;
};

let fieldRef = (path: string, base: string) => `${base}${path}`;

export let cyclicExpression = (d: {
  unit: 'hourOfDay' | 'dayOfWeek';
  path: string;
  timeZone: string;
  dailyPath?: string;
  base?: string;
}) => {
  let date = fieldRef(d.path, d.base ?? '$');
  let value =
    d.unit == 'hourOfDay'
      ? { $hour: { date, timezone: d.timeZone } }
      : {
          $isoDayOfWeek: {
            date: d.dailyPath
              ? {
                  $cond: [
                    { $eq: [fieldRef(d.dailyPath, d.base ?? '$'), 1440] },
                    reportedDay(date, d.timeZone),
                    date
                  ]
                }
              : date,
            timezone: d.timeZone
          }
        };

  if (d.unit == 'hourOfDay' && d.dailyPath) {
    return { $cond: [{ $eq: [fieldRef(d.dailyPath, d.base ?? '$'), 1440] }, null, value] };
  }

  return value;
};

export let reportedDay = (date: unknown, timeZone: string) => ({
  $dateFromParts: {
    year: { $year: date },
    month: { $month: date },
    day: { $dayOfMonth: date },
    timezone: timeZone
  }
});

let compareExpression = (op: CompareOp, value: unknown, operand: unknown, array?: boolean) => {
  let safe = literal(value);

  if (array) {
    let list = { $ifNull: [operand, []] };
    let values = op == 'in' || op == 'nin' ? safe : [safe];
    let hit = { $gt: [{ $size: { $setIntersection: [list, values] } }, 0] };

    if (op == 'eq' || op == 'in') return hit;
    if (op == 'ne' || op == 'nin') return { $not: [hit] };

    return {
      $gt: [
        {
          $size: {
            $filter: { input: list, as: 'item', cond: { [mongoOps[op]]: ['$$item', safe] } }
          }
        },
        0
      ]
    };
  }

  // Find-style comparisons never match missing fields for gt/lt but `$gt` in expressions orders
  // null below everything, so ordered comparisons guard against null explicitly.
  if (op == 'in') return { $in: [{ $ifNull: [operand, null] }, safe] };
  if (op == 'nin') return { $not: [{ $in: [{ $ifNull: [operand, null] }, safe] }] };
  if (op == 'eq' || op == 'ne')
    return { [mongoOps[op]]: [{ $ifNull: [operand, null] }, safe] };

  return {
    $and: [{ $ne: [{ $ifNull: [operand, null] }, null] }, { [mongoOps[op]]: [operand, safe] }]
  };
};

export let toExpression = (predicate: Predicate, base = '$'): unknown => {
  switch (predicate.t) {
    case 'and':
      return { $and: predicate.items.map(item => toExpression(item, base)) };
    case 'or':
      return { $or: predicate.items.map(item => toExpression(item, base)) };
    case 'not':
      return { $not: [toExpression(predicate.item, base)] };
    case 'const':
      return predicate.value;
    case 'cmp':
      return compareExpression(
        predicate.op,
        predicate.value,
        fieldRef(predicate.path, base),
        predicate.array
      );
    case 'null':
      return predicate.array
        ? { $eq: [{ $size: { $ifNull: [fieldRef(predicate.path, base), []] } }, 0] }
        : { $eq: [{ $ifNull: [fieldRef(predicate.path, base), null] }, null] };
    case 'regex': {
      let matches = (input: unknown) => ({
        $or: predicate.patterns.map(regex => ({
          $regexMatch: { input: { $toString: input }, regex, options: 'i' }
        }))
      });

      if (!predicate.array) {
        return {
          $and: [
            { $eq: [{ $type: fieldRef(predicate.path, base) }, 'string'] },
            matches(fieldRef(predicate.path, base))
          ]
        };
      }

      return {
        $gt: [
          {
            $size: {
              $filter: {
                input: { $ifNull: [fieldRef(predicate.path, base), []] },
                as: 'item',
                cond: matches('$$item')
              }
            }
          },
          0
        ]
      };
    }
    case 'all':
      return {
        $setIsSubset: [
          literal(predicate.values),
          { $ifNull: [fieldRef(predicate.path, base), []] }
        ]
      };
    case 'elem':
      return {
        $gt: [
          {
            $size: {
              $filter: {
                input: { $ifNull: [fieldRef(predicate.path, base), []] },
                as: 'elem',
                cond: toExpression(predicate.item, '$$elem.')
              }
            }
          },
          0
        ]
      };
    case 'cyclic':
      return compareExpression(
        predicate.op,
        predicate.value,
        cyclicExpression({ ...predicate, base })
      );
  }
};

export let predicatePaths = (predicate: Predicate): string[] => {
  switch (predicate.t) {
    case 'and':
    case 'or':
      return predicate.items.flatMap(predicatePaths);
    case 'not':
      return predicatePaths(predicate.item);
    case 'const':
      return [];
    case 'cyclic':
      return [predicate.path, ...(predicate.dailyPath ? [predicate.dailyPath] : [])];
    default:
      return [predicate.path];
  }
};
