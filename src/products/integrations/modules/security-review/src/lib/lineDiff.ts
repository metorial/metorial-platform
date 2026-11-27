let MAX_MATRIX_CELLS = 4_000_000;
let CONTEXT_LINES = 2;

type Op = { type: 'keep' | 'add' | 'remove'; line: string };

let diffOps = (before: string[], after: string[]): Op[] | null => {
  if (before.length * after.length > MAX_MATRIX_CELLS) return null;

  let width = after.length + 1;
  let lengths = new Uint32Array((before.length + 1) * width);

  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lengths[i * width + j] =
        before[i] == after[j]
          ? lengths[(i + 1) * width + j + 1]! + 1
          : Math.max(lengths[(i + 1) * width + j]!, lengths[i * width + j + 1]!);
    }
  }

  let ops: Op[] = [];
  let i = 0;
  let j = 0;

  while (i < before.length && j < after.length) {
    if (before[i] == after[j]) {
      ops.push({ type: 'keep', line: before[i]! });
      i++;
      j++;
    } else if (lengths[(i + 1) * width + j]! >= lengths[i * width + j + 1]!) {
      ops.push({ type: 'remove', line: before[i++]! });
    } else {
      ops.push({ type: 'add', line: after[j++]! });
    }
  }
  while (i < before.length) ops.push({ type: 'remove', line: before[i++]! });
  while (j < after.length) ops.push({ type: 'add', line: after[j++]! });

  return ops;
};

export let unifiedLineDiff = (before: string, after: string) => {
  let ops = diffOps(before.split('\n'), after.split('\n'));
  if (!ops) return null;

  let shown = new Set<number>();
  ops.forEach((op, index) => {
    if (op.type == 'keep') return;
    for (
      let near = Math.max(0, index - CONTEXT_LINES);
      near <= Math.min(ops.length - 1, index + CONTEXT_LINES);
      near++
    ) {
      shown.add(near);
    }
  });

  let lines: string[] = [];
  let previousShown = -1;

  ops.forEach((op, index) => {
    if (!shown.has(index)) return;
    if (previousShown != -1 && index - previousShown > 1) lines.push('...');
    previousShown = index;

    lines.push(`${op.type == 'add' ? '+' : op.type == 'remove' ? '-' : ' '}${op.line}`);
  });

  return lines.join('\n');
};
