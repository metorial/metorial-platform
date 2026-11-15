import type {
  CodeBucket,
  CustomProvider,
  CustomProviderFrom,
  CustomProviderVersion,
  ProviderVersion,
  SecurityReportFinding,
  Tenant
} from '@metorial-subspace/db';
import type { LedgerFact } from '@metorial/review-engine';
import { parseLockfiles, queryAdvisories, scanSecrets } from '../detectors';
import type { CollectedEvidence, SubjectKind } from '../evidence';
import { groupByKind } from '../groupByKind';
import { origin } from '../origin';
import { censusFindings, computeSpecCensus } from './census';
import { scanToolDefinitions } from './protoguard';
import { buildRemoteEvidence } from './remote';
import { loadSpecification } from './specification';

let MAX_CODE_FILE_BYTES = 200_000;
let MAX_CODE_TOTAL_BYTES = 4_000_000;
let SKIPPED_DIRECTORIES = [
  'node_modules/',
  '.git/',
  'dist/',
  'build/',
  '__pycache__/',
  '.venv/'
];

let slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

let normalizeCodePath = (path: string) => path.replace(/^\/+/, '').replace(/\.\.+/g, '.');

let decodeCodeFiles = (files: { path: string; content: string; encoding?: string }[]) => {
  let decoded: Record<string, string> = {};
  let skipped = 0;
  let total = 0;

  for (let file of files) {
    let path = normalizeCodePath(file.path);
    if (SKIPPED_DIRECTORIES.some(directory => path.includes(directory))) continue;

    let content =
      file.encoding == 'utf-8'
        ? file.content
        : Buffer.from(file.content, 'base64').toString('utf8');

    if (content.includes('\u0000') || content.length > MAX_CODE_FILE_BYTES) {
      skipped++;
      continue;
    }
    if (total + content.length > MAX_CODE_TOTAL_BYTES) {
      skipped++;
      continue;
    }

    total += content.length;
    decoded[path] = content;
  }

  return { files: decoded, skipped };
};

let loadFunctionCode = async (d: {
  tenant: Tenant;
  from: Extract<CustomProviderFrom, { type: 'function' }>;
  bucket: CodeBucket | null;
}) => {
  if (d.bucket && d.tenant.originTenantId) {
    try {
      let result = await origin.codeBucket.getFiles({
        tenantId: d.tenant.originTenantId,
        codeBucketId: d.bucket.id
      });

      return decodeCodeFiles(
        (result.files as { path: string; content: string; encoding?: string }[]).map(file => ({
          path: file.path,
          content: file.content,
          encoding: file.encoding ?? 'base64'
        }))
      );
    } catch {
      return null;
    }
  }

  if (d.from.files?.length) {
    return decodeCodeFiles(
      d.from.files.map(file => ({
        path: file.filename,
        content: file.content,
        encoding: file.encoding ?? 'utf-8'
      }))
    );
  }

  return null;
};

let codeEvidence = async (d: {
  tenant: Tenant;
  from: Extract<CustomProviderFrom, { type: 'function' }>;
  bucket: CodeBucket | null;
}) => {
  let facts: LedgerFact[] = [];
  let findings: SecurityReportFinding[] = [];
  let limitations: string[] = [];

  let code = await loadFunctionCode(d);
  let codeFiles = code?.files ?? {};

  if (!code) limitations.push('The source code of this version could not be read.');
  if (code?.skipped)
    limitations.push(`${code.skipped} large or binary files were not reviewed.`);

  let secrets = scanSecrets(codeFiles);
  let secretsByKind = groupByKind(secrets);

  for (let [kind, hits] of secretsByKind) {
    let factId = `secret-${slugify(kind)}`;
    facts.push({
      id: factId,
      title: `Hard-coded ${kind.replace(/_/g, ' ')}`,
      detail: hits.map(hit => `${hit.path}:${hit.line}`).join('\n')
    });

    findings.push({
      key: `hardcoded-secret-${slugify(kind)}`,
      kind: 'security',
      category: 'secrets',
      severity: kind == 'hardcoded_credential' ? 'high' : 'critical',
      title: `Source code contains a hard-coded ${kind.replace(/_/g, ' ')}`,
      body: `A value that looks like a ${kind.replace(/_/g, ' ')} is written directly into ${[
        ...new Set(hits.map(hit => hit.path))
      ]
        .slice(0, 3)
        .join(', ')}. Anyone with access to the code can read and reuse it.`,
      recommendation:
        'Rotate the credential and load it from an environment variable instead.',
      tools: [],
      evidence: [
        ...hits.slice(0, 3).map(hit => ({
          type: 'file' as const,
          path: `/evidence/code/${hit.path}`,
          lines: [hit.line, hit.line] as [number, number]
        })),
        { type: 'fact', id: factId }
      ]
    });
  }

  let dependencies = parseLockfiles(codeFiles);
  let advisories = await queryAdvisories(dependencies).catch(() => {
    if (dependencies.length)
      limitations.push('The vulnerability database could not be reached.');
    return [];
  });

  if (dependencies.length) {
    facts.push({
      id: 'dependencies',
      title: `${dependencies.length} pinned dependencies`,
      detail: dependencies
        .slice(0, 200)
        .map(dependency => `${dependency.ecosystem} ${dependency.name}@${dependency.version}`)
        .join('\n')
    });
  }

  for (let advisory of advisories) {
    let factId = `advisory-${slugify(advisory.id)}`;
    facts.push({
      id: factId,
      title: `${advisory.dependency.name}@${advisory.dependency.version}: ${advisory.id}`,
      detail: advisory.summary
    });

    findings.push({
      key: `vulnerable-dependency-${slugify(`${advisory.dependency.name}-${advisory.id}`)}`,
      kind: 'security',
      category: 'dependencies',
      severity: advisory.severity,
      title: `${advisory.dependency.name} ${advisory.dependency.version} has a known vulnerability`,
      body: `${advisory.id}: ${advisory.summary}`.slice(0, 600),
      recommendation: `Upgrade ${advisory.dependency.name} to a patched version.`,
      tools: [],
      evidence: [{ type: 'fact', id: factId }]
    });
  }

  let envKeys = Object.keys(d.from.env ?? {}).sort();

  return {
    codeFiles: Object.fromEntries(
      Object.entries(codeFiles).map(([path, content]) => [`code/${path}`, content])
    ),
    files: {
      'deployment.json': JSON.stringify(
        {
          type: 'function',
          runtime: d.from.runtime,
          environmentVariableNames: envKeys,
          repository: d.from.repository
            ? 'repositoryUrl' in d.from.repository
              ? { url: d.from.repository.repositoryUrl, branch: d.from.repository.branch }
              : { connected: true, branch: d.from.repository.branch }
            : null
        },
        null,
        2
      )
    },
    facts,
    findings,
    limitations,
    contentComplete: !!code && !code.skipped && !limitations.length,
    codeReadable: !!code && Object.keys(codeFiles).length > 0
  };
};

let containerEvidence = (from: Extract<CustomProviderFrom, { type: 'container' }>) => {
  let imageRef = from.repository.imageRef;
  let registry =
    imageRef.includes('/') && imageRef.split('/')[0]!.includes('.')
      ? imageRef.split('/')[0]!
      : 'docker.io';
  let isPinned = imageRef.includes('@sha256:');

  let findings: SecurityReportFinding[] = isPinned
    ? []
    : [
        {
          key: 'container-unpinned-image',
          kind: 'security',
          category: 'implementation',
          severity: 'low',
          title: 'The container image is referenced by tag, not digest',
          body: `${imageRef} can change without a new version being deployed, so the reviewed image may not be the one that runs.`,
          recommendation: 'Reference the image by its sha256 digest.',
          tools: [],
          evidence: [{ type: 'fact', id: 'container-image' }]
        }
      ];

  return {
    files: {
      'image.json': JSON.stringify(
        {
          imageRef,
          registry,
          pinnedByDigest: isPinned,
          privateRegistry: !!from.repository.username
        },
        null,
        2
      )
    },
    facts: [
      {
        id: 'container-image',
        title: `Container image ${imageRef}`,
        detail: `Pulled from ${registry}${isPinned ? ', pinned by digest' : ', referenced by tag'}.`
      }
    ] satisfies LedgerFact[],
    findings
  };
};

let remoteProvenance = [
  'tenant_remote_vendor_verified',
  'tenant_remote_vendor_plausible',
  'tenant_remote_third_party',
  'tenant_remote_unverifiable',
  'impersonation_suspected'
] as const;

export let collectCustomProviderEvidence = async (d: {
  tenant: Tenant;
  customProvider: CustomProvider;
  customProviderVersion: CustomProviderVersion & { immutableCodeBucket: CodeBucket | null };
  providerVersion: ProviderVersion | null;
}): Promise<CollectedEvidence> => {
  let from = d.customProviderVersion.payload?.from ?? d.customProvider.payload.from;
  let kind: SubjectKind = from.type;

  let specification = await loadSpecification(d.providerVersion?.specificationOid ?? null);
  let tools = specification?.tools ?? null;
  let poisoning = scanToolDefinitions(tools ?? []);

  let census = d.providerVersion
    ? await computeSpecCensus({ providerVersionOid: d.providerVersion.oid })
    : null;
  let variance = census ? censusFindings(census) : { facts: [], findings: [] };

  let files: Record<string, string> = { ...(specification?.files ?? {}) };
  let codeFiles: Record<string, string> = {};
  let facts: LedgerFact[] = [...poisoning.facts, ...variance.facts];
  let findings: SecurityReportFinding[] = [...variance.findings];
  let limitations: string[] = [];
  let codeReadable: boolean | undefined;
  let contentComplete: boolean | undefined;

  if (from.type == 'function') {
    let code = await codeEvidence({
      tenant: d.tenant,
      from,
      bucket: d.customProviderVersion.immutableCodeBucket
    });
    Object.assign(files, code.files);
    codeFiles = code.codeFiles;
    facts.push(...code.facts);
    findings.push(...code.findings);
    limitations.push(...code.limitations);
    codeReadable = code.codeReadable;
    contentComplete = code.contentComplete;
  }

  if (from.type == 'remote') {
    let remote = buildRemoteEvidence(from);
    Object.assign(files, remote.files);
    facts.push(...remote.facts);
  }

  if (from.type == 'container') {
    let container = containerEvidence(from);
    Object.assign(files, container.files);
    facts.push(...container.facts);
    findings.push(...container.findings);
    limitations.push(
      'Container images are not unpacked; only the image reference and tools were reviewed.'
    );
  }

  if (!tools) {
    limitations.push(
      kind == 'remote'
        ? 'Tools are listed once an account is connected; the review will be completed then.'
        : 'The tool specification for this version has not been discovered yet.'
    );
  }

  let observations = [
    ...poisoning.observations,
    ...findings
      .filter(finding => finding.kind == 'security')
      .map(finding => ({
        key: finding.key,
        title: `Review signal: ${finding.title}`,
        detail: finding.body,
        evidence: finding.evidence
      }))
  ];
  findings = findings.filter(finding => finding.kind != 'security');

  return {
    kind,
    title: d.customProvider.name,
    description: d.customProvider.description ?? '',
    files,
    codeFiles,
    tools,
    facts,
    findings,
    observations,
    allowedProvenance:
      kind == 'remote'
        ? [...remoteProvenance]
        : kind == 'function'
          ? ['tenant_code', 'impersonation_suspected']
          : ['tenant_image', 'impersonation_suspected'],
    fallbackProvenance:
      kind == 'remote'
        ? 'tenant_remote_unverifiable'
        : kind == 'function'
          ? 'tenant_code'
          : 'tenant_image',
    codeReadable,
    contentComplete,
    census: census ?? undefined,
    specificationOid: specification?.oid,
    limitations
  };
};
