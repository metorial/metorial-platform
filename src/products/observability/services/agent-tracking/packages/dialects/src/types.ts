import type {
  NormalizedRecord,
  OrganizationDesktopSettings
} from '@mtsrc/agent-tracking-spec';
import type { RecordDraft, RecordSource } from '@mtsrc/agent-tracking-records-model';
import type {
  OtlpAttributes,
  OtlpLogRecord,
  OtlpMetricPoint,
  OtlpResource,
  OtlpScope,
  OtlpSpan
} from '@mtsrc/agent-tracking-otlp';
import type { FieldReader } from './fields';

export type Mapped = { source: RecordSource; draft: RecordDraft };

export type OtlpSignal = 'logs' | 'metrics' | 'traces';

export type IngestPolicy = Required<OrganizationDesktopSettings>;

export type OtlpPolicy = Pick<IngestPolicy, 'toolDetails' | 'sessionContext'>;

export type OtlpItemView = { name: string; attributes: OtlpAttributes };

export type FilteredMetricPoint = OtlpMetricPoint & { identityAttributes?: OtlpAttributes };

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

  logName?: (log: OtlpLogRecord) => string;
  withoutToolDetails?: (item: OtlpItemView) => OtlpItemView;
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

export type BulkContext = HookContext & {
  client: string;
  clientVersion?: string;
  observedAt?: Date | null;
  policy: IngestPolicy;
};

export type PayloadCheck = (
  payload: Record<string, unknown>
) =>
  | { success: true; value: object }
  | { success: false; errors: { code: string; path?: string[] }[] };

export type BulkItemDialect = {
  id: string;
  adapter: string;

  check?: PayloadCheck;
  map: (context: BulkContext, payload: Record<string, unknown>) => Mapped[];
};

export type DialectManifest = {
  client: string;
  channel: NormalizedRecord['source']['channel'];
  dialect: string;
  handler: BulkItemDialect;
  minVersion?: string;
  maxVersion?: string;
  requires?: keyof IngestPolicy;
  backfillOnly?: boolean;
  deviceOnly?: boolean;
  notOnDevice?: boolean;
};
