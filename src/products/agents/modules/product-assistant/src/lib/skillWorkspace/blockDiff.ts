export type BlockEditOperation =
  | { type: 'replace'; target: string; targetEnd?: string; content: string }
  | { type: 'insert_before'; target: string; content: string }
  | { type: 'insert_after'; target: string; content: string }
  | { type: 'delete'; target: string; targetEnd?: string };

export let documentStartTarget = 'doc_start';
export let documentEndTarget = 'doc_end';

let maxLcsCells = 4_000_000;

type Hunk = { oldStart: number; oldEnd: number; newStart: number; newEnd: number };

let computeHunks = (oldLines: string[], newLines: string[]): Hunk[] => {
  let prefix = 0;
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] == newLines[prefix]
  ) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] == newLines[newLines.length - 1 - suffix]
  ) {
    suffix++;
  }

  let oldEnd = oldLines.length - suffix;
  let newEnd = newLines.length - suffix;
  if (prefix == oldEnd && prefix == newEnd) return [];

  let rows = oldEnd - prefix;
  let cols = newEnd - prefix;
  if (rows == 0 || cols == 0 || rows * cols > maxLcsCells) {
    return [{ oldStart: prefix, oldEnd, newStart: prefix, newEnd }];
  }

  let table = Array.from({ length: rows + 1 }, () => new Uint32Array(cols + 1));
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      table[i]![j] =
        oldLines[prefix + i] == newLines[prefix + j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }

  let hunks: Hunk[] = [];
  let current: Hunk | null = null;
  let i = 0;
  let j = 0;

  let flush = () => {
    if (current) hunks.push(current);
    current = null;
  };

  while (i < rows || j < cols) {
    if (i < rows && j < cols && oldLines[prefix + i] == newLines[prefix + j]) {
      flush();
      i++;
      j++;
      continue;
    }

    current ??= {
      oldStart: prefix + i,
      oldEnd: prefix + i,
      newStart: prefix + j,
      newEnd: prefix + j
    };

    if (j < cols && (i == rows || table[i]![j + 1]! >= table[i + 1]![j]!)) {
      j++;
      current.newEnd = prefix + j;
    } else {
      i++;
      current.oldEnd = prefix + i;
    }
  }
  flush();

  return hunks;
};

export let diffBlocks = (d: {
  blocks: { alias: string; markdown: string }[];
  next: string;
}): BlockEditOperation[] => {
  let oldLines: string[] = [];
  let owners: number[] = [];
  let blockStarts: number[] = [];
  let blockEnds: number[] = [];

  d.blocks.forEach((block, index) => {
    if (index > 0) {
      oldLines.push('');
      owners.push(-1);
    }

    blockStarts.push(oldLines.length);
    for (let line of block.markdown.split('\n')) {
      oldLines.push(line);
      owners.push(index);
    }
    blockEnds.push(oldLines.length);
  });

  let newLines = d.next.split('\n');
  let hunks = computeHunks(oldLines, newLines);

  let blockBefore = (line: number) => {
    for (let index = line - 1; index >= 0; index--) {
      if (owners[index]! >= 0) return owners[index]!;
    }
    return -1;
  };

  type Region = { first: number; last: number; newStart: number; newEnd: number };
  type Insertion = { after: number; newStart: number; newEnd: number };

  let regions: Region[] = [];
  let insertions: Insertion[] = [];

  for (let hunk of hunks) {
    let touched = owners.slice(hunk.oldStart, hunk.oldEnd).filter(owner => owner >= 0);

    let attachedOwner = -1;
    if (hunk.oldStart == hunk.oldEnd) {
      let insertedLines = newLines.slice(hunk.newStart, hunk.newEnd);
      let previousOwner = hunk.oldStart > 0 ? owners[hunk.oldStart - 1]! : -1;
      let nextOwner = hunk.oldStart < owners.length ? owners[hunk.oldStart]! : -1;

      if (previousOwner >= 0 && insertedLines[0] != '') attachedOwner = previousOwner;
      else if (nextOwner >= 0 && insertedLines.at(-1) != '') attachedOwner = nextOwner;
    }

    if (touched.length == 0 && attachedOwner < 0) {
      let separatorOnly = hunk.oldEnd > hunk.oldStart;
      let inserted = newLines.slice(hunk.newStart, hunk.newEnd).join('\n').trim();

      if (separatorOnly && !inserted) {
        let before = blockBefore(hunk.oldStart);
        let after = owners.slice(hunk.oldEnd).find(owner => owner >= 0);
        if (before >= 0 && after !== undefined) touched = [before, after];
      } else {
        insertions.push({
          after: blockBefore(hunk.oldStart),
          newStart: hunk.newStart,
          newEnd: hunk.newEnd
        });
        continue;
      }
    }

    if (touched.length == 0 && attachedOwner >= 0) touched = [attachedOwner];
    if (touched.length == 0) continue;

    let first = Math.min(...touched);
    let last = Math.max(...touched);
    let newStart = hunk.newStart - Math.max(hunk.oldStart - blockStarts[first]!, 0);
    let newEnd = hunk.newEnd + Math.max(blockEnds[last]! - hunk.oldEnd, 0);

    let previous = regions.at(-1);
    if (previous && first <= previous.last + 1 && newStart <= previous.newEnd + 1) {
      previous.last = Math.max(previous.last, last);
      previous.newEnd = Math.max(previous.newEnd, newEnd);
      continue;
    }

    regions.push({ first, last, newStart, newEnd });
  }

  let operations: BlockEditOperation[] = [];

  for (let region of regions) {
    let content = newLines.slice(region.newStart, region.newEnd).join('\n').trim();
    let target = d.blocks[region.first]!.alias;
    let targetEnd = region.last > region.first ? d.blocks[region.last]!.alias : undefined;

    operations.push(
      content
        ? { type: 'replace', target, targetEnd, content }
        : { type: 'delete', target, targetEnd }
    );
  }

  for (let insertion of insertions) {
    let content = newLines.slice(insertion.newStart, insertion.newEnd).join('\n').trim();
    if (!content) continue;

    if (insertion.after >= 0) {
      operations.push({
        type: 'insert_after',
        target: d.blocks[insertion.after]!.alias,
        content
      });
    } else if (d.blocks.length > 0) {
      operations.push({ type: 'insert_before', target: d.blocks[0]!.alias, content });
    } else {
      operations.push({ type: 'insert_after', target: documentEndTarget, content });
    }
  }

  return operations;
};
