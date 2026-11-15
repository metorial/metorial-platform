import type { NormalizedRecord } from '@mtsrc/agent-tracking-spec';
import type {
  OtlpAttributes,
  OtlpGroup,
  OtlpLogRecord,
  OtlpResource,
  OtlpScope
} from '@mtsrc/agent-tracking-otlp';
import type { RecordSource } from '@mtsrc/agent-tracking-records-model';
import { safeLabel } from '@mtsrc/agent-tracking-records-model';
import { readFields, type FieldReader } from '../fields';
import type { OtlpGroupContext, OtlpSignal } from '../types';

let maxFingerprintValueLength = 512;

export let attributeFingerprint = (attributes: OtlpAttributes): string => {
  let keys = Object.keys(attributes).sort();
  let parts: string[] = [];

  for (let key of keys) {
    let value = attributes[key];

    let text =
      typeof value == 'string'
        ? value
        : value !== null && typeof value == 'object'
          ? JSON.stringify(value)
          : String(value);

    let bounded =
      text.length > maxFingerprintValueLength
        ? text.slice(0, maxFingerprintValueLength) + text.length
        : text;

    parts.push(`${JSON.stringify(key)}=${JSON.stringify(bounded)}`);
  }

  return parts.join('\u0001');
};

export let buildGroupContext = (
  signal: OtlpSignal,
  resource: OtlpResource,
  scope: OtlpScope,
  sampleName?: string
): OtlpGroupContext => {
  let resourceFields = readFields(resource.attributes, 'resource.');

  return {
    signal,
    resource,
    scope,
    resourceFields,
    resourceFingerprint: attributeFingerprint(resource.attributes),
    serviceName: resourceFields.str('service.name'),
    sampleName
  };
};

let sampleNameOf = (signal: OtlpSignal, item: unknown): string | undefined => {
  if (!item || typeof item != 'object') return undefined;

  if (signal == 'logs') {
    let log = item as OtlpLogRecord;

    if (typeof log.body == 'string') return log.body.slice(0, 128);

    return log.eventName || undefined;
  }

  let named = item as { name?: unknown };

  return typeof named.name == 'string' ? named.name.slice(0, 128) : undefined;
};

export let groupContext = <T>(signal: OtlpSignal, group: OtlpGroup<T>) =>
  buildGroupContext(signal, group.resource, group.scope, sampleNameOf(signal, group.items[0]));

export let otlpChannel = (signal: OtlpSignal): NormalizedRecord['source']['channel'] =>
  signal == 'logs' ? 'otlp.logs' : signal == 'metrics' ? 'otlp.metrics' : 'otlp.traces';

export let otlpSource = (
  adapter: string,
  dialect: string,
  signal: OtlpSignal
): RecordSource => ({ adapter, dialect, channel: otlpChannel(signal) });

let surfaces = new Set([
  'cli',
  'ide',
  'desktop',
  'web',
  'cloud',
  'sdk',
  'app_server',
  'daemon'
]);

export let surfaceFromLabel = (raw: string | undefined): string | undefined => {
  if (!raw) return undefined;

  let lowered = raw.toLowerCase();

  if (surfaces.has(lowered)) return lowered;
  if (lowered.includes('vscode') || lowered.includes('jetbrains') || lowered.includes('ide')) {
    return 'ide';
  }
  if (lowered.includes('sdk')) return 'sdk';
  if (lowered.includes('desktop') || lowered.includes('cowork')) return 'desktop';
  if (lowered.includes('app-server') || lowered.includes('app_server')) return 'app_server';
  if (lowered.includes('cli') || lowered.includes('exec') || lowered.includes('tui')) {
    return 'cli';
  }

  return undefined;
};

export let clientVersionOf = (resource: FieldReader, attributes?: FieldReader) =>
  safeLabel(
    attributes?.str('app.version') ?? resource.str('service.version', 'app.version'),
    ''
  ) || undefined;

export let terminalOf = (attributes: FieldReader) => {
  let terminal = attributes.str('terminal.type');

  return terminal && terminal.length <= 64 ? terminal : undefined;
};

export let actorOf = (
  attributes: FieldReader,
  resource: FieldReader
): NormalizedRecord['actor'] | undefined => {
  let fromAttributes = {
    id: attributes.str('user.id', 'user.account_id'),
    email: attributes.str('user.email'),
    org: attributes.str('organization.id')
  };

  let fromResource = {
    id: resource.str('user.id', 'user.account_id'),
    email: resource.str('user.email'),
    org: resource.str('organization.id')
  };

  let id = fromAttributes.id ?? fromResource.id;
  let email = fromAttributes.email ?? fromResource.email;
  let org = fromAttributes.org ?? fromResource.org;

  if (!id && !email && !org) return undefined;

  let claimed = fromAttributes.id || fromAttributes.email || fromAttributes.org;

  return {
    ...(id || email ? { user: { ...(id ? { id } : {}), ...(email ? { email } : {}) } } : {}),
    ...(org ? { org_claim: org } : {}),
    identity_source: claimed ? 'client_claim' : 'resource_attribute'
  };
};

export let traceOf = (ids: { traceId: string; spanId: string; parentSpanId?: string }) =>
  ids.traceId || ids.spanId
    ? {
        ...(ids.traceId ? { traceId: ids.traceId } : {}),
        ...(ids.spanId ? { spanId: ids.spanId } : {}),
        ...(ids.parentSpanId ? { parentSpanId: ids.parentSpanId } : {})
      }
    : undefined;

export let stripPrefix = (value: string, prefix: string) =>
  value.startsWith(prefix) ? value.slice(prefix.length) : value;

let maxLabelLength = 128;

export let clampLabel = (
  value: string | undefined,
  max = maxLabelLength
): string | undefined => {
  if (value === undefined) return undefined;

  let cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleaned) return undefined;

  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
};

let nativeNamePattern = /^[A-Za-z0-9_.:-]{1,64}$/;

export let safeNativeName = (value: string | undefined): string =>
  value !== undefined && nativeNamePattern.test(value) ? value : 'unknown';
