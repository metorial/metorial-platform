import type { ResolvedField } from '../catalog';
import { hourDimensions } from './codegen';
import type { AggregateMeasure, BoundMeasure, BoundQuery } from './types';

export let usersMeasureName = '$users';

export type ReportedMeasure = Extract<BoundMeasure, { kind: 'reported' }>;

export type QueryPlan = {
  aggregates: AggregateMeasure[];
  reported: ReportedMeasure[];
  totalsScan: boolean;
  mappingTables: boolean;
  excludeDaily: boolean;
  dailyCheck: boolean;
  usersMeasure?: string;
};

let usersField = (query: BoundQuery): ResolvedField | undefined => {
  let field = query.dataset.fields.user;
  return field ? { ...field, name: 'user' } : undefined;
};

export let planQuery = (query: BoundQuery): QueryPlan => {
  let aggregates = query.measures.filter(
    (measure): measure is AggregateMeasure => measure.kind == 'aggregate'
  );
  let reported = query.measures.filter(
    (measure): measure is ReportedMeasure => measure.kind == 'reported'
  );

  let hasPercentile = aggregates.some(measure => measure.fn == 'percentile');
  let hasMapped = query.dimensions.some(dimension => dimension.field.source.kind == 'mapped');
  let multiValued = query.dimensions.some(dimension => dimension.field.multi);

  let usersMeasure: string | undefined;
  let users = usersField(query);
  if (query.privacy.hideIndividuals && query.dimensions.length && users) {
    usersMeasure = usersMeasureName;
    aggregates = [
      ...aggregates,
      {
        kind: 'aggregate',
        name: usersMeasure,
        hidden: true,
        fn: 'countDistinct',
        field: users,
        type: 'number'
      }
    ];
  }

  let hourly = !!query.dataset.dailyBuckets && hourDimensions(query.dimensions);

  return {
    aggregates,
    reported,
    totalsScan:
      query.totals &&
      query.dimensions.length > 0 &&
      (hasPercentile || (multiValued && query.allocation == 'full')),
    mappingTables: hasPercentile && hasMapped,
    excludeDaily: hourly,
    dailyCheck: hourly,
    ...(usersMeasure ? { usersMeasure } : {})
  };
};
