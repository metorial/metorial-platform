import { type ValidationModifier, v } from '@lowerdeck/validation';
import { toServiceFamily } from '@metorial/module-agent-tracking-sync';
import { clientOf } from './catalog';
import { unknownMemberKey } from './members';
import type {
  AgentTrackingFilterValue,
  AgentTrackingMember,
  AgentTrackingProvider,
  AgentTrackingRepository,
  FilterField
} from './types';

export let maxFilterValueLength = 200;

export let maxNameFilterValueLength = 512;

export let maxFilterValues = 100;

export let filterValueValidator = (
  d: { maxLength?: number; modifiers?: ValidationModifier<string>[] } = {}
) =>
  v.string({
    modifiers: [
      v.minLength(1),
      v.maxLength(d.maxLength ?? maxFilterValueLength),
      ...(d.modifiers ?? [])
    ]
  });

export let filterValueList = (
  opts: { name?: string; description?: string; examples?: string[][] } = {},
  value = filterValueValidator()
) => v.array(value, { ...opts, modifiers: [v.maxLength(maxFilterValues)] });

export let nameFilterValueValidator = () =>
  filterValueValidator({ maxLength: maxNameFilterValueLength });

export let ticketFilterValueValidator = () =>
  filterValueValidator({
    modifiers: [
      v.regex(/^[^#]/, {
        message:
          'Issue numbers such as #42 are recorded on commits only, so they cannot select sessions.'
      })
    ]
  });

export let normalizeTicketKey = (key: string) => key.trim().toUpperCase();

let valuePatterns: Record<FilterField, RegExp> = {
  member: /^aten_[A-Za-z0-9]+$/,
  model: /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:@+-]*$/,
  client: /^[a-z0-9][a-z0-9_.-]*$/i,
  seat: /^[^\u0000-\u001f]+$/,
  repository: /^aten_[A-Za-z0-9]+$/,
  branch: /^[^\u0000-\u001f\u007f]+$/,
  ticket: /^[A-Z][A-Z0-9_]{1,9}-[1-9][0-9]{0,6}$/,
  provider: /^pro_[A-Za-z0-9]+$/
};

export let isFilterValueOf = (field: FilterField, value: string) =>
  value.length <= (field == 'branch' ? maxNameFilterValueLength : maxFilterValueLength) &&
  valuePatterns[field].test(value);

export let unknownNames: Partial<Record<FilterField, string>> = {
  member: 'Unknown Member',
  model: 'Unknown Model'
};

export let unknownOption: AgentTrackingFilterValue = {
  value: unknownMemberKey,
  kind: 'unknown',
  member: null,
  model: null,
  client: null,
  repository: null,
  provider: null,
  requests: null
};

export let filterValueItem = (
  field: FilterField,
  value: string,
  d: {
    member?: AgentTrackingMember | null;
    repository?: AgentTrackingRepository | null;
    provider?: AgentTrackingProvider | null;
    name?: string | null;
    requests?: number | null;
  }
): AgentTrackingFilterValue => {
  let client = field == 'client' ? clientOf({ family: toServiceFamily(value) }) : null;

  return {
    value,
    kind: field,
    member: field == 'member' ? (d.member ?? null) : null,
    model: field == 'model' ? { id: value, name: d.name ?? null } : null,
    client: client ? { family: client.family, name: client.name } : null,
    repository: field == 'repository' ? (d.repository ?? null) : null,
    provider: field == 'provider' ? (d.provider ?? { id: value, name: null }) : null,
    requests: d.requests ?? null
  };
};
