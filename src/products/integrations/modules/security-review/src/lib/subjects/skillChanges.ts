import type { SecurityFileKind } from '@metorial-subspace/db';
import { unifiedLineDiff } from '../lineDiff';
import { sanitizeForReview } from '../skillDetectors';

let MAX_DIFF_FILES = 40;
let MAX_DIFF_LINES = 200;
let MAX_SUMMARY_ENTRIES = 200;

export type SkillTreeEntry = {
  path: string;
  kind: SecurityFileKind;
  size: number;
  identity: string;
  loadText: (() => Promise<string | null>) | null;
};

export type SkillChangeSummary = {
  added: { path: string; kind: SecurityFileKind; size: number }[];
  removed: { path: string; kind: SecurityFileKind; size: number }[];
  modified: {
    path: string;
    kind: SecurityFileKind;
    previousKind: SecurityFileKind;
    previousSize: number;
    size: number;
    kindChanged: boolean;
    diff: 'included' | 'omitted' | 'binary';
  }[];
  truncated: boolean;
};

let truncateDiff = (diff: string) => {
  let lines = diff.split('\n');
  return lines.length > MAX_DIFF_LINES
    ? [
        ...lines.slice(0, MAX_DIFF_LINES),
        `... ${lines.length - MAX_DIFF_LINES} more lines`
      ].join('\n')
    : diff;
};

export let buildChangeOverview = async (d: {
  previous: Map<string, SkillTreeEntry>;
  current: Map<string, SkillTreeEntry>;
}) => {
  let summary: SkillChangeSummary = { added: [], removed: [], modified: [], truncated: false };
  let files: Record<string, string> = {};
  let diffCount = 0;

  for (let [path, entry] of d.current) {
    let before = d.previous.get(path);

    if (!before) {
      summary.added.push({ path, kind: entry.kind, size: entry.size });
      continue;
    }
    if (before.identity == entry.identity) continue;

    let diff: SkillChangeSummary['modified'][number]['diff'] = 'binary';

    if (entry.kind == 'text' && before.kind == 'text') {
      diff = 'omitted';

      if (entry.loadText && before.loadText && diffCount < MAX_DIFF_FILES) {
        let [previousText, currentText] = await Promise.all([
          before.loadText(),
          entry.loadText()
        ]);
        let text =
          previousText !== null && currentText !== null
            ? unifiedLineDiff(sanitizeForReview(previousText), sanitizeForReview(currentText))
            : null;

        if (text) {
          files[`changes/diffs/${path.replace(/^\/+/, '')}.diff`] = truncateDiff(text);
          diff = 'included';
          diffCount++;
        }
      }
    }

    summary.modified.push({
      path,
      kind: entry.kind,
      previousKind: before.kind,
      previousSize: before.size,
      size: entry.size,
      kindChanged: before.kind != entry.kind,
      diff
    });
  }

  for (let [path, entry] of d.previous) {
    if (!d.current.has(path)) {
      summary.removed.push({ path, kind: entry.kind, size: entry.size });
    }
  }

  for (let list of [summary.added, summary.removed, summary.modified]) {
    if (list.length > MAX_SUMMARY_ENTRIES) {
      list.length = MAX_SUMMARY_ENTRIES;
      summary.truncated = true;
    }
  }

  files['changes/summary.json'] = JSON.stringify(summary, null, 2);

  return { files, summary };
};
