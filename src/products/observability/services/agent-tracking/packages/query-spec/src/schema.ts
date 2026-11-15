import {
  aggregateFns,
  datasetNames,
  derivedFormats,
  filterOps,
  queryLanguageVersion,
  queryLimits,
  queryModes,
  rangePresets
} from './types';

type JsonSchema = Record<string, unknown>;

let strict = (
  properties: Record<string, JsonSchema>,
  required: string[] = []
): JsonSchema => ({
  type: 'object',
  additionalProperties: false,
  properties,
  ...(required.length ? { required } : {})
});

let name = (description?: string, values?: string[]): JsonSchema => ({
  type: 'string',
  minLength: 1,
  maxLength: 128,
  ...(values?.length ? { enum: values } : {}),
  ...(description ? { description } : {})
});

export type QuerySchemaOptions = {
  fields?: string[];
  measures?: string[];
};

// The JSON Schema of `atq/0`. Catalog field and metric names can be passed in so the schema of one
// dataset enumerates them; semantic checks (types, ops per field, having names) stay in the binder.
export let querySchema = (options: QuerySchemaOptions = {}): JsonSchema => {
  let field = name('A catalog field.', options.fields);
  let filterValue: JsonSchema = {
    oneOf: [{ type: 'string', maxLength: 512 }, { type: 'number' }, { type: 'boolean' }]
  };

  let range: JsonSchema = {
    oneOf: [
      strict(
        {
          from: { type: 'string', description: 'ISO 8601, inclusive' },
          to: { type: 'string', description: 'ISO 8601, exclusive' }
        },
        ['from', 'to']
      ),
      strict({ last: { type: 'string', pattern: '^[0-9]{1,4}(m|h|d|w|mo|y)$' } }, ['last']),
      strict({ preset: { enum: [...rangePresets] } }, ['preset'])
    ]
  };

  let leaf = strict(
    {
      field,
      op: { enum: [...filterOps] },
      value: {
        oneOf: [
          filterValue,
          { type: 'array', items: filterValue, maxItems: queryLimits.listValues }
        ]
      }
    },
    ['field', 'op']
  );

  let filterRef = { $ref: '#/$defs/filter' };
  let exprRef = { $ref: '#/$defs/expr' };

  let expr: JsonSchema = {
    oneOf: [
      { type: 'number' },
      name('A measure or derived name.'),
      ...(['add', 'mul', 'min', 'max', 'coalesce'] as const).map(key =>
        strict({ [key]: { type: 'array', items: exprRef, minItems: 1, maxItems: 20 } }, [key])
      ),
      ...(['sub', 'div'] as const).map(key =>
        strict({ [key]: { type: 'array', items: exprRef, minItems: 2, maxItems: 2 } }, [key])
      ),
      strict({ abs: exprRef }, ['abs']),
      strict(
        {
          round: {
            type: 'array',
            prefixItems: [exprRef, { type: 'integer', minimum: 0, maximum: 9 }],
            minItems: 2,
            maxItems: 2
          }
        },
        ['round']
      ),
      ...(['shareOfTotal', 'cumulative', 'rank'] as const).map(key =>
        strict({ [key]: name() }, [key])
      ),
      strict(
        {
          shareWithin: {
            type: 'array',
            prefixItems: [name(), name()],
            minItems: 2,
            maxItems: 2
          }
        },
        ['shareWithin']
      ),
      strict(
        {
          movingAvg: {
            type: 'array',
            prefixItems: [name(), { type: 'integer', minimum: 2, maximum: 366 }],
            minItems: 2,
            maxItems: 2
          }
        },
        ['movingAvg']
      )
    ]
  };

  let measure: JsonSchema = {
    oneOf: [
      name('A named metric.', options.measures),
      strict(
        {
          fn: { enum: [...aggregateFns] },
          field,
          q: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 1 },
          where: filterRef,
          as: name()
        },
        ['fn']
      )
    ]
  };

  let dimension: JsonSchema = {
    oneOf: [
      field,
      strict(
        {
          field,
          as: name(),
          bins: {
            type: 'array',
            items: { type: 'number' },
            minItems: 1,
            maxItems: queryLimits.bins
          },
          level: { oneOf: [{ type: 'integer', minimum: 0, maximum: 10 }, { const: 'all' }] },
          missing: { enum: ['null', 'exclude'] }
        },
        ['field']
      )
    ]
  };

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://metorial.com/schemas/agent-tracking/atq-0.json',
    title: 'atq/0',
    ...strict(
      {
        atq: { const: queryLanguageVersion },
        dataset: { enum: [...datasetNames] },
        mode: { enum: [...queryModes] },
        range,
        timeZone: { type: 'string', description: 'IANA time zone, default UTC' },
        where: filterRef,
        dimensions: { type: 'array', items: dimension, maxItems: queryLimits.dimensions },
        measures: { type: 'array', items: measure, maxItems: queryLimits.measures },
        derived: {
          type: 'array',
          maxItems: queryLimits.derived,
          items: strict({ as: name(), expr: exprRef, format: { enum: [...derivedFormats] } }, [
            'as',
            'expr'
          ])
        },
        having: filterRef,
        select: { type: 'array', items: field, minItems: 1, maxItems: queryLimits.select },
        orderBy: {
          type: 'array',
          maxItems: queryLimits.orderBy,
          items: strict({ by: name(), direction: { enum: ['asc', 'desc'] } }, ['by'])
        },
        limit: { type: 'integer', minimum: 1, maximum: queryLimits.maxLimit },
        cursor: { type: 'string', maxLength: 2048 },
        allocation: { enum: ['full', 'split'] },
        compare: {
          oneOf: [
            strict({ previous: { enum: ['period', 'year'] } }, ['previous']),
            strict({ range }, ['range'])
          ]
        },
        totals: { type: 'boolean' },
        other: { type: 'boolean' },
        fill: strict({ time: { enum: ['zero', 'null'] }, groups: { type: 'boolean' } }),
        labels: { type: 'boolean' },
        strict: { type: 'boolean' }
      },
      ['atq', 'dataset', 'range']
    ),
    $defs: {
      filter: {
        oneOf: [
          strict({ and: { type: 'array', items: filterRef, minItems: 1 } }, ['and']),
          strict({ or: { type: 'array', items: filterRef, minItems: 1 } }, ['or']),
          strict({ not: filterRef }, ['not']),
          leaf
        ]
      },
      expr
    }
  };
};
