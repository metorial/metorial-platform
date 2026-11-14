let segmentWidth = 6;
let segments = 4;

// A string that sorts like the version it encodes, so the store can compare versions with plain
// string operators: `2.1.10` → `000002.000001.000010.000000~`. Pre-releases sort before the release
// (`-` < `~`), build metadata is ignored. Non-numeric versions keep their lowercased text after a
// `z`, so they sort after every numeric one.
export let versionKey = (version: string | null | undefined): string | undefined => {
  if (!version) return undefined;

  let trimmed = version.trim().replace(/^v/i, '');
  let match = /^(\d+(?:\.\d+){0,3})(?:-([^+]*))?(?:\+.*)?$/.exec(trimmed);
  if (!match) return `z${trimmed.toLowerCase().slice(0, 64)}`;

  let numbers = match[1]!.split('.').map(part => Number.parseInt(part, 10));
  while (numbers.length < segments) numbers.push(0);

  let core = numbers
    .map(part => String(Math.min(part, 10 ** segmentWidth - 1)).padStart(segmentWidth, '0'))
    .join('.');

  return match[2] !== undefined
    ? `${core}-${match[2].toLowerCase().slice(0, 32)}`
    : `${core}~`;
};
