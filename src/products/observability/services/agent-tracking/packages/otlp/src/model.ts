export type OtlpValue =
  string | number | boolean | null | OtlpValue[] | { [key: string]: OtlpValue };

export type OtlpAttributes = Record<string, OtlpValue>;

export type OtlpResource = { attributes: OtlpAttributes };

export type OtlpScope = { name: string; version: string; attributes: OtlpAttributes };

export type OtlpLogRecord = {
  timeNs: bigint;
  observedTimeNs: bigint;
  severityNumber: number;
  severityText: string;
  eventName: string;
  body: OtlpValue;
  attributes: OtlpAttributes;
  traceId: string;
  spanId: string;
};

export type OtlpSpanEvent = { timeNs: bigint; name: string; attributes: OtlpAttributes };

export type OtlpSpan = {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  name: string;
  kind: number;
  startNs: bigint;
  endNs: bigint;
  attributes: OtlpAttributes;
  events: OtlpSpanEvent[];
  statusCode: number;
  statusMessage: string;
};

export type OtlpTemporality = 'delta' | 'cumulative' | 'unspecified';

export type OtlpMetricPoint = {
  name: string;
  unit: string;
  shape: 'sum' | 'gauge' | 'histogram' | 'exponential_histogram' | 'summary';
  temporality: OtlpTemporality;
  monotonic: boolean;
  startNs: bigint;
  timeNs: bigint;
  attributes: OtlpAttributes;
  value: number | null;
  histogram?: { count: number; sum?: number; min?: number; max?: number };
};

export type OtlpGroup<T> = {
  resource: OtlpResource;
  scope: OtlpScope;
  items: T[];
};

export type OtlpDecoded<T> = {
  groups: OtlpGroup<T>[];
  itemCount: number;
  malformed: number;
};

export type OtlpSignalItem = {
  logs: OtlpLogRecord;
  metrics: OtlpMetricPoint;
  traces: OtlpSpan;
};

export let otlpLimits = {
  maxItems: 20_000,
  maxAttributesPerItem: 256,
  maxDepth: 16,
  maxArrayLength: 256
};

export class OtlpDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OtlpDecodeError';
  }
}
