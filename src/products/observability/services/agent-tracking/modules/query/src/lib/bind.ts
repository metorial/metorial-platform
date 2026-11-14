import {
  type Dimension,
  exprReferences,
  type Filter,
  type FilterOp,
  type FilterValue,
  formatInZone,
  isValidTimeZone,
  type Measure,
  needsTimeDimension,
  parseInstant,
  type Query,
  type QueryError,
  queryLimits,
  rangeDays,
  resolveRange,
  shiftRange,
  suggestion
} from '@mtsrc/agent-tracking-query-spec';
import {
  type CatalogContext,
  datasets,
  type DatasetDef,
  fieldNames,
  type MetricDef,
  resolveField,
  type ResolvedField
} from '../catalog';
import {
  type AccumulatorFn,
  type BoundDimension,
  type BoundFilter,
  type BoundMeasure,
  type BoundQuery,
  type PrivacySettings,
  QueryBindError,
  type QueryWarning
} from './types';

let dayMs = 24 * 60 * 60 * 1000;

let defaultRowsLimit = 100;

let percentiles: Record<string, number> = {
  p50: 0.5,
  p75: 0.75,
  p90: 0.9,
  p95: 0.95,
  p99: 0.99
};

let numericTypes = new Set(['number', 'money', 'duration']);

let orderedTypes = new Set(['number', 'money', 'duration', 'date', 'version']);

export type BindContext = {
  catalog: CatalogContext;
  now: Date;
  privacy: PrivacySettings;
};

type Ctx = {
  dataset: DatasetDef;
  catalog: CatalogContext;
  privacy: PrivacySettings;
  timeZone: string;
  errors: QueryError[];
  warnings: QueryWarning[];
};

let escapePointer = (segment: string | number) =>
  String(segment).replace(/~/g, '~0').replace(/\//g, '~1');

let pointer = (...path: (string | number)[]) =>
  path.map(segment => `/${escapePointer(segment)}`).join('');

let report = (ctx: Ctx, path: string, code: string, message: string) => {
  ctx.errors.push({ code, message, pointer: path });
};

let warn = (warnings: QueryWarning[], code: string, message: string) => {
  if (!warnings.some(warning => warning.code == code)) warnings.push({ code, message });
};

export let filterOpsFor = (field: ResolvedField): FilterOp[] => {
  let nulls: FilterOp[] = ['isNull', 'notNull'];
  let search: FilterOp[] = field.searchable ? ['contains', 'startsWith'] : [];
  let source = field.source;

  if (source.kind == 'kind' || field.array) {
    return ['eq', 'neq', 'in', 'notIn', 'any', 'all', 'none', ...nulls, ...search];
  }
  if (source.kind == 'cyclic') {
    return source.unit == 'hourOfDay'
      ? ['eq', 'neq', 'in', 'notIn', 'gt', 'gte', 'lt', 'lte', 'between']
      : ['eq', 'neq', 'in', 'notIn'];
  }
  if (field.type == 'bool') return ['eq', 'neq', ...nulls];
  if (orderedTypes.has(field.type)) {
    let ordered: FilterOp[] = [
      'eq',
      'neq',
      'in',
      'notIn',
      'gt',
      'gte',
      'lt',
      'lte',
      'between',
      ...nulls
    ];
    if (field.type == 'version') ordered.push(...search);

    return ordered;
  }

  return ['eq', 'neq', 'in', 'notIn', ...nulls, ...search];
};

let valueKind = (field: ResolvedField) => {
  if (field.source.kind == 'cyclic' && field.source.unit == 'hourOfDay') return 'number';
  if (numericTypes.has(field.type)) return 'number';
  if (field.type == 'bool') return 'boolean';
  if (field.type == 'date') return 'date';

  return 'string';
};

let checkValue = (
  ctx: Ctx,
  field: ResolvedField,
  op: FilterOp,
  value: FilterValue,
  path: string
) => {
  let kind = valueKind(field);

  if (op == 'contains' || op == 'startsWith') {
    if (typeof value != 'string' || !value)
      report(ctx, path, 'invalid_value', 'Expected a non-empty string.');
    return;
  }

  if (kind == 'date') {
    if (
      typeof value != 'string' ||
      Number.isNaN(parseInstant(value, ctx.timeZone).getTime())
    ) {
      report(ctx, path, 'invalid_value', 'Expected an ISO 8601 date.');
    }
    return;
  }

  if (typeof value != kind) {
    report(ctx, path, 'invalid_value', `Expected a ${kind}, got ${JSON.stringify(value)}.`);
    return;
  }

  if (
    field.type == 'enum' &&
    field.enumValues &&
    !field.enumValues.includes(value as string)
  ) {
    report(
      ctx,
      path,
      'invalid_value',
      `"${value}" is not a value of "${field.name}".${suggestion(String(value), field.enumValues)}`
    );
  }

  if (
    kind == 'number' &&
    field.source.kind == 'cyclic' &&
    ((value as number) < 0 || (value as number) > 23)
  ) {
    report(ctx, path, 'invalid_value', 'Hours of day run from 0 to 23.');
  }
};

let fieldFor = (
  ctx: Ctx,
  name: string,
  path: string,
  use: 'filter' | 'dimension' | 'select' | 'measure',
  allowPersonal = false
) => {
  let field = resolveField(ctx.dataset, name, ctx.catalog);

  if (!field) {
    report(
      ctx,
      path,
      'unknown_field',
      `Unknown field "${name}" in dataset "${ctx.dataset.name}".${suggestion(name, fieldNames(ctx.dataset, ctx.catalog))}`
    );
    return undefined;
  }

  if (ctx.privacy.hideIndividuals && field.sensitivity == 'personal' && !allowPersonal) {
    report(
      ctx,
      path,
      'personal_field',
      `"${name}" describes individuals, and this organization hides individual data.`
    );
    return undefined;
  }

  if (!field[use]) {
    report(
      ctx,
      path,
      `not_${use == 'filter' ? 'filterable' : use == 'dimension' ? 'groupable' : use == 'select' ? 'selectable' : 'measurable'}`,
      `"${name}" can't be used as a ${use}.`
    );
    return undefined;
  }

  return field;
};

let bindFilter = (ctx: Ctx, filter: Filter, path: string): BoundFilter | undefined => {
  if ('and' in filter || 'or' in filter) {
    let key = 'and' in filter ? 'and' : 'or';
    let items = ('and' in filter ? filter.and : filter.or)
      .map((item, index) => bindFilter(ctx, item, `${path}/${key}/${index}`))
      .filter((item): item is BoundFilter => !!item);

    return key == 'and' ? { and: items } : { or: items };
  }

  if ('not' in filter) {
    let item = bindFilter(ctx, filter.not, `${path}/not`);
    return item ? { not: item } : undefined;
  }

  let field = fieldFor(ctx, filter.field, `${path}/field`, 'filter');
  if (!field) return undefined;

  let ops = filterOpsFor(field);
  if (!ops.includes(filter.op)) {
    report(
      ctx,
      `${path}/op`,
      'invalid_operator',
      `"${filter.op}" isn't allowed on "${field.name}". Allowed: ${ops.join(', ')}.`
    );
    return undefined;
  }

  let values = Array.isArray(filter.value)
    ? filter.value
    : filter.value === undefined
      ? []
      : [filter.value];
  values.forEach((value, index) =>
    checkValue(
      ctx,
      field,
      filter.op,
      value,
      Array.isArray(filter.value) ? `${path}/value/${index}` : `${path}/value`
    )
  );

  if (filter.op == 'between' && (values[0] as number) > (values[1] as number)) {
    report(
      ctx,
      `${path}/value`,
      'invalid_value',
      'The lower bound must not exceed the upper bound.'
    );
  }

  return { leaf: { field, op: filter.op, value: filter.value, pointer: path } };
};

let flattenFilter = (filter: Filter): Filter => {
  if ('and' in filter) {
    return {
      and: filter.and.map(flattenFilter).flatMap(item => ('and' in item ? item.and : [item]))
    };
  }
  if ('or' in filter) {
    return {
      or: filter.or.map(flattenFilter).flatMap(item => ('or' in item ? item.or : [item]))
    };
  }
  if ('not' in filter) return { not: flattenFilter(filter.not) };

  return filter;
};

let bindDimensions = (ctx: Ctx, dimensions: Dimension[]) => {
  let bound: BoundDimension[] = [];

  dimensions.forEach((dimension, index) => {
    let spec = typeof dimension == 'string' ? { field: dimension } : dimension;
    let path =
      typeof dimension == 'string'
        ? pointer('dimensions', index)
        : pointer('dimensions', index, 'field');

    let field = resolveField(ctx.dataset, spec.field, ctx.catalog);
    let binnable = field && field.measure && numericTypes.has(field.type) && spec.bins;
    let resolved = binnable
      ? fieldFor(ctx, spec.field, path, 'measure')
      : fieldFor(ctx, spec.field, path, 'dimension');
    if (!resolved) return;

    if (spec.bins && !numericTypes.has(resolved.type) && !(resolved.source.kind == 'cyclic')) {
      report(
        ctx,
        pointer('dimensions', index, 'bins'),
        'invalid_bins',
        `"${resolved.name}" isn't numeric, so it can't be binned.`
      );
    }
    if (spec.level !== undefined && resolved.source.kind != 'kind') {
      report(
        ctx,
        pointer('dimensions', index, 'level'),
        'invalid_level',
        'Only entity kinds have levels.'
      );
    }

    bound.push({
      name: spec.as ?? spec.field,
      field: resolved,
      ...(spec.bins ? { bins: spec.bins } : {}),
      level: spec.level ?? 0,
      missing: spec.missing ?? 'null'
    });
  });

  let timeDims = bound.filter(dimension => dimension.field.source.kind == 'time');
  if (timeDims.length > 1) {
    report(
      ctx,
      '/dimensions',
      'too_many_time_dimensions',
      'Use at most one time.<unit> dimension.'
    );
  }

  let high = bound.filter(
    dimension => dimension.field.cardinality == 'high' && !dimension.bins
  );
  if (high.length > queryLimits.highCardinalityDimensions) {
    report(
      ctx,
      '/dimensions',
      'too_many_high_cardinality',
      `Use at most ${queryLimits.highCardinalityDimensions} high-cardinality dimensions (${high.map(item => item.name).join(', ')}).`
    );
  }

  return bound;
};

type MeasureState = {
  measures: BoundMeasure[];
  byName: Map<string, BoundMeasure>;
};

let addMeasure = (state: MeasureState, measure: BoundMeasure) => {
  let existing = state.byName.get(measure.name);
  if (existing) {
    if (!measure.hidden) existing.hidden = false;
    return existing;
  }

  state.measures.push(measure);
  state.byName.set(measure.name, measure);

  return measure;
};

let metricRefs = (metric: MetricDef) => {
  if (metric.kind == 'composite') return Object.values(metric.parts);
  if (metric.kind == 'derived') return exprReferences(metric.expr).measures;

  return [];
};

let ensureMetric = (
  ctx: Ctx,
  state: MeasureState,
  name: string,
  hidden: boolean,
  path: string,
  seen: Set<string> = new Set()
): BoundMeasure | undefined => {
  let existing = state.byName.get(name);
  if (existing) {
    if (!hidden) existing.hidden = false;
    return existing;
  }

  let metric = Object.hasOwn(ctx.dataset.metrics, name)
    ? ctx.dataset.metrics[name]!
    : undefined;
  if (!metric || seen.has(name)) {
    report(
      ctx,
      path,
      'unknown_metric',
      `Unknown metric "${name}" in dataset "${ctx.dataset.name}".${suggestion(name, Object.keys(ctx.dataset.metrics))}`
    );
    return undefined;
  }

  seen.add(name);
  for (let ref of metricRefs(metric)) ensureMetric(ctx, state, ref, true, path, seen);

  if (metric.kind == 'aggregate') {
    let field = metric.field
      ? resolveField(ctx.dataset, metric.field, ctx.catalog)
      : undefined;
    let where = metric.where ? bindFilter(ctx, metric.where, path) : undefined;

    return addMeasure(state, {
      kind: 'aggregate',
      name,
      hidden,
      fn: metric.fn,
      ...(field ? { field } : {}),
      ...(where ? { where } : {}),
      type: metric.type
    });
  }
  if (metric.kind == 'composite') {
    return addMeasure(state, {
      kind: 'composite',
      name,
      hidden,
      parts: metric.parts,
      total: metric.total
    });
  }
  if (metric.kind == 'reported')
    return addMeasure(state, { kind: 'reported', name, hidden, path: metric.path });

  return addMeasure(state, {
    kind: 'derived',
    name,
    hidden,
    expr: metric.expr,
    format: metric.format
  });
};

let bindMeasure = (ctx: Ctx, state: MeasureState, measure: Measure, index: number) => {
  let path = pointer('measures', index);

  if (typeof measure == 'string') {
    if (state.byName.get(measure)?.hidden === false) {
      report(ctx, path, 'duplicate_name', `"${measure}" is listed twice.`);
      return;
    }
    ensureMetric(ctx, state, measure, false, path);
    return;
  }

  let fn: AccumulatorFn =
    measure.fn in percentiles || measure.fn == 'percentile'
      ? 'percentile'
      : (measure.fn as AccumulatorFn);
  let q = measure.fn in percentiles ? percentiles[measure.fn] : measure.q;
  let name = measure.as ?? (measure.field ? `${measure.fn}(${measure.field})` : measure.fn);

  if (state.byName.get(name)?.hidden === false) {
    report(ctx, path, 'duplicate_name', `"${name}" is listed twice.`);
    return;
  }

  let field: ResolvedField | undefined;

  if (fn == 'count') {
    if (!ctx.dataset.countable) {
      report(
        ctx,
        `${path}/fn`,
        'count_not_supported',
        `"count" isn't meaningful on "${ctx.dataset.name}". Use a named metric such as "sessions" or "requests".`
      );
      return;
    }
  } else {
    field =
      fn == 'countDistinct'
        ? fieldFor(ctx, measure.field!, `${path}/field`, 'filter', true)
        : fieldFor(ctx, measure.field!, `${path}/field`, 'measure');
    if (!field) return;

    if (fn == 'countDistinct' && !field.distinct) {
      report(
        ctx,
        `${path}/field`,
        'distinct_not_supported',
        `Distinct counts aren't supported on "${field.name}".`
      );
      return;
    }
    if (fn == 'percentile' && !field.percentile) {
      report(
        ctx,
        `${path}/fn`,
        'percentile_not_supported',
        `Percentiles aren't supported on "${field.name}" in "${ctx.dataset.name}".`
      );
      return;
    }
    if ((fn == 'sum' || fn == 'avg') && !numericTypes.has(field.type)) {
      report(ctx, `${path}/fn`, 'invalid_function', `"${fn}" needs a numeric field.`);
      return;
    }
  }

  let where = measure.where ? bindFilter(ctx, measure.where, `${path}/where`) : undefined;

  addMeasure(state, {
    kind: 'aggregate',
    name,
    hidden: false,
    fn,
    ...(q !== undefined ? { q } : {}),
    ...(field ? { field } : {}),
    ...(where ? { where } : {}),
    type: fn == 'count' || fn == 'countDistinct' ? 'number' : field!.type
  });
};

let bindDerived = (
  ctx: Ctx,
  state: MeasureState,
  query: Query,
  dimensions: BoundDimension[]
) => {
  let hasTime = dimensions.some(dimension => dimension.field.source.kind == 'time');

  (query.derived ?? []).forEach((derived, index) => {
    let path = pointer('derived', index);

    if (state.byName.get(derived.as)?.hidden === false) {
      report(ctx, `${path}/as`, 'duplicate_name', `"${derived.as}" is already a column.`);
      return;
    }

    let refs = exprReferences(derived.expr);
    for (let ref of refs.measures) {
      if (!state.byName.has(ref)) ensureMetric(ctx, state, ref, true, `${path}/expr`);
    }
    for (let ref of refs.dimensions) {
      if (!dimensions.some(dimension => dimension.name == ref)) {
        report(
          ctx,
          `${path}/expr`,
          'unknown_dimension',
          `"${ref}" isn't a dimension of this query.`
        );
      }
    }
    if (needsTimeDimension(derived.expr) && !hasTime) {
      report(
        ctx,
        `${path}/expr`,
        'needs_time_dimension',
        'cumulative and movingAvg need a time.<unit> dimension.'
      );
    }

    addMeasure(state, {
      kind: 'derived',
      name: derived.as,
      hidden: false,
      expr: derived.expr,
      ...(derived.format ? { format: derived.format } : {})
    });
  });
};

let compareColumns = (name: string) => [`${name}@previous`, `${name}@delta`, `${name}@change`];

let outputNames = (state: MeasureState, compare: boolean) =>
  state.measures
    .filter(measure => !measure.hidden)
    .flatMap(measure => [measure.name, ...(compare ? compareColumns(measure.name) : [])]);

let checkHaving = (ctx: Ctx, filter: Filter, names: string[], path: string) => {
  if ('and' in filter)
    return filter.and.forEach((item, index) =>
      checkHaving(ctx, item, names, `${path}/and/${index}`)
    );
  if ('or' in filter)
    return filter.or.forEach((item, index) =>
      checkHaving(ctx, item, names, `${path}/or/${index}`)
    );
  if ('not' in filter) return checkHaving(ctx, filter.not, names, `${path}/not`);

  if (!names.includes(filter.field)) {
    report(
      ctx,
      `${path}/field`,
      'unknown_column',
      `"${filter.field}" isn't a measure of this query.${suggestion(filter.field, names)}`
    );
  }
  if (
    !['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'notNull'].includes(
      filter.op
    )
  ) {
    report(ctx, `${path}/op`, 'invalid_operator', `"${filter.op}" isn't allowed in having.`);
  }
  for (let value of Array.isArray(filter.value)
    ? filter.value
    : filter.value === undefined
      ? []
      : [filter.value]) {
    if (typeof value != 'number')
      report(ctx, `${path}/value`, 'invalid_value', 'having compares numbers.');
  }
};

let rejectKeys = (ctx: Ctx, query: Query, keys: (keyof Query)[], mode: string) => {
  for (let key of keys) {
    if (query[key] !== undefined) {
      report(ctx, `/${key}`, 'not_allowed', `"${key}" isn't allowed in ${mode} mode.`);
    }
  }
};

let rangeDaysFor = (dataset: DatasetDef, dimensions: BoundDimension[]) =>
  dimensions.some(
    dimension => dimension.field.source.kind == 'time' && dimension.field.source.unit == 'hour'
  )
    ? dataset.maxHourlyRangeDays
    : dataset.maxRangeDays;

export let bindQuery = (query: Query, context: BindContext): BoundQuery => {
  let dataset = datasets[query.dataset];
  let timeZone = query.timeZone ?? 'UTC';
  let ctx: Ctx = {
    dataset,
    catalog: context.catalog,
    privacy: context.privacy,
    timeZone,
    errors: [],
    warnings: []
  };

  if (!isValidTimeZone(timeZone)) {
    report(ctx, '/timeZone', 'invalid_time_zone', `Unknown time zone "${timeZone}".`);
    ctx.timeZone = 'UTC';
  }

  let mode = query.mode ?? 'aggregate';
  if (mode == 'rows' && !dataset.rows) {
    report(
      ctx,
      '/mode',
      'rows_not_supported',
      `Rows mode isn't available on "${dataset.name}".`
    );
  }
  if (mode == 'rows' && context.privacy.hideIndividuals) {
    report(
      ctx,
      '/mode',
      'personal_rows',
      'This organization hides individual data, so rows mode is off.'
    );
  }

  let range = resolveRange(query.range, { now: context.now, timeZone: ctx.timeZone });
  if (!(range.to > range.from)) {
    report(ctx, '/range', 'invalid_range', 'The range must end after it starts.');
  }

  let where = query.where ? bindFilter(ctx, flattenFilter(query.where), '/where') : undefined;
  let state: MeasureState = { measures: [], byName: new Map() };
  let dimensions: BoundDimension[] = [];
  let select: ResolvedField[] = [];
  let orderBy: BoundQuery['orderBy'] = [];
  let limit: number;

  if (mode == 'aggregate') {
    rejectKeys(ctx, query, ['select', 'cursor'], 'aggregate');

    dimensions = bindDimensions(ctx, query.dimensions ?? []);
    if (!query.measures?.length) {
      report(ctx, '/measures', 'required', 'Pick at least one measure.');
    }
    (query.measures ?? []).forEach((measure, index) =>
      bindMeasure(ctx, state, measure, index)
    );
    bindDerived(ctx, state, query, dimensions);

    let names = new Set<string>();
    for (let name of [
      ...dimensions.map(dimension => dimension.name),
      ...outputNames(state, false)
    ]) {
      if (names.has(name))
        report(ctx, '/dimensions', 'duplicate_name', `"${name}" is used twice.`);
      names.add(name);
    }

    let visible = state.measures.filter(measure => !measure.hidden).length;
    if (visible > queryLimits.measuresAndDerived) {
      report(
        ctx,
        '/measures',
        'too_long',
        `Use at most ${queryLimits.measuresAndDerived} measures and derived columns.`
      );
    }

    let outputs = outputNames(state, !!query.compare);
    if (query.having) checkHaving(ctx, query.having, outputs, '/having');

    let hasTime = dimensions.some(dimension => dimension.field.source.kind == 'time');
    (query.orderBy ?? []).forEach((order, index) => {
      let known =
        order.by == 'time'
          ? hasTime
          : dimensions.some(d => d.name == order.by) || outputs.includes(order.by);
      if (!known) {
        report(
          ctx,
          pointer('orderBy', index, 'by'),
          'unknown_column',
          `Can't order by "${order.by}".${suggestion(order.by, [...dimensions.map(d => d.name), ...outputs])}`
        );
      }
      let measure = state.byName.get(order.by);
      if (measure?.kind == 'composite' || measure?.kind == 'reported') {
        report(
          ctx,
          pointer('orderBy', index, 'by'),
          'not_orderable',
          `"${order.by}" isn't a single number.`
        );
      }
    });
    orderBy = (query.orderBy ?? []).map(order => ({
      by: order.by,
      direction: order.direction ?? 'desc'
    }));
    limit = query.limit ?? queryLimits.defaultLimit;

    if (query.other && !dimensions.length) {
      report(ctx, '/other', 'needs_dimension', '"other" needs at least one dimension.');
    }

    if (query.fill?.groups) {
      let grouped = dimensions.filter(dimension => dimension.field.source.kind != 'time');
      let entityBacked =
        grouped.length == 1 &&
        grouped[0]!.field.entityKind &&
        (grouped[0]!.field.source.kind == 'kind' ||
          grouped[0]!.field.source.kind == 'stored' ||
          grouped[0]!.field.source.kind == 'array');
      if (!entityBacked) {
        report(
          ctx,
          '/fill/groups',
          'fill_groups_not_supported',
          'fill.groups needs exactly one non-time dimension backed by entities.'
        );
      }
    }
    if (query.fill?.time && !hasTime) {
      report(
        ctx,
        '/fill/time',
        'needs_time_dimension',
        'fill.time needs a time.<unit> dimension.'
      );
    }
  } else {
    rejectKeys(
      ctx,
      query,
      [
        'dimensions',
        'measures',
        'derived',
        'having',
        'compare',
        'totals',
        'other',
        'fill',
        'allocation'
      ],
      'rows'
    );

    let names = query.select ?? defaultSelect(dataset, ctx);
    names.forEach((name, index) => {
      let field = fieldFor(
        ctx,
        name,
        query.select ? pointer('select', index) : '/select',
        'select'
      );
      if (field) select.push(field);
    });

    (query.orderBy ?? []).forEach((order, index) => {
      let field = fieldFor(ctx, order.by, pointer('orderBy', index, 'by'), 'filter');
      if (
        field &&
        !(
          field.source.kind == 'stored' &&
          orderedTypes.has(field.type) &&
          field.type != 'version'
        )
      ) {
        report(
          ctx,
          pointer('orderBy', index, 'by'),
          'not_orderable',
          `Rows can be ordered by stored numbers and dates only.`
        );
      }
    });
    if ((query.orderBy?.length ?? 0) > 1) {
      report(ctx, '/orderBy', 'too_long', 'Rows mode orders by one field.');
    }
    orderBy = (query.orderBy ?? []).map(order => ({
      by: order.by,
      direction: order.direction ?? 'desc'
    }));

    limit = query.limit ?? defaultRowsLimit;
    if (limit > queryLimits.maxRowsLimit) {
      report(
        ctx,
        '/limit',
        'too_large',
        `Rows mode returns at most ${queryLimits.maxRowsLimit} rows per page.`
      );
    }
  }

  let maxDays = rangeDaysFor(dataset, dimensions);
  if (rangeDays(range) > maxDays) {
    report(
      ctx,
      '/range',
      'range_too_long',
      `"${dataset.name}" ranges are limited to ${maxDays} days${maxDays == dataset.maxHourlyRangeDays && maxDays != dataset.maxRangeDays ? ' with an hour dimension' : ''}.`
    );
  }
  if (
    dataset.retentionDays &&
    range.from.getTime() < context.now.getTime() - dataset.retentionDays * dayMs
  ) {
    warn(
      ctx.warnings,
      'retention_clipped',
      `"${dataset.name}" keeps ${dataset.retentionDays} days; the range starts before that.`
    );
  }

  let compare = query.compare
    ? 'range' in query.compare
      ? resolveRange(query.compare.range, { now: context.now, timeZone: ctx.timeZone })
      : shiftRange(range, query.compare.previous, ctx.timeZone)
    : undefined;
  if (compare && !(compare.to > compare.from)) {
    report(
      ctx,
      '/compare/range',
      'invalid_range',
      'The comparison range must end after it starts.'
    );
  }

  let allocation = query.allocation ?? 'full';
  let multiValued = dimensions.some(dimension => dimension.field.multi);
  if (allocation == 'full' && multiValued) {
    warn(
      ctx.warnings,
      'full_allocation_overlap',
      'Group totals can exceed the overall total because a document can belong to several groups.'
    );
  }

  if (ctx.errors.length) throw new QueryBindError(ctx.errors);

  let canonical: Query = {
    ...query,
    mode,
    range: {
      from: formatInZone(range.from, ctx.timeZone),
      to: formatInZone(range.to, ctx.timeZone)
    },
    timeZone: ctx.timeZone,
    ...(where ? { where: flattenFilter(query.where!) } : {}),
    ...(compare
      ? {
          compare: {
            range: {
              from: formatInZone(compare.from, ctx.timeZone),
              to: formatInZone(compare.to, ctx.timeZone)
            }
          }
        }
      : {}),
    ...(mode == 'aggregate' ? { allocation } : {}),
    limit: limit!,
    labels: query.labels ?? true
  };

  return {
    canonical,
    dataset,
    mode,
    range,
    timeZone: ctx.timeZone,
    now: context.now,
    ...(where ? { where } : {}),
    dimensions,
    measures: state.measures,
    ...(query.having ? { having: query.having } : {}),
    orderBy,
    limit: limit!,
    allocation,
    ...(compare ? { compare } : {}),
    totals: query.totals ?? false,
    other: query.other ?? false,
    fill: {
      ...(query.fill?.time ? { time: query.fill.time } : {}),
      groups: query.fill?.groups ?? false
    },
    labels: query.labels ?? true,
    strict: query.strict ?? false,
    select,
    ...(query.cursor ? { cursor: query.cursor } : {}),
    privacy: context.privacy,
    warnings: ctx.warnings
  };
};

let defaultSelect = (dataset: DatasetDef, ctx: Ctx) => {
  let preferred: Record<string, string[]> = {
    sessions: [
      'session',
      'startedAt',
      'user',
      'agent',
      'client.family',
      'model',
      'duration',
      'requests',
      'cost.usd'
    ],
    requests: ['occurredAt', 'session', 'user', 'model', 'outcome', 'latency', 'tokens.total'],
    tool_calls: [
      'occurredAt',
      'session',
      'user',
      'tool.name',
      'tool.class',
      'outcome',
      'duration'
    ]
  };

  return (preferred[dataset.name] ?? []).filter(
    name => !(ctx.privacy.hideIndividuals && dataset.fields[name]?.sensitivity == 'personal')
  );
};
