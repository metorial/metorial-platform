import { db, type SecurityReview } from '@metorial-subspace/db';
import { EvidenceLedger } from '@metorial/review-engine';
import { createHash } from 'node:crypto';
import { type CollectedEvidence, wrapUntrusted } from '../evidence';
import { collectCustomProviderEvidence } from './customProvider';
import { collectSkillEvidence, subjectKeyForSkill } from './skill';
import { collectSlateEvidence } from './slate';

// Global reviews are shared by every region, so they are keyed by the registry's ids, which
// are the only slate identifiers that agree across regions. Slates synced before those ids
// were recorded get no review until the next sync backfills them.
export let subjectKeyForSlateVersion = (d: {
  slate: { slateIdOnRegistry: string | null };
  slateVersion: { versionIdOnRegistry: string | null };
}) =>
  d.slate.slateIdOnRegistry && d.slateVersion.versionIdOnRegistry
    ? `slate:${d.slate.slateIdOnRegistry}:${d.slateVersion.versionIdOnRegistry}`
    : null;

export { subjectKeyForSkill };

export let subjectKeyForCustomProviderVersion = (d: { id: string }) => `cpv:${d.id}`;

export let loadSlateSubject = async (providerVersionOid: bigint) => {
  let providerVersion = await db.providerVersion.findUnique({
    where: { oid: providerVersionOid },
    include: { provider: true, slate: true, slateVersion: true, providerVariant: true }
  });
  if (!providerVersion?.slate || !providerVersion.slateVersion) return null;

  return {
    ...providerVersion,
    slate: providerVersion.slate,
    slateVersion: providerVersion.slateVersion
  };
};

export let loadCustomProviderSubject = async (customProviderVersionOid: bigint) =>
  await db.customProviderVersion.findUnique({
    where: { oid: customProviderVersionOid },
    include: {
      tenant: true,
      customProvider: true,
      immutableCodeBucket: true,
      providerVersion: true
    }
  });

export let collectEvidence = async (d: { review: SecurityReview }) => {
  if (d.review.subjectType == 'slate_version') {
    let subject = d.review.providerVersionOid
      ? await loadSlateSubject(d.review.providerVersionOid)
      : null;
    if (!subject) return null;

    return await collectSlateEvidence({
      provider: subject.provider,
      providerVersion: subject,
      slate: subject.slate,
      slateVersion: subject.slateVersion
    });
  }

  if (d.review.subjectType == 'custom_provider_version') {
    let subject = d.review.customProviderVersionOid
      ? await loadCustomProviderSubject(d.review.customProviderVersionOid)
      : null;
    if (!subject) return null;

    return await collectCustomProviderEvidence({
      tenant: subject.tenant,
      customProvider: subject.customProvider,
      customProviderVersion: subject,
      providerVersion: subject.providerVersion
    });
  }

  if (d.review.subjectType == 'skill_version') {
    return await collectSkillEvidence({ review: d.review });
  }

  return null;
};

let directoryListing = (evidence: CollectedEvidence) => {
  let entries = [
    [
      'spec.json',
      'Server name, description, server info and instructions from the specification.'
    ],
    ['auth.json', 'Authentication methods and the OAuth scopes they request.'],
    [
      'tools/',
      'One JSON file per tool: description, input schema, MCP annotations (if any), tags and scopes.'
    ],
    ['docs/', 'Documentation published with the integration.'],
    ['code/', 'The full source code of this version.'],
    ['deployment.json', 'Runtime, environment variable names (never values) and repository.'],
    ['remote.json', 'The remote URL, protocol and public OAuth endpoints.'],
    ['image.json', 'The container image reference.'],
    ['skill/', 'The files of the skill, with invisible characters made visible.'],
    ['skill.json', 'Skill name, description, license and provenance.'],
    ['inventory.json', 'Every file in the skill with its detected type and size.'],
    ['changes/', 'What changed since the last reviewed version: summary.json and diffs.'],
    ['facts.json', 'Pre-computed facts and the findings already recorded from them.']
  ] as const;

  let paths = Object.keys({ ...evidence.files, ...evidence.codeFiles });
  let exists = (entry: string) =>
    entry == 'facts.json' ||
    (entry.endsWith('/') ? paths.some(path => path.startsWith(entry)) : paths.includes(entry));

  return entries
    .filter(([entry]) => exists(entry))
    .map(([entry, description]) => `- /evidence/${entry} — ${description}`)
    .join('\n');
};

let buildReadme = (evidence: CollectedEvidence) =>
  [
    `# ${evidence.title}`,
    '',
    `Subject type: ${evidence.kind}`,
    `Allowed provenance classes: ${evidence.allowedProvenance.join(', ')}`,
    '',
    'Description as provided by the publisher:',
    wrapUntrusted('description', evidence.description || '(none)'),
    '',
    '## Available evidence',
    '',
    directoryListing(evidence),
    '',
    '## Tools',
    '',
    evidence.tools
      ? `${evidence.tools.length} tools: ${evidence.tools.map(tool => tool.key).join(', ') || '(none)'}`
      : 'Tools are not available yet. Write capabilities with an empty tools list and explain the gap in method.limitations.',
    ...(evidence.limitations.length
      ? [
          '',
          '## Known limitations',
          '',
          ...evidence.limitations.map(limitation => `- ${limitation}`)
        ]
      : [])
  ].join('\n');

export let buildEvidenceFiles = (evidence: CollectedEvidence) => {
  let files: Record<string, string> = {
    ...evidence.files,
    ...evidence.codeFiles,
    'README.md': buildReadme(evidence),
    'facts.json': JSON.stringify(
      {
        facts: evidence.facts,
        observations: evidence.observations ?? [],
        findings: evidence.findings.map(finding => ({ ...finding, recorded: true })),
        census: evidence.census
          ? {
              classification: evidence.census.classification,
              windowDays: evidence.census.windowDays,
              toolSets: evidence.census.hashes.map(entry => entry.toolKeys),
              divergentTools: evidence.census.divergentTools,
              addedTools: evidence.census.addedTools,
              removedTools: evidence.census.removedTools
            }
          : null
      },
      null,
      2
    )
  };

  return files;
};

export let buildLedger = (d: {
  evidence: CollectedEvidence;
  files: Record<string, string>;
}) => {
  let ledger = new EvidenceLedger();

  for (let [path, content] of Object.entries(d.files))
    ledger.addFile(`/evidence/${path}`, content);
  for (let tool of d.evidence.tools ?? []) ledger.addTool(tool.key);
  for (let fact of d.evidence.facts) ledger.addFact(fact);

  return ledger;
};

// The README embeds limitations that change with transient conditions (an unreachable
// vulnerability database) and runtime signals change with every alert, so neither counts as
// new evidence on their own.
let volatileEvidence = (path: string) => path == 'README.md' || path.startsWith('changes/');

export let hashEvidence = (files: Record<string, string>) => {
  let hash = createHash('sha256');
  for (let path of Object.keys(files).sort()) {
    if (volatileEvidence(path)) continue;
    hash.update(path).update('\u0000').update(files[path]!).update('\u0000');
  }
  return hash.digest('hex');
};
