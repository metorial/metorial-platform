import type {
  OtlpAttributes,
  OtlpGroup,
  OtlpLogRecord,
  OtlpSpan
} from '@mtsrc/agent-tracking-otlp';
import { isOtlpContextAttribute } from '../context';
import type {
  FilteredMetricPoint,
  OtlpDialect,
  OtlpItemView,
  OtlpPolicy,
  OtlpSignal
} from '../types';
import { gitParameterKeys, parseToolParameters } from '../vcs';

let mcpPrefix = 'mcp__';

let gitKeys = new Set<string>(gitParameterKeys);

export let redactedMcpTool = 'mcp_tool';

export let redactedMcpNamespace = 'mcp';

export type AttributeValue = OtlpAttributes[string];

export let isMcpName = (value: unknown) =>
  typeof value == 'string' && value.startsWith(mcpPrefix);

export let isContent = (key: string, base: string) =>
  key == base || key == `${base}_truncated` || key == `${base}_original_length`;

export let rewrite = (
  attributes: OtlpAttributes,
  edit: (key: string, value: AttributeValue) => AttributeValue | undefined,
  added: OtlpAttributes = {}
): OtlpAttributes => {
  let next: OtlpAttributes = Object.create(null);

  for (let [key, value] of Object.entries(attributes)) {
    let edited = edit(key, value);
    if (edited !== undefined) next[key] = edited;
  }

  for (let [key, value] of Object.entries(added)) {
    if (!(key in next)) next[key] = value;
  }

  return next;
};

let withoutGitParameters = (value: AttributeValue): AttributeValue | undefined => {
  let parameters = parseToolParameters(value);

  if (!parameters) {
    let text = typeof value == 'string' ? value : '';
    return gitParameterKeys.some(key => text.includes(key)) ? undefined : value;
  }

  if (!gitParameterKeys.some(key => key in parameters)) return value;

  let kept = Object.fromEntries(
    Object.entries(parameters).filter(([key]) => !gitKeys.has(key))
  );

  return typeof value == 'string' ? JSON.stringify(kept) : (kept as AttributeValue);
};

let withoutSessionContext = (attributes: OtlpAttributes): OtlpAttributes =>
  rewrite(attributes, (key, value) => {
    if (isOtlpContextAttribute(key) || gitKeys.has(key)) return undefined;
    if (key == 'tool_parameters') return withoutGitParameters(value);

    return value;
  });

type ItemFilter = (name: string, attributes: OtlpAttributes) => OtlpItemView;

let filterLog = (filter: ItemFilter, log: OtlpLogRecord, dialect: OtlpDialect) => ({
  ...log,
  attributes: filter(dialect.logName?.(log) ?? log.eventName, log.attributes).attributes
});

// Metric identities hash the attributes as received, so points that differ only in what was
// dropped stay separate records instead of replacing each other.
let filterMetric = (filter: ItemFilter, point: FilteredMetricPoint): FilteredMetricPoint => ({
  ...point,
  attributes: filter(point.name, point.attributes).attributes,
  identityAttributes: point.identityAttributes ?? point.attributes
});

let filterSpan = (filter: ItemFilter, span: OtlpSpan): OtlpSpan => {
  let filtered = filter(span.name, span.attributes);

  return {
    ...span,
    name: filtered.name,
    attributes: filtered.attributes,
    events: span.events.map(event => {
      let named = event.attributes['event.name'];

      return {
        ...event,
        attributes: filter(typeof named == 'string' ? named : event.name, event.attributes)
          .attributes
      };
    })
  };
};

let filters = {
  logs: filterLog,
  metrics: filterMetric,
  traces: filterSpan
} as const;

export let withOtlpPolicy = <T>(
  signal: OtlpSignal,
  dialect: OtlpDialect,
  group: OtlpGroup<T>,
  policy: OtlpPolicy
): OtlpGroup<T> => {
  let toolDetails = policy.toolDetails ? undefined : dialect.withoutToolDetails;
  if (!toolDetails && policy.sessionContext) return group;

  let filter: ItemFilter = (name, attributes) => {
    let item = toolDetails ? toolDetails({ name, attributes }) : { name, attributes };

    return policy.sessionContext
      ? item
      : { ...item, attributes: withoutSessionContext(item.attributes) };
  };

  let filterItem = filters[signal] as unknown as (
    filter: ItemFilter,
    item: T,
    dialect: OtlpDialect
  ) => T;

  return {
    ...group,
    resource: policy.sessionContext
      ? group.resource
      : { ...group.resource, attributes: withoutSessionContext(group.resource.attributes) },
    items: group.items.map(item => filterItem(filter, item, dialect))
  };
};
