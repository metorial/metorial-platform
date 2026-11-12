import type { NormalizedRecord } from '@metorial/groundstation-spec';
import type { RecordDraft, RecordSource } from '../records/draft';
import type {
  OtlpLogRecord,
  OtlpMetricPoint,
  OtlpResource,
  OtlpScope,
  OtlpSpan
} from '../otlp/model';
import type { FieldReader } from './fields';

export type Mapped = { source: RecordSource; draft: RecordDraft };

export type OtlpSignal = 'logs' | 'metrics' | 'traces';

export type OtlpGroupContext = {
  signal: OtlpSignal;
  resource: OtlpResource;
  scope: OtlpScope;
  resourceFields: FieldReader;
  resourceFingerprint: string;
  serviceName: string | undefined;
  sampleName: string | undefined;
};

export type OtlpDialect = {
  id: string;
  adapter: string;
  client: string;

  matches: (context: OtlpGroupContext) => boolean;

  mapLog?: (context: OtlpGroupContext, log: OtlpLogRecord) => Mapped[];
  mapMetric?: (context: OtlpGroupContext, point: OtlpMetricPoint) => Mapped[];
  mapSpan?: (context: OtlpGroupContext, span: OtlpSpan) => Mapped[];
};

export type HookContext = {
  identityHint: string;
  occurredAt?: Date | null;
};

export type HookDialect = {
  id: string;
  adapter: string;
  client: string;

  map: (context: HookContext, payload: Record<string, unknown>) => Mapped[];
};

export type DialectManifest = {
  client: string;
  channel: NormalizedRecord['source']['channel'];
  dialect: string;
  minVersion?: string;
  maxVersion?: string;
};
