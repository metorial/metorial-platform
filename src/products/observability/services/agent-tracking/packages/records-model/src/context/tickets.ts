let maxTicketRefs = 8;

let number = '[1-9][0-9]{0,6}';
let upperKey = `[A-Z][A-Z0-9_]{1,9}-${number}`;
let mixedKey = `[A-Za-z][A-Za-z0-9]{1,9}-${number}`;

let upperKeyPattern = new RegExp(`(?<![A-Za-z0-9])(${upperKey})(?![A-Za-z0-9]|\\.[0-9])`, 'g');
let segmentKeyPattern = new RegExp(`(?<=^|/)(${mixedKey})(?=[-/_]|$)`, 'g');
let wholeKeyPattern = new RegExp(`^(?:${upperKey}|${mixedKey})$`);
let issuePattern = /^#[1-9][0-9]{0,8}$/;

let skippedBranchOwners = new Set(['dependabot', 'renovate']);

// Standard, version and algorithm names: never a ticket, however they are written.
let alwaysDeniedPrefixes = new Set([
  'AES',
  'ARM',
  'CLAUDE',
  'COVID',
  'CVE',
  'ECMA',
  'ES',
  'GPT',
  'HTML',
  'HTTP',
  'IEEE',
  'IPV',
  'ISO',
  'MD',
  'OWASP',
  'PEP',
  'RFC',
  'RSA',
  'SHA',
  'SSL',
  'TLS',
  'UTF',
  'WCAG',
  'X64',
  'X86'
]);

// Workflow and platform words that start lowercase branch segments (`fix-12-login`,
// `ios-17-support`). Written in capitals they are real project keys (`IOS-123`).
let segmentDeniedPrefixes = new Set([
  'ADD',
  'API',
  'AUTH',
  'BASE',
  'BUG',
  'BUGFIX',
  'BUILD',
  'BUMP',
  'CHORE',
  'CI',
  'CSS',
  'DEPS',
  'DOCS',
  'DRAFT',
  'FEAT',
  'FEATURE',
  'FIX',
  'GH',
  'GO',
  'HOTFIX',
  'IOS',
  'ISSUE',
  'ISSUES',
  'JAVA',
  'MAC',
  'MERGE',
  'MP',
  'MR',
  'NODE',
  'OAUTH',
  'PART',
  'PATCH',
  'PCI',
  'PERF',
  'PHASE',
  'PR',
  'PY',
  'PYTHON',
  'REFACTOR',
  'RELEASE',
  'REMOVE',
  'REVERT',
  'ROUND',
  'SOC',
  'STEP',
  'STYLE',
  'TASK',
  'TEST',
  'TESTS',
  'TRY',
  'UI',
  'UPDATE',
  'VERSION',
  'WIN',
  'WIP'
]);

let deniedPrefixPattern = /^[VH][0-9]+$/;

let isTicketKey = (key: string, d: { capitals: boolean }) => {
  let prefix = key.slice(0, key.lastIndexOf('-'));
  if (alwaysDeniedPrefixes.has(prefix) || deniedPrefixPattern.test(prefix)) return false;

  return d.capitals || !segmentDeniedPrefixes.has(prefix);
};

export let isIssueRef = (ref: string) => issuePattern.test(ref);

export let ticketRefsFromBranch = (branch: string | undefined) => {
  if (!branch) return [];
  if (skippedBranchOwners.has(branch.split('/')[0]!.toLowerCase())) return [];

  let hits = [
    ...[...branch.matchAll(upperKeyPattern)],
    ...[...branch.matchAll(segmentKeyPattern)]
  ].sort((a, b) => a.index - b.index);

  let refs = new Set<string>();

  for (let hit of hits) {
    let raw = hit[1]!;
    let key = raw.toUpperCase();
    if (!isTicketKey(key, { capitals: raw == key })) continue;

    refs.add(key);
    if (refs.size >= maxTicketRefs) break;
  }

  return [...refs];
};

export let normalizeTicketRefs = (refs: string[]) => {
  let normalized = new Set<string>();

  for (let raw of refs) {
    let ref = raw.trim();
    let key = ref.toUpperCase();

    if (isIssueRef(ref)) normalized.add(ref);
    else if (wholeKeyPattern.test(ref) && isTicketKey(key, { capitals: true })) {
      normalized.add(key);
    }

    if (normalized.size >= maxTicketRefs) break;
  }

  return [...normalized];
};
