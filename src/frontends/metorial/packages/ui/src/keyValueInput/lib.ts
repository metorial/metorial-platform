export type KeyValueEntry = { key: string; value: string };

let unquote = (raw: string) => {
  let value = raw.trim();
  if (value.length < 2) return value;

  let quote = value[0];
  if ((quote != '"' && quote != "'") || value[value.length - 1] != quote) return value;

  let inner = value.slice(1, -1);
  if (quote == "'") return inner;

  return inner.replace(/\\(["\\n])/g, (_, char: string) => (char == 'n' ? '\n' : char));
};

export let parseKeyValueText = (text: string): KeyValueEntry[] | null => {
  let entries: KeyValueEntry[] = [];

  for (let line of text.split(/\r?\n/)) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    let assignment = trimmed.replace(/^export\s+/, '');
    let separatorIndex = assignment.indexOf('=');
    if (separatorIndex <= 0) return null;

    let key = assignment.slice(0, separatorIndex).trim();
    if (!key || /\s/.test(key)) return null;

    entries.push({ key, value: unquote(assignment.slice(separatorIndex + 1)) });
  }

  return entries.length ? entries : null;
};

export let getDuplicateKeys = (entries: KeyValueEntry[]) => {
  let seen = new Set<string>();
  let duplicates = new Set<string>();

  for (let entry of entries) {
    if (!entry.key) continue;
    if (seen.has(entry.key)) duplicates.add(entry.key);
    seen.add(entry.key);
  }

  return duplicates;
};

export let insertKeyValueEntries = (
  entries: KeyValueEntry[],
  index: number,
  inserted: KeyValueEntry[],
  maxRows?: number
) => {
  let target = entries[index];
  let replacesTarget = !target || (!target.key && !target.value);

  let next = [
    ...entries.slice(0, index + (replacesTarget ? 0 : 1)),
    ...inserted,
    ...entries.slice(index + 1)
  ];

  if (maxRows === undefined || next.length <= maxRows) {
    return { entries: next, truncated: false };
  }

  return { entries: next.slice(0, maxRows), truncated: true };
};

export let keyValueEntriesToRecord = (entries: KeyValueEntry[]) => {
  let record: Record<string, string> = {};

  for (let entry of entries) {
    let key = entry.key.trim();
    if (key) record[key] = entry.value;
  }

  return record;
};

export let recordToKeyValueEntries = (record: Record<string, string> | null | undefined) =>
  Object.entries(record ?? {}).map(([key, value]) => ({ key, value }));
