import { v } from '@lowerdeck/validation';
import { toServiceFamily } from '@metorial/module-agent-tracking-sync';
import { clientOf } from './catalog';
import { unknownMemberKey } from './members';
import type { AgentTrackingFilterValue, AgentTrackingMember, FilterField } from './types';

export let maxFilterValueLength = 200;

export let maxFilterValues = 100;

export let filterValueValidator = () =>
  v.string({ modifiers: [v.minLength(1), v.maxLength(maxFilterValueLength)] });

export let filterValueList = (
  opts: { name?: string; description?: string; examples?: string[][] } = {}
) => v.array(filterValueValidator(), { ...opts, modifiers: [v.maxLength(maxFilterValues)] });

let valuePatterns: Record<FilterField, RegExp> = {
  member: /^aten_[A-Za-z0-9]+$/,
  model: /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:@+-]*$/,
  client: /^[a-z0-9][a-z0-9_.-]*$/i,
  seat: /^[^\u0000-\u001f]+$/
};

export let isFilterValueOf = (field: FilterField, value: string) =>
  value.length <= maxFilterValueLength && valuePatterns[field].test(value);

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
  requests: null
};

export let filterValueItem = (
  field: FilterField,
  value: string,
  d: { member?: AgentTrackingMember | null; name?: string | null; requests?: number | null }
): AgentTrackingFilterValue => {
  let client = field == 'client' ? clientOf({ family: toServiceFamily(value) }) : null;

  return {
    value,
    kind: field,
    member: field == 'member' ? (d.member ?? null) : null,
    model: field == 'model' ? { id: value, name: d.name ?? null } : null,
    client: client ? { family: client.family, name: client.name } : null,
    requests: d.requests ?? null
  };
};
