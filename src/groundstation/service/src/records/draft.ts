import type {
  ExtraValue,
  IngestChannel,
  NormalizedRecord,
  RecordKind,
  RecordRole
} from '@metorial/groundstation-spec';
import type { ContentInput } from '../content/engine';

export type RecordSource = {
  adapter: string;
  dialect: string;
  channel: IngestChannel;
};

export type RecordDraft = {
  kind: RecordKind;
  type: string;
  identity: string;

  signalName?: string;
  role?: RecordRole;
  factKey?: string | null;
  nativeVersion?: string;

  occurredAt?: Date | null;
  durationMs?: number;

  client: NormalizedRecord['client'];
  actor?: NormalizedRecord['actor'];
  workspace?: NormalizedRecord['workspace'];

  ctx?: {
    sessionId?: string;
    parentSessionId?: string;
    previousSessionId?: string;
    turnId?: string;
    requestId?: string;
    generationId?: string;
    toolCallId?: string;
    agent?: { id?: string; parentId?: string };
    trace?: { traceId?: string; spanId?: string; parentSpanId?: string };
  };

  data?: Record<string, unknown>;
  content?: ContentInput[];
  extras?: Record<string, unknown>;

  coerced?: string[];
  derived?: string[];
  dropped?: string[];
  warnings?: string[];
};

export type { ExtraValue };
