import { createHash } from 'node:crypto';
import {
  db,
  getId,
  type SecurityFileKind,
  type SecurityProvenanceClass,
  type SecurityReview
} from '@metorial-subspace/db';
import { scanTextForReview } from '@metorial-subspace/module-protoguard';
import { metorialDb } from '@metorial-subspace/module-tenant';
import { readFileHead } from '@metorial/module-file';
import type { LedgerFact } from '@metorial/review-engine';
import type { CollectedEvidence } from '../evidence';
import {
  AGENT_TEXT_MAX_BYTES,
  classifyByExtensionOnly,
  classifyHead,
  DETECTOR_TEXT_MAX_BYTES,
  isBinaryKind,
  type FileClassification,
  HEAD_BYTES
} from '../skillFiles';
import {
  type InstructionHit,
  scriptExtensions,
  sanitizeForReview,
  scanSkill,
  type SkillInventoryEntry,
  type SkillTextFile
} from '../skillDetectors';
import { buildChangeOverview, type SkillTreeEntry } from './skillChanges';

let READ_CONCURRENCY = 8;
let AGENT_TOTAL_MAX_BYTES = 4 * 1024 * 1024;
let DIFFABLE_TEXT_MAX_BYTES = 64 * 1024;
let INSTRUCTION_SCAN_MAX_BYTES = 1024 * 1024;

let skillProvenanceClasses: SecurityProvenanceClass[] = [
  'tenant_authored',
  'imported_public_repo',
  'imported_private_repo',
  'uploaded_archive',
  'forked'
];

let versionInclude = {
  storeVersion: {
    include: {
      items: {
        where: { kind: { not: 'directory' as const } },
        include: { file: true, documentVersion: { include: { content: true } } },
        orderBy: { path: 'asc' as const }
      }
    }
  }
};

type LoadedVersion = NonNullable<Awaited<ReturnType<typeof loadVersion>>>;
type LoadedItem = LoadedVersion['storeVersion']['items'][number];
type LoadedFile = NonNullable<LoadedItem['file']>;

// A document item also points at a backing file row, but its content lives in the document
// version, not in the files bucket.
let storedFileOf = (item: LoadedItem) => (item.documentVersion ? null : item.file);

export let subjectKeyForSkill = (d: { id: string }) => `skill:${d.id}`;

export let loadSkillSubject = async (skillId: string) =>
  await metorialDb.skill.findUnique({
    where: { id: skillId },
    include: {
      skillImportItems: { include: { skillImport: true }, take: 1 },
      forkedFromSkillVersion: { select: { id: true } }
    }
  });

let loadVersion = async (where: { skillOid: bigint } | { id: string }) =>
  await metorialDb.skillVersion.findFirst({
    where,
    orderBy: { versionNumber: 'desc' },
    include: versionInclude
  });

export let loadLatestSkillVersion = async (skillOid: bigint) =>
  await loadVersion({ skillOid });

let inChunks = async <T, R>(items: T[], run: (item: T) => Promise<R>) => {
  let results: R[] = [];

  for (let i = 0; i < items.length; i += READ_CONCURRENCY) {
    results.push(...(await Promise.all(items.slice(i, i + READ_CONCURRENCY).map(run))));
  }

  return results;
};

let toNumber = (value: bigint | number) => Number(value);

let readText = async (file: LoadedFile) => {
  let size = Math.max(toNumber(file.fileSize), 1);
  let head = await readFileHead({ file, bytes: size });

  return head.status == 'ok' ? new TextDecoder('utf-8').decode(head.bytes) : null;
};

type ClassifiedFile = {
  classification: FileClassification;
  gap: 'unreadable' | 'failed' | null;
};

let classifyFiles = async (files: LoadedFile[], names: Map<string, string>) => {
  let results = new Map<string, ClassifiedFile>();
  if (!files.length) return results;

  let stored = await db.securityReviewFileCheck.findMany({
    where: { fileId: { in: files.map(file => file.id) } }
  });
  for (let row of stored) {
    results.set(row.fileId, {
      classification: {
        kind: row.kind,
        detectedMime: row.detectedMime,
        extension: row.extension,
        isDisguised: row.isDisguised
      },
      gap: null
    });
  }

  let missing = files.filter(file => !results.has(file.id));
  let toStore: {
    fileId: string;
    kind: SecurityFileKind;
    detectedMime: string | null;
    extension: string | null;
    isDisguised: boolean;
    sizeBytes: bigint;
  }[] = [];

  await inChunks(missing, async file => {
    let head = await readFileHead({ file, bytes: HEAD_BYTES });

    if (head.status != 'ok') {
      results.set(file.id, {
        classification: classifyByExtensionOnly(names.get(file.id) ?? file.fileName),
        gap: head.status
      });
      return;
    }

    let classification = classifyHead({
      head: head.bytes,
      fileName: names.get(file.id) ?? file.fileName
    });
    results.set(file.id, { classification, gap: null });

    if (head.source == 'object') {
      toStore.push({ fileId: file.id, ...classification, sizeBytes: file.fileSize });
    }
  });

  if (toStore.length) {
    await db.securityReviewFileCheck.createMany({
      data: toStore.map(row => ({ ...getId('securityReviewFileCheck'), ...row })),
      skipDuplicates: true
    });
  }

  return results;
};

let buildTree = async (version: LoadedVersion) => {
  let items = version.storeVersion.items;
  let names = new Map<string, string>();
  for (let item of items) {
    let file = storedFileOf(item);
    if (file) names.set(file.id, item.path);
  }

  let classified = await classifyFiles(
    items.map(storedFileOf).filter((file): file is LoadedFile => !!file),
    names
  );

  let tree = new Map<string, SkillTreeEntry>();

  for (let item of items) {
    let path = item.path;

    let storedFile = storedFileOf(item);

    if (storedFile) {
      let result = classified.get(storedFile.id)!;
      let file = storedFile;
      let size = toNumber(file.fileSize);

      tree.set(path, {
        path,
        kind: result.classification.kind,
        size,
        identity: file.id,
        loadText:
          result.classification.kind == 'text' && size <= DIFFABLE_TEXT_MAX_BYTES
            ? () => readText(file)
            : null
      });
    } else if (item.documentVersion) {
      let content = item.documentVersion.content.content;

      tree.set(path, {
        path,
        kind: 'text',
        size: Buffer.byteLength(content),
        identity: item.documentVersion.id,
        loadText: () => Promise.resolve(content)
      });
    }
  }

  return { tree, classified };
};

// Identical content in a fork or duplicate hashes the same, so its review can be reused. Files
// the agent never saw count by identity, which only matches when the same file is shared.
let hashSkillContent = (d: {
  tree: Map<string, SkillTreeEntry>;
  files: Record<string, string>;
}) => {
  let hash = createHash('sha256');

  for (let entry of [...d.tree.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    let content = d.files[`skill/${entry.path.replace(/^\/+/, '')}`];

    hash
      .update(entry.path)
      .update('\u0000')
      .update(content ?? `${entry.kind}:${entry.identity}`)
      .update('\u0000');
  }

  return hash.digest('hex');
};

let provenanceFor = (skill: NonNullable<Awaited<ReturnType<typeof loadSkillSubject>>>) => {
  let importSource = skill.skillImportItems[0]?.skillImport ?? null;

  let provenanceClass: SecurityProvenanceClass = skill.forkedFromSkillVersion
    ? 'forked'
    : importSource
      ? importSource.sourceType == 'public_repository'
        ? 'imported_public_repo'
        : importSource.sourceType == 'origin_repository'
          ? 'imported_private_repo'
          : 'uploaded_archive'
      : 'tenant_authored';

  let detail = importSource
    ? importSource.sourceType == 'public_repository'
      ? `Imported from ${importSource.repositoryUrl ?? 'a public repository'}${importSource.ref ? ` at ${importSource.ref}` : ''}${importSource.path ? ` (path ${importSource.path})` : ''}.`
      : importSource.sourceType == 'origin_repository'
        ? `Imported from the connected private repository ${importSource.repositoryName ?? ''}.`
        : `Imported from the uploaded file ${importSource.sourceFileName ?? ''}.`
    : skill.forkedFromSkillVersion
      ? 'Forked from another skill.'
      : 'Written by members of this project.';

  return { provenanceClass, detail, importSource };
};

let previousReviewedVersion = async (d: {
  review: SecurityReview;
  currentVersionId: string;
}) => {
  let revision = await db.securityReviewRevision.findFirst({
    where: {
      reviewOid: d.review.oid,
      skillVersionId: { not: null },
      NOT: { skillVersionId: d.currentVersionId },
      status: { in: ['completed', 'completed_with_gaps'] }
    },
    orderBy: { number: 'desc' },
    select: { skillVersionId: true }
  });

  return revision?.skillVersionId ? await loadVersion({ id: revision.skillVersionId }) : null;
};

type AgentViewCandidate = {
  inventoryEntry: SkillInventoryEntry;
  path: string;
  size: number;
  content: string;
};

let agentViewPriority = (path: string) => {
  let name = path.split('/').pop()?.toLowerCase() ?? '';
  if (name == 'skill.md') return 0;

  let extension = name.split('.').pop() ?? '';
  return extension == 'md' || scriptExtensions.has(extension) ? 1 : 2;
};

let inventoryPriority = (entry: SkillInventoryEntry) =>
  isBinaryKind(entry.kind) ? 3 : entry.kind == 'empty' ? 2 : agentViewPriority(entry.path);

let sortInventory = (inventory: SkillInventoryEntry[]) =>
  inventory.sort(
    (a, b) => inventoryPriority(a) - inventoryPriority(b) || a.path.localeCompare(b.path)
  );

// Small files and scripts claim the shared budget first, so one large file cannot push a script
// out of the reviewing agent's view.
let pickAgentViewPaths = (candidates: AgentViewCandidate[]) => {
  let picked = new Set<string>();
  let agentBytes = 0;

  let ordered = candidates
    .filter(candidate => candidate.size <= AGENT_TEXT_MAX_BYTES)
    .sort(
      (a, b) =>
        agentViewPriority(a.path) - agentViewPriority(b.path) ||
        a.size - b.size ||
        a.path.localeCompare(b.path)
    );

  for (let candidate of ordered) {
    if (agentBytes + candidate.size > AGENT_TOTAL_MAX_BYTES) continue;

    agentBytes += candidate.size;
    picked.add(candidate.path);
  }

  return picked;
};

export let collectSkillEvidence = async (d: {
  review: SecurityReview;
}): Promise<CollectedEvidence | null> => {
  let skill = d.review.skillId ? await loadSkillSubject(d.review.skillId) : null;
  if (!skill || skill.status == 'deleted') return null;

  let version = await loadLatestSkillVersion(skill.oid);
  if (!version) return null;

  let { tree, classified } = await buildTree(version);
  let provenance = provenanceFor(skill);

  let facts: LedgerFact[] = [
    {
      id: 'provenance',
      title: `Skill provenance: ${provenance.provenanceClass.replace(/_/g, ' ')}`,
      detail: provenance.detail
    }
  ];
  let limitations: string[] = [];
  let files: Record<string, string> = {};
  let texts: SkillTextFile[] = [];
  let inventory: SkillInventoryEntry[] = [];
  let unreadText = 0;
  let unanalysedMedia = 0;
  let unanalysedOpaque = 0;
  let unreadable = 0;
  let detectorOnly = 0;
  let candidates: AgentViewCandidate[] = [];

  for (let item of version.storeVersion.items) {
    let entry = tree.get(item.path)!;
    let inventoryEntry: SkillInventoryEntry = {
      path: item.path,
      size: entry.size,
      kind: entry.kind,
      detectedMime: null,
      isDisguised: false,
      ships: true
    };

    let storedFile = storedFileOf(item);

    if (storedFile) {
      let result = classified.get(storedFile.id)!;
      inventoryEntry.detectedMime = result.classification.detectedMime;
      inventoryEntry.isDisguised = result.classification.isDisguised;

      if (result.gap) {
        inventoryEntry.notRead = 'unreadable';
        unreadable++;
      }
    }

    inventory.push(inventoryEntry);
    if (inventoryEntry.notRead) continue;

    if (entry.kind != 'text') {
      if (['executable', 'archive', 'unknown_binary'].includes(entry.kind)) unanalysedOpaque++;
      else if (entry.kind != 'empty') unanalysedMedia++;
      continue;
    }

    if (entry.size > DETECTOR_TEXT_MAX_BYTES) {
      inventoryEntry.notRead = 'too_large';
      unreadText++;
      continue;
    }

    let content = item.documentVersion
      ? item.documentVersion.content.content
      : item.file
        ? await readText(item.file)
        : null;

    if (content === null) {
      inventoryEntry.notRead = 'unreadable';
      unreadable++;
      continue;
    }

    candidates.push({ inventoryEntry, path: item.path, size: entry.size, content });
  }

  let agentViewPaths = pickAgentViewPaths(candidates);
  for (let candidate of candidates) {
    let inAgentView = agentViewPaths.has(candidate.path);

    if (inAgentView) {
      files[`skill/${candidate.path.replace(/^\/+/, '')}`] = sanitizeForReview(
        candidate.content
      );
    } else {
      candidate.inventoryEntry.notRead = 'not_shown';
      detectorOnly++;
    }

    texts.push({
      path: candidate.path,
      content: candidate.content,
      inAgentView,
      ships: true
    });
  }

  let instructionHits: Record<string, InstructionHit[]> = {};
  for (let file of texts) {
    if (file.content.length > INSTRUCTION_SCAN_MAX_BYTES) continue;

    let hits = scanTextForReview(file.content);
    if (hits.length) {
      instructionHits[file.path] = hits.map(hit => ({
        familyName: hit.familyName,
        matchedText: hit.matchedText
      }));
    }
  }

  sortInventory(inventory);

  let scan = scanSkill({ texts, inventory, instructionHits });
  facts.push(...scan.facts);

  files['skill.json'] = JSON.stringify(
    {
      name: sanitizeForReview(skill.name),
      description: sanitizeForReview(skill.description ?? ''),
      license: skill.license,
      compatibility: skill.compatibility,
      provenance: provenance.provenanceClass,
      versionNumber: version.versionNumber
    },
    null,
    2
  );
  files['inventory.json'] = JSON.stringify(
    inventory.map(entry => ({
      path: entry.path,
      size: entry.size,
      kind: entry.kind,
      mime: entry.detectedMime,
      disguised: entry.isDisguised,
      notRead: entry.notRead ?? null
    })),
    null,
    2
  );

  let previous = await previousReviewedVersion({
    review: d.review,
    currentVersionId: version.id
  });
  if (previous) {
    let before = await buildTree(previous);
    let overview = await buildChangeOverview({ previous: before.tree, current: tree });
    Object.assign(files, overview.files);
  }

  if (unanalysedMedia)
    limitations.push(
      `${unanalysedMedia} binary files (images, documents, media or fonts) were identified by file type only and not analysed.`
    );
  if (unanalysedOpaque)
    limitations.push(
      `${unanalysedOpaque} executables, archives or unknown binaries cannot be reviewed and were never opened.`
    );
  if (unreadText)
    limitations.push(`${unreadText} text files were too large to read and were not reviewed.`);
  if (unreadable)
    limitations.push(`${unreadable} files could not be read and were not reviewed.`);
  if (detectorOnly)
    limitations.push(
      `${detectorOnly} large text files were checked by pattern matching only and not shown to the reviewing agent.`
    );

  return {
    kind: 'skill',
    title: skill.name,
    description: skill.description ?? '',
    files,
    codeFiles: {},
    tools: [],
    facts,
    findings: scan.findings,
    behaviors: scan.behaviors,
    allowedProvenance: skillProvenanceClasses,
    fallbackProvenance: provenance.provenanceClass,
    codeReadable: unreadText + unreadable + unanalysedOpaque == 0,
    limitations,
    skillVersionId: version.id,
    contentHash: hashSkillContent({ tree, files }),
    skill: {
      fileCount: inventory.length,
      analyzedFileCount: texts.length,
      kinds: Object.fromEntries(
        [...Map.groupBy(inventory, entry => entry.kind)].map(([kind, entries]) => [
          kind,
          entries.length
        ])
      )
    }
  };
};
