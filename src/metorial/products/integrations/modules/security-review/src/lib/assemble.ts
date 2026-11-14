import type {
  SecurityLevel,
  SecurityProvenanceClass,
  SecurityReport,
  SecurityReportFinding,
  SecurityReviewBlockReason,
  SecurityReviewComputedScores
} from '@metorial-subspace/db';
import { resolveFindingCitations, resolveReportCitations } from './citations';
import {
  type CollectedEvidence,
  declaredCapabilities,
  hintMismatchFindings
} from './evidence';
import { computeScores } from './scoring';
import { neutralizeInternalTermsDeep } from './terminology';

let provenanceLabels: Record<SecurityProvenanceClass, string> = {
  metorial_built: 'built and operated by Metorial',
  tenant_code: 'custom code deployed by your organization',
  tenant_image: 'a custom container image deployed by your organization',
  tenant_remote_vendor_verified: 'hosted by the vendor on its documented domain',
  tenant_remote_vendor_plausible: "hosted on the vendor's domain but not documented by it",
  tenant_remote_third_party: 'hosted by an identifiable third party',
  tenant_remote_unverifiable: 'hosted by an operator that could not be identified',
  impersonation_suspected: 'presented under a brand that does not match its host',
  tenant_authored: 'authored by your organization',
  imported_public_repo: 'imported from a public repository',
  imported_private_repo: 'imported from a private repository',
  uploaded_archive: 'uploaded as an archive',
  forked: 'forked from another skill'
};

let exposureSentences: Record<SecurityLevel, string> = {
  unknown: 'Its tools have not been inspected yet.',
  low: 'Its tools only read data.',
  moderate: 'Its tools can create or change data.',
  high: 'Its tools can delete data or send it to external systems.',
  critical: 'Its tools can change access, move money, execute code or modify infrastructure.'
};

let blockReasonText: Record<SecurityReviewBlockReason, string> = {
  ai_disabled:
    'AI analysis is not available for this review, so only deterministic checks ran.',
  billing:
    'The AI review budget for this project is used up, so only deterministic checks ran.',
  admin_disabled: 'AI review is disabled for this provider.'
};

export type SecurityFindingOrigin = 'agent' | 'detector' | 'admin';

let mergeFindings = (d: {
  agent: SecurityReportFinding[];
  recorded: SecurityReportFinding[];
  locked: SecurityReportFinding[];
}) => {
  let byKey = new Map<
    string,
    { finding: SecurityReportFinding; origin: SecurityFindingOrigin }
  >();
  for (let finding of d.agent) byKey.set(finding.key, { finding, origin: 'agent' });
  for (let finding of d.recorded) byKey.set(finding.key, { finding, origin: 'detector' });
  for (let finding of d.locked) byKey.set(finding.key, { finding, origin: 'admin' });
  return [...byKey.values()];
};

export type AssembleInput = {
  evidence: CollectedEvidence;
  draft: Partial<SecurityReport> | null;
  blockReason?: SecurityReviewBlockReason;
  budgetExhausted: boolean;
  gaps: string[];
  previous?: { security: number; risk: SecurityLevel };
  lockedFindings?: SecurityReportFinding[];
};

export let assembleReport = (d: AssembleInput) => {
  let draft = neutralizeInternalTermsDeep(d.draft ?? {});
  let tools = d.evidence.tools;

  let deterministicBehaviors = (d.evidence.behaviors ?? []).filter(
    behavior =>
      !behavior.observationKeys?.length ||
      !behavior.observationKeys.every(key =>
        draft.checks?.some(check => check.key == key && check.disposition == 'benign')
      )
  );
  let draftBehaviors = draft.capabilities?.behaviors ?? [];
  let behaviors = [
    ...draftBehaviors,
    ...deterministicBehaviors.filter(
      known =>
        !draftBehaviors.some(behavior => behavior.tag == known.tag && behavior.actions?.length)
    )
  ];
  behaviors = behaviors.filter(
    (behavior, index) => behaviors.findIndex(other => other.tag == behavior.tag) == index
  );

  let reviewedTools = draft.capabilities?.tools ?? [];
  let missingTools = declaredCapabilities(
    (tools ?? []).filter(tool => !reviewedTools.some(reviewed => reviewed.key == tool.key))
  );
  let capabilities = {
    tools: [...reviewedTools, ...missingTools],
    ...(behaviors.length ? { behaviors } : {})
  };
  let unresolved = (d.evidence.observations ?? []).filter(
    observation =>
      !draft.checks?.some(
        check => check.key == observation.key && check.disposition != 'unresolved'
      )
  );
  let complete =
    !!draft.capabilities &&
    !!draft.summary &&
    !!draft.provenance &&
    !!draft.findings &&
    draft.method?.coverage == 'complete' &&
    !d.gaps.length &&
    !missingTools.length &&
    !unresolved.length &&
    !capabilities.tools.some(tool => tool.unclassified || !tool.actions?.length) &&
    !behaviors.some(
      behavior =>
        behavior.unclassified || (behavior.tag != 'subagents' && !behavior.actions?.length)
    );

  let provenance = draft.provenance ?? {
    class: d.evidence.fallbackProvenance,
    body: `This server is ${provenanceLabels[d.evidence.fallbackProvenance]}.`,
    evidence: d.evidence.facts
      .slice(0, 1)
      .map(fact => ({ type: 'fact' as const, id: fact.id }))
  };

  let derivedFindings = tools
    ? hintMismatchFindings({ tools, capabilities: capabilities.tools })
    : [];
  let merged = mergeFindings({
    agent: draft.findings ?? [],
    recorded: [...d.evidence.findings, ...derivedFindings],
    locked: d.lockedFindings ?? []
  });
  let sources = {
    facts: d.evidence.facts,
    files: { ...d.evidence.files, ...d.evidence.codeFiles }
  };
  let findings = merged.map(entry => resolveFindingCitations(entry.finding, sources));
  let origins = Object.fromEntries(merged.map(entry => [entry.finding.key, entry.origin]));

  let reviewedKeys = new Set(reviewedTools.map(tool => tool.key));
  let scores: SecurityReviewComputedScores = computeScores({
    provenance: provenance.class,
    tools: tools ? capabilities.tools : null,
    behaviors,
    findings,
    coverage: {
      toolsExpected: tools ? tools.length : null,
      toolsReviewed: tools ? tools.filter(tool => reviewedKeys.has(tool.key)).length : 0,
      codeReadable: d.evidence.codeReadable,
      budgetExhausted: d.budgetExhausted,
      awaitingTools: tools === null,
      assessmentComplete: complete,
      contentComplete: d.evidence.contentComplete,
      unresolvedObservations: unresolved.length
    },
    previous: d.previous
  });

  let summary = draft.summary ?? {
    text: `${d.evidence.title} is ${provenanceLabels[provenance.class]}. ${exposureSentences[scores.exposure]}`,
    trustNote: `Assessed from ${d.draft ? 'a partial review' : 'deterministic checks only'}.`,
    exposureNote: exposureSentences[scores.exposure]
  };

  if (!scores.assessmentComplete) {
    summary = {
      ...summary,
      trustNote: 'The assessment is incomplete. A final security score requires more evidence.'
    };
  }
  if (scores.exposure == 'unknown')
    summary = {
      ...summary,
      exposureNote: 'Some actions could not be classified from the available evidence.'
    };

  let isSlate = d.evidence.kind == 'slate';
  let limitations = [
    ...(isSlate ? [] : (draft.method?.limitations ?? [])),
    ...neutralizeInternalTermsDeep(d.evidence.limitations),
    ...(d.gaps.length ? ['Some conclusions could not be validated.'] : []),
    ...(missingTools.length
      ? [`${missingTools.length} tools have not been classified by the review.`]
      : []),
    ...unresolved.map(observation => `Unresolved observation: ${observation.title}`),
    ...(d.blockReason ? [blockReasonText[d.blockReason]] : []),
    ...(d.budgetExhausted
      ? ['The review reached its analysis budget before covering everything.']
      : [])
  ];

  let report: SecurityReport = resolveReportCitations(
    {
      ...draft,
      summary,
      provenance,
      capabilities,
      findings,
      method: {
        coverage: scores.assessmentComplete ? 'complete' : 'partial',
        included: draft.method?.included ?? [
          'Tool specification and declared annotations',
          'Deterministic scanners for prompt injection, secrets and vulnerable dependencies'
        ],
        outOfScope: isSlate
          ? neutralizeInternalTermsDeep(d.evidence.outOfScope ?? [])
          : (draft.method?.outOfScope ?? [
              'Runtime behavior of the server',
              'Data returned by tools'
            ]),
        limitations: [...new Set(limitations)]
      }
    },
    sources
  );

  return { report, scores, findings, origins };
};
