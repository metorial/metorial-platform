import { readFields } from '../fields';
import { dateFromNanos } from '../time';
import type { Mapped, OtlpDialect, OtlpGroupContext } from '../types';
import { attributeFingerprint, otlpSource, safeNativeName } from './common';
import type { OtlpSignal } from '../types';

export let quarantineOtlpId = 'quarantine.otlp.v1';

let adapter = 'quarantine';

let unmapped = (
  context: OtlpGroupContext,
  signal: OtlpSignal,
  name: string,
  time: bigint,
  attributes: Record<string, unknown>
): Mapped[] => {
  let safeName = safeNativeName(name);

  return [
    {
      source: otlpSource(adapter, quarantineOtlpId, signal),
      draft: {
        kind: 'event',
        type: 'unmapped',
        identity: [
          signal,
          name,
          String(time),
          context.resourceFingerprint,
          attributeFingerprint(attributes as never)
        ].join('|'),
        signalName: safeName,
        occurredAt: dateFromNanos(time),
        client: { family: 'unknown' },
        ctx: {},
        data: { native_name: safeName, category: 'unknown' },
        coerced: readFields(attributes, '').coerced
      }
    }
  ];
};

export let quarantineOtlp: OtlpDialect = {
  id: quarantineOtlpId,
  adapter,
  client: 'unknown',

  matches: () => true,

  mapLog: (context, log) =>
    unmapped(
      context,
      'logs',
      typeof log.body == 'string' && log.body ? log.body : log.eventName,
      log.timeNs,
      log.attributes
    ),

  mapMetric: (context, point) =>
    unmapped(context, 'metrics', point.name, point.timeNs, point.attributes),

  mapSpan: (context, span) =>
    unmapped(context, 'traces', span.name, span.startNs, span.attributes)
};
