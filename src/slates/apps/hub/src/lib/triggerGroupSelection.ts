import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { SlatesTriggerGroup } from '@slates/proto';
import { jsonSchemaRejects, validateJsonSchema } from './validateJsonSchema';

let maxGroups = 64;
let maxKeyLength = 128;
let maxBytes = 64 * 1024;
let maxDepth = 16;

type SelectableTriggerGroup = {
  key: string;
  name: string;
  description: string | null;
  selectionSchema: Record<string, any>;
  status: 'active' | 'selection_required';
};

export let describeSelectableTriggerGroups = (
  groups: { key: string; name: string; spec: SlatesTriggerGroup }[],
  selectionRequiredKeys: Set<string>
): SelectableTriggerGroup[] =>
  groups
    .filter(group => group.spec.selectionSchema)
    .map(group => ({
      key: group.key,
      name: group.name,
      description: group.spec.description ?? null,
      selectionSchema: group.spec.selectionSchema as Record<string, any>,
      status: selectionRequiredKeys.has(group.key) ? 'selection_required' : 'active'
    }));

export let validateTriggerGroupSelections = (
  groups: SlatesTriggerGroup[],
  selections?: Record<string, Record<string, any>>
) => {
  let reject = (message: string): never => {
    throw new ServiceError(badRequestError({ message }));
  };
  let checkDepth = (value: unknown, depth: number): void => {
    if (depth > maxDepth) reject('Trigger group selections exceed the maximum nesting depth.');
    if (value && typeof value === 'object')
      for (let item of Object.values(value)) checkDepth(item, depth + 1);
  };
  checkDepth(selections ?? {}, 0);
  if (
    Object.keys(selections ?? {}).length > maxGroups ||
    Buffer.byteLength(JSON.stringify(selections ?? {})) > maxBytes
  )
    reject('Trigger group selections exceed the size limit.');

  // A selection for a group the current version no longer has (or that no longer accepts one)
  // is ignored rather than failing every group of the registration after a provider release.
  let ignoredSelectionKeys: string[] = [];
  for (let [groupId, selection] of Object.entries(selections ?? {})) {
    if (groupId.length > maxKeyLength) reject('Trigger group selection keys are too long.');
    if (!selection || typeof selection !== 'object' || Array.isArray(selection))
      reject('Each trigger group selection must be an object.');
    if (!groups.some(group => group.id === groupId && group.selectionSchema))
      ignoredSelectionKeys.push(groupId);
  }

  let normalized = new Map<string, Record<string, any>>();
  let skippedGroupIds = new Set<string>();

  for (let group of groups) {
    if (!group.selectionSchema) continue;
    let selection =
      selections && Object.hasOwn(selections, group.id) ? selections[group.id] : undefined;

    // Leaving out a selection the group needs opts out of that group. A schema that cannot be
    // compiled is a provider defect and still fails the registration below.
    if (
      selection === undefined &&
      jsonSchemaRejects({ schema: group.selectionSchema, data: {} })
    ) {
      skippedGroupIds.add(group.id);
      continue;
    }

    normalized.set(
      group.id,
      validateJsonSchema({
        schema: group.selectionSchema,
        data: selection ?? {},
        entity: 'trigger_group_selection',
        strict: true
      })
    );
  }

  return { selections: normalized, skippedGroupIds, ignoredSelectionKeys };
};
