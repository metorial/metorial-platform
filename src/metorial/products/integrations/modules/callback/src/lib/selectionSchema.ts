import z from 'zod';
import { changedTriggerGroupKeys } from './callbackInstanceGeneration';
import { rejectTriggerGroupSelections as reject } from './triggerGroupSelections';

let compile = (selectionSchema: Record<string, any>) => {
  try {
    return z.fromJSONSchema({ type: 'object', ...selectionSchema } as any);
  } catch {
    return null;
  }
};

// Instances report their trigger groups once synced; until then only the hub validates.
export let assertSelectionsMatchTriggerGroups = (
  selections: PrismaJson.TriggerGroupSelections,
  instances: { selectableTriggerGroups: PrismaJson.SelectableTriggerGroups | null }[],
  stored?: PrismaJson.TriggerGroupSelections | null
) => {
  let reported = instances.flatMap(instance =>
    instance.selectableTriggerGroups ? [instance.selectableTriggerGroups] : []
  );
  if (!reported.length) return;

  let groups = new Map(reported.flat().map(group => [group.key, group]));
  let changed = new Set(changedTriggerGroupKeys(stored, selections));

  for (let [key, selection] of Object.entries(selections)) {
    let group = groups.get(key);
    if (!group) {
      // A stored selection whose group is gone stays until it is removed.
      if (!changed.has(key)) continue;
      return reject(`Unknown trigger group: ${key}`);
    }

    // A schema zod cannot compile is left to the hub, which validates every selection again.
    let result = compile(group.selectionSchema)?.safeParse(selection);
    if (result && !result.success) {
      let issue = result.error.issues[0]!;
      reject(`${[key, ...issue.path.map(String)].join('.')}: ${issue.message}`);
    }
  }
};
