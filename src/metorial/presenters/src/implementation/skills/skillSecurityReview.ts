import { v } from '@lowerdeck/validation';
import type {
  Prisma,
  SecurityLedgerRef,
  SecurityReport,
  SecurityReviewComputedScores,
  SecurityReviewFindingPayload,
  SecurityReviewRevisionContext
} from '@metorial-subspace/db';
import { Presenter } from '@metorial/presenter';
import { skillSecurityReviewRevisionType, skillSecurityReviewType } from '../../types';
import { levelSchema, severitySchema } from '../provider/provider/securityReview';

type ReviewInput = Prisma.SecurityReviewGetPayload<{
  include: { provider: true; providerVersion: true };
}>;
type RevisionInput = Prisma.SecurityReviewRevisionGetPayload<{ include: { findings: true } }>;

let SKILL_EVIDENCE_PREFIX = /^\/?evidence\/skill\//;

// Only references to the skill's own files mean something outside the review workspace.
let presentEvidence = (evidence: SecurityLedgerRef[] | undefined) =>
  (evidence ?? []).flatMap(ref =>
    ref.type == 'file' && SKILL_EVIDENCE_PREFIX.test(ref.path)
      ? [
          {
            type: 'file' as const,
            path: ref.path.replace(SKILL_EVIDENCE_PREFIX, ''),
            lines: ref.lines ?? null
          }
        ]
      : []
  );

let presentReport = (report: SecurityReport | null) => ({
  summary: report?.summary
    ? {
        text: report.summary.text,
        trust_note: report.summary.trustNote,
        exposure_note: report.summary.exposureNote
      }
    : null,
  provenance: report?.provenance
    ? {
        class: report.provenance.class,
        body: report.provenance.body
      }
    : null,
  behaviors: (report?.capabilities?.behaviors ?? []).map(behavior => ({
    tag: behavior.tag,
    body: behavior.body,
    evidence: presentEvidence(behavior.evidence)
  })),
  implementation: report?.implementation
    ? {
        strengths: report.implementation.strengths.map(point => ({
          title: point.title,
          body: point.body,
          evidence: presentEvidence(point.evidence)
        })),
        weaknesses: report.implementation.weaknesses.map(point => ({
          title: point.title,
          body: point.body,
          evidence: presentEvidence(point.evidence)
        }))
      }
    : null,
  resolved_findings: (report?.resolvedFindings ?? []).map(resolved => ({
    key: resolved.key,
    reason: resolved.reason
  })),
  changes: report?.changes ? { body: report.changes.body } : null,
  method: report?.method
    ? {
        included: report.method.included,
        out_of_scope: report.method.outOfScope,
        limitations: report.method.limitations
      }
    : null
});

let presentScores = (scores: SecurityReviewComputedScores | null) =>
  scores && scores.assessmentComplete !== false
    ? {
        security_score: scores.security,
        band: scores.band,
        exposure: scores.exposure,
        risk: scores.risk,
        confidence: scores.confidence,
        lethal_trifecta: scores.trifecta,
        headline: [...scores.headline],
        finding_counts: {
          info: scores.counts.findings.info,
          low: scores.counts.findings.low,
          medium: scores.counts.findings.medium,
          high: scores.counts.findings.high,
          critical: scores.counts.findings.critical
        }
      }
    : null;

let presentRevision = (d: { review: ReviewInput; revision: RevisionInput }) => {
  let { review, revision } = d;
  let context = revision.context as SecurityReviewRevisionContext | null;

  return {
    object: 'skill.security_review.revision' as const,

    id: revision.id,
    security_review_id: review.id,
    skill_version_id: revision.skillVersionId,
    number: revision.number,

    status: revision.status,
    stage: revision.stage,
    block_reason: revision.blockReason,

    ai_generated: revision.mode == 'ai',
    // Staff re-runs must not be distinguishable from routine ones.
    trigger: revision.trigger == 'admin' ? ('scheduled' as const) : revision.trigger,

    files: context?.skill
      ? {
          total: context.skill.fileCount,
          analyzed: context.skill.analyzedFileCount,
          kinds: context.skill.kinds
        }
      : null,

    scores: presentScores(revision.scores as SecurityReviewComputedScores | null),
    report: presentReport(revision.report as SecurityReport | null),
    findings: revision.findings.map(finding => {
      let value = finding.value as SecurityReviewFindingPayload;

      return {
        key: finding.key,
        kind: finding.kind,
        category: finding.category,
        severity: finding.severity,
        change: finding.change,
        title: value.title,
        body: value.body,
        recommendation: value.recommendation ?? null,
        evidence: presentEvidence(value.evidence)
      };
    }),

    started_at: revision.startedAt,
    completed_at: revision.completedAt,
    created_at: revision.createdAt
  };
};

let evidenceSchema = v.array(
  v.object({
    type: v.literal('file'),
    path: v.string({
      description: 'Path of the file within the skill',
      examples: ['scripts/setup.sh']
    }),
    lines: v.nullable(
      v.array(v.number(), { description: 'Start and end line of the cited range' })
    )
  }),
  { description: 'Files of the skill the statement is based on' }
);

let skillPointSchema = v.object({
  title: v.string({ description: 'Short title of the observation' }),
  body: v.string({ description: 'Explanation of the observation' }),
  evidence: evidenceSchema
});

let revisionSchema = v.object({
  object: v.literal('skill.security_review.revision', {
    description: "String representing the object's type"
  }),
  id: v.string({
    description: 'Unique identifier of the revision',
    examples: ['srr_4dEfGhJkLmNpQrSt']
  }),
  security_review_id: v.string({
    description: 'The security review this revision belongs to',
    examples: ['srv_5gHjKlMnPqRsTuVw']
  }),
  skill_version_id: v.nullable(
    v.string({ description: 'The skill version that was reviewed', examples: ['skv_4dEfGh'] })
  ),
  number: v.number({
    description: 'Sequential revision number within the review',
    examples: [3]
  }),

  status: v.enumOf(
    ['queued', 'running', 'completed', 'completed_with_gaps', 'failed', 'blocked'],
    {
      description:
        'Lifecycle state; `completed_with_gaps` means some files could not be checked'
    }
  ),
  stage: v.nullable(
    v.enumOf(['collecting', 'verifying', 'analyzing', 'writing'], {
      description: 'Current stage while the revision is running'
    })
  ),
  block_reason: v.nullable(
    v.enumOf(['billing', 'ai_disabled', 'admin_disabled'], {
      description: 'Why the AI review could not run, when only automated checks ran'
    })
  ),

  ai_generated: v.boolean({
    description:
      'Whether an AI reviewer read the skill. Otherwise only automated pattern and file-type checks ran'
  }),
  trigger: v.enumOf(
    [
      'first_use',
      'page_open',
      'new_version',
      'deployment',
      'tools_discovered',
      'census_changed',
      'scheduled',
      'prompt_update',
      'reassess',
      'skill_import'
    ],
    { description: 'What caused this revision to be created' }
  ),

  files: v.nullable(
    v.object(
      {
        total: v.number({ description: 'Files in the reviewed version', examples: [12] }),
        analyzed: v.number({
          description: 'Text files whose content was analysed',
          examples: [9]
        }),
        kinds: v.record(v.number(), {
          description:
            'File count per detected type. Binary files are classified by their signature only and never opened',
          examples: [{ text: 9, image: 2, executable: 1 }]
        })
      },
      { description: 'What the review covered' }
    )
  ),

  scores: v.nullable(
    v.object(
      {
        security_score: v.number({
          description: 'How trustworthy and well-built the skill is, from 0 to 100',
          examples: [84]
        }),
        band: v.enumOf(['strong', 'good', 'fair', 'weak', 'poor'], {
          description: 'Label for the security score range'
        }),
        exposure: levelSchema,
        risk: v.enumOf(['low', 'moderate', 'high', 'critical'], {
          description: 'Overall risk of using the skill, combining security and exposure'
        }),
        confidence: v.enumOf(['low', 'medium', 'high'], {
          description: 'How much of the skill the reviewer could verify'
        }),
        lethal_trifecta: v.boolean({
          description:
            'Whether the skill combines access to private data or credentials with sending data out'
        }),
        headline: v.array(v.string(), {
          description: 'Two-part headline: the verdict and the main reason',
          examples: [['Low risk', 'Instructions only, no scripts']]
        }),
        finding_counts: v.object({
          info: v.number({ description: 'Informational findings' }),
          low: v.number({ description: 'Low severity findings' }),
          medium: v.number({ description: 'Medium severity findings' }),
          high: v.number({ description: 'High severity findings' }),
          critical: v.number({ description: 'Critical findings' })
        })
      },
      { description: 'Computed scores; null until the review has an assessment' }
    )
  ),

  report: v.object(
    {
      summary: v.nullable(
        v.object({
          text: v.string({ description: 'Plain-language summary of the skill' }),
          trust_note: v.string({ description: 'Why the skill can or cannot be trusted' }),
          exposure_note: v.string({
            description: 'What the skill could make an agent do'
          })
        })
      ),
      provenance: v.nullable(
        v.object({
          class: v.enumOf(
            [
              'tenant_authored',
              'imported_public_repo',
              'imported_private_repo',
              'uploaded_archive',
              'forked'
            ],
            { description: 'Where the skill came from' }
          ),
          body: v.string({ description: 'Explanation of the provenance' })
        })
      ),
      behaviors: v.array(
        v.object({
          tag: v.enumOf(
            [
              'code_execution',
              'network_egress',
              'filesystem_outside_skill',
              'credential_access',
              'package_install',
              'persistence',
              'mcp_dependency',
              'subagents',
              'binary_payload',
              'financial'
            ],
            { description: 'What the skill makes an agent do' }
          ),
          body: v.string({ description: 'How the skill does it' }),
          evidence: evidenceSchema
        }),
        { description: 'Capabilities the skill exercises' }
      ),
      implementation: v.nullable(
        v.object({
          strengths: v.array(skillPointSchema),
          weaknesses: v.array(skillPointSchema)
        })
      ),
      resolved_findings: v.array(
        v.object({
          key: v.string({ description: 'Key of a finding from the previous revision' }),
          reason: v.string({ description: 'Why it no longer applies' })
        })
      ),
      changes: v.nullable(
        v.object({
          body: v.string({ description: 'What changed since the previous revision' })
        })
      ),
      method: v.nullable(
        v.object({
          included: v.array(v.string(), { description: 'What the review covered' }),
          out_of_scope: v.array(v.string(), { description: 'What the review did not cover' }),
          limitations: v.array(v.string(), { description: 'Known gaps in the review' })
        })
      )
    },
    { description: 'Report sections; sections that are not written yet are null' }
  ),

  findings: v.array(
    v.object({
      key: v.string({ description: 'Stable key of the finding across revisions' }),
      kind: v.enumOf(['security', 'capability', 'positive'], {
        description:
          'Security issues lower the score, capabilities describe dangerous operations, positives are good practice'
      }),
      category: v.string({
        description: 'Finding category',
        examples: ['remote_code_execution']
      }),
      severity: severitySchema,
      change: v.enumOf(['new', 'persisting', 'resolved'], {
        description: 'How the finding relates to the previous revision'
      }),
      title: v.string({ description: 'Short title' }),
      body: v.string({ description: 'Explanation' }),
      recommendation: v.nullable(v.string({ description: 'Suggested fix' })),
      evidence: evidenceSchema
    })
  ),

  started_at: v.nullable(v.date({ description: 'When the review started running' })),
  completed_at: v.nullable(v.date({ description: 'When the review finished' })),
  created_at: v.date({ description: 'When the revision was created' })
});

export let v1SkillSecurityReviewRevisionPresenter = Presenter.create(
  skillSecurityReviewRevisionType
)
  .presenter(async d => presentRevision(d))
  .schema(revisionSchema)
  .build();

export let v1SkillSecurityReviewPresenter = Presenter.create(skillSecurityReviewType)
  .presenter(async ({ review, current, inProgress, verdict }) => ({
    object: 'skill.security_review' as const,

    id: review.id,
    skill_id: review.skillId,

    verdict,
    dismissed_at: review.dismissedAt,

    current_revision: current ? presentRevision({ review, revision: current }) : null,
    in_progress_revision: inProgress
      ? presentRevision({ review, revision: inProgress })
      : null,

    created_at: review.createdAt,
    updated_at: review.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.security_review', {
        description: "String representing the object's type"
      }),
      id: v.string({
        description: 'Unique identifier of the security review',
        examples: ['srv_5gHjKlMnPqRsTuVw']
      }),
      skill_id: v.nullable(
        v.string({ description: 'The reviewed skill', examples: ['skl_5gHjKlMnPqRsTuVw'] })
      ),
      verdict: v.enumOf(['pass', 'warn', 'fail', 'pending', 'unavailable', 'dismissed'], {
        description:
          '`pending` means the review, or the AI part of it, has not finished yet; `dismissed` means a member stopped reviewing this skill'
      }),
      dismissed_at: v.nullable(
        v.date({ description: 'When the review was dismissed; null while it is active' })
      ),
      current_revision: v.nullable(revisionSchema),
      in_progress_revision: v.nullable(revisionSchema),
      created_at: v.date({ description: 'When the review was created' }),
      updated_at: v.date({ description: 'When the review was last updated' })
    })
  )
  .build();
