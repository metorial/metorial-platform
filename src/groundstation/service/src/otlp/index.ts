import type { IngestPayloadType, OtlpSignal } from '@metorial/groundstation-spec';
import { decodeLogsJson, decodeMetricsJson, decodeTracesJson } from './json';
import type {
  OtlpDecoded,
  OtlpLogRecord,
  OtlpMetricPoint,
  OtlpSignalItem,
  OtlpSpan
} from './model';
import { decodeLogsProtobuf, decodeMetricsProtobuf, decodeTracesProtobuf } from './protobuf';

export * from './model';
export * from './response';

export let decodeOtlp = <S extends OtlpSignal>(
  signal: S,
  payloadType: IngestPayloadType | undefined,
  bytes: Uint8Array
): OtlpDecoded<OtlpSignalItem[S]> => {
  let json = payloadType == 'json';

  if (signal == 'logs') {
    return (json ? decodeLogsJson(bytes) : decodeLogsProtobuf(bytes)) as OtlpDecoded<
      OtlpSignalItem[S]
    >;
  }

  if (signal == 'metrics') {
    return (json ? decodeMetricsJson(bytes) : decodeMetricsProtobuf(bytes)) as OtlpDecoded<
      OtlpSignalItem[S]
    >;
  }

  return (json ? decodeTracesJson(bytes) : decodeTracesProtobuf(bytes)) as OtlpDecoded<
    OtlpSignalItem[S]
  >;
};

export type { OtlpLogRecord, OtlpMetricPoint, OtlpSpan };
