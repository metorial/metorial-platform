import type { PickerSelection } from './types';

export let submitEach = async <V>(
  selected: PickerSelection<V>[],
  submitOne: (selection: PickerSelection<V>) => Promise<boolean>,
  opts?: { concurrency?: number }
) => {
  let concurrency = Math.max(1, opts?.concurrency ?? 1);
  let failed: string[] = [];
  let queue = [...selected];

  let worker = async () => {
    for (let selection = queue.shift(); selection; selection = queue.shift()) {
      let ok = await submitOne(selection).catch(() => false);
      if (!ok) failed.push(selection.item.key);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, worker));

  return { failed };
};
