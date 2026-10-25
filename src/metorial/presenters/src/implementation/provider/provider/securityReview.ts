import { v } from '@lowerdeck/validation';
import type {
  Prisma,
  SecurityLedgerRef,
  SecurityReport,
  SecurityReportPoint,
  SecurityReviewComputedScores,
  SecurityReviewFindingPayload,
  SecurityReviewRevisionContext,
  SecurityToolHints
} from '@metorial-subspace/db';
import { Presenter } from '@metorial/presenter';
import {
  providerSecurityReviewRevisionType,
  providerSecurityReviewType
} from '../../../types';

type ReviewInput = Prisma.SecurityReviewGetPayload<{
  include: { provider: true; providerVersion: true };
}>;
type RevisionInput = Prisma.SecurityReviewRevisionGetPayload<{ include: { findings: true } }>;

type PresentedEvidence =
  | { type: 'file'; path: string; lines: number[] | null }
  | { type: 'url'; url: string }
  | { type: 'tool'; tool_key: string };

// Ledger facts only resolve inside the review workspace, so they are not presented.
export let presentEvidence = (evidence: SecurityLedgerRef[] | undefined) =>
  (evidence ?? []).flatMap((ref): PresentedEvidence[] => {
    if (ref.type == 'file') {
      return [{ type: 'file' as const, path: ref.path, lines: ref.lines ?? null }];
    }
    if (ref.type == 'url') return [{ type: 'url' as const, url: ref.url }];
    if (ref.type == 'tool') return [{ type: 'tool' as const, tool_key: ref.key }];
    return [];
  });

let presentHints = (hints: SecurityToolHints) => ({
  read_only: hints.readOnly ?? null,
  destructive: hints.destructive ?? null,
  idempotent: hints.idempotent ?? null,
  open_world: hints.openWorld ?? null
});

export let presentPoint = (point: SecurityReportPoint) => ({
  title: point.title,
  body: point.body,
  evidence: presentEvidence(point.evidence)
});

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
        body: report.provenance.body,
        evidence: presentEvidence(report.provenance.evidence)
      }
    : null,
  capabilities: report?.capabilities
    ? {
        tools: report.capabilities.tools.map(tool => ({
          key: tool.key,
          name: tool.name ?? null,
          tags: tool.tags,
          behavior: tool.behavior,
          declared_hints: presentHints(tool.declaredHints),
          hint_accuracy: tool.hintAccuracy
        }))
      }
    : null,
  implementation: report?.implementation
    ? {
        strengths: report.implementation.strengths.map(presentPoint),
        weaknesses: report.implementation.weaknesses.map(presentPoint)
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

export let presentScores = (scores: SecurityReviewComputedScores | null) =>
  scores
    ? {
        security_score: scores.security,
        band: scores.band,
        exposure: scores.exposure,
        risk: scores.risk,
        confidence: scores.confidence,
        lethal_trifecta: scores.trifecta,
        headline: [...scores.headline],
        counts: {
          tools_expected: scores.counts.tools.expected,
          tools_reviewed: scores.counts.tools.reviewed,
          read_tools: scores.counts.capabilities.read,
          write_tools: scores.counts.capabilities.write,
          destructive_tools: scores.counts.capabilities.destructive,
          findings: {
            info: scores.counts.findings.info,
            low: scores.counts.findings.low,
            medium: scores.counts.findings.medium,
            high: scores.counts.findings.high,
            critical: scores.counts.findings.critical
          },
          positives: scores.counts.positives
        },
        previous: scores.delta
          ? {
              security_score: scores.delta.previousSecurity,
              risk: scores.delta.previousRisk
            }
          : null
      }
    : null;

let presentRevision = (d: { review: ReviewInput; revision: RevisionInput }) => {
  let { review, revision } = d;
  let context = revision.context as SecurityReviewRevisionContext | null;

  return {
    object: 'provider.security_review.revision' as const,

    id: revision.id,
    security_review_id: review.id,
    provider_version_id: review.providerVersion?.id ?? null,
    number: revision.number,

    status: revision.status,
    stage: revision.stage,
    activity: revision.activity,
    block_reason: revision.blockReason,
    awaiting_tools: revision.awaitingTools,

    ai_generated: revision.mode == 'ai',
    // Staff re-runs must not be distinguishable from routine ones.
    trigger: revision.trigger == 'admin' ? ('scheduled' as const) : revision.trigger,
    trigger_reason: context?.reason ?? null,

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
        tool_keys: value.tools,
        evidence: presentEvidence(value.evidence)
      };
    }),

    rules_version: revision.rulesVersion,
    prompt_version: revision.promptVersion,

    started_at: revision.startedAt,
    completed_at: revision.completedAt,
    created_at: revision.createdAt
  };
};

export let evidenceSchema = v.array(
  v.union([
    v.object({
      type: v.literal('file'),
      path: v.string({ description: 'Path of the source file within the reviewed code' }),
      lines: v.nullable(
        v.array(v.number(), { description: 'Start and end line of the cited range' })
      )
    }),
    v.object({
      type: v.literal('url'),
      url: v.string({ description: 'Web page the reviewer consulted' })
    }),
    v.object({
      type: v.literal('tool'),
      tool_key: v.string({ description: 'Key of the tool the evidence refers to' })
    })
  ]),
  { description: 'Evidence the statement is based on' }
);

export let levelSchema = v.enumOf(['unknown', 'low', 'moderate', 'high', 'critical']);
let riskSchema = v.enumOf(['low', 'moderate', 'high', 'critical'], {
  description: 'Overall risk of connecting the provider, combining security and exposure'
});
export let severitySchema = v.enumOf(['info', 'low', 'medium', 'high', 'critical']);

export let pointSchema = v.object({
  title: v.string({ description: 'Short title of the observation' }),
  body: v.string({ description: 'Explanation of the observation' }),
  evidence: evidenceSchema
});

let revisionSchema = v.object({
  object: v.literal('provider.security_review.revision', {
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
  provider_version_id: v.nullable(
    v.string({
      description: 'The provider version that was reviewed',
      examples: ['prv_4dEfGh']
    })
  ),
  number: v.number({
    description: 'Sequential revision number within the review',
    examples: [3]
  }),

  status: v.enumOf(
    ['queued', 'running', 'completed', 'completed_with_gaps', 'failed', 'blocked'],
    {
      description:
        'Lifecycle state. Sections of a running revision appear as they are written; `completed_with_gaps` means some evidence could not be checked.'
    }
  ),
  stage: v.nullable(
    v.enumOf(['collecting', 'verifying', 'analyzing', 'writing'], {
      description: 'Current stage while the revision is running'
    })
  ),
  activity: v.nullable(
    v.string({
      description: 'Short description of what the reviewer is doing right now',
      examples: ['Reading src/tools/sendEmail.ts']
    })
  ),
  block_reason: v.nullable(
    v.enumOf(['billing', 'ai_disabled', 'admin_disabled'], {
      description: 'Why an AI review could not run, when the revision is blocked'
    })
  ),
  awaiting_tools: v.boolean({
    description:
      'Whether the tool list is not yet known, for example because the remote server only lists tools once credentials are connected'
  }),

  ai_generated: v.boolean({ description: 'Whether the report was written by an AI reviewer' }),
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
      'reassess'
    ],
    { description: 'What caused this revision to be created' }
  ),
  trigger_reason: v.nullable(
    v.string({
      description: 'Human-readable explanation of the trigger',
      examples: ['A new version was published.']
    })
  ),

  scores: v.nullable(
    v.object(
      {
        security_score: v.number({
          description: 'How trustworthy and well-built the provider is, from 0 to 100',
          examples: [84]
        }),
        band: v.enumOf(['strong', 'good', 'fair', 'weak', 'poor'], {
          description: 'Label for the security score range'
        }),
        exposure: levelSchema,
        risk: riskSchema,
        confidence: v.enumOf(['low', 'medium', 'high'], {
          description: 'How much of the provider the reviewer could verify'
        }),
        lethal_trifecta: v.boolean({
          description:
            'Whether the tools combine private data access, untrusted input and an external send channel'
        }),
        headline: v.array(v.string(), {
          description: 'Two-part headline: the verdict and the main reason',
          examples: [['Low risk', 'Read-only access to your calendar']]
        }),
        counts: v.object({
          tools_expected: v.number({ description: 'Tools the provider exposes' }),
          tools_reviewed: v.number({ description: 'Tools the reviewer covered' }),
          read_tools: v.number({ description: 'Tools that only read data' }),
          write_tools: v.number({ description: 'Tools that change data' }),
          destructive_tools: v.number({
            description: 'Tools that can delete or irreversibly change data'
          }),
          findings: v.object({
            info: v.number({ description: 'Informational findings' }),
            low: v.number({ description: 'Low severity findings' }),
            medium: v.number({ description: 'Medium severity findings' }),
            high: v.number({ description: 'High severity findings' }),
            critical: v.number({ description: 'Critical findings' })
          }),
          positives: v.number({ description: 'Positive observations' })
        }),
        previous: v.nullable(
          v.object({
            security_score: v.number({
              description: 'Security score of the previous revision'
            }),
            risk: levelSchema
          })
        )
      },
      { description: 'Computed scores; null until the reviewer has submitted its assessment' }
    )
  ),

  report: v.object(
    {
      summary: v.nullable(
        v.object({
          text: v.string({ description: 'Plain-language summary of the provider' }),
          trust_note: v.string({ description: 'Why the provider can or cannot be trusted' }),
          exposure_note: v.string({
            description: 'What the tools could do with the access granted'
          })
        })
      ),
      provenance: v.nullable(
        v.object({
          class: v.enumOf(
            [
              'metorial_built',
              'tenant_code',
              'tenant_image',
              'tenant_remote_vendor_verified',
              'tenant_remote_vendor_plausible',
              'tenant_remote_third_party',
              'tenant_remote_unverifiable',
              'impersonation_suspected'
            ],
            { description: 'Who built and operates the provider' }
          ),
          body: v.string({ description: 'Explanation of the provenance' }),
          evidence: evidenceSchema
        })
      ),
      capabilities: v.nullable(
        v.object({
          tools: v.array(
            v.object({
              key: v.string({ description: 'Tool key' }),
              name: v.nullable(v.string({ description: 'Tool display name' })),
              tags: v.array(
                v.enumOf([
                  'read',
                  'write',
                  'untrusted_input',
                  'destructive',
                  'external_send',
                  'bulk_private_data',
                  'access_control',
                  'financial',
                  'code_execution',
                  'infrastructure'
                ]),
                {
                  description: 'Capabilities of the tool',
                  examples: [['read', 'external_send']]
                }
              ),
              behavior: v.string({ description: 'What the tool actually does' }),
              declared_hints: v.object({
                read_only: v.nullable(v.boolean()),
                destructive: v.nullable(v.boolean()),
                idempotent: v.nullable(v.boolean()),
                open_world: v.nullable(v.boolean())
              }),
              hint_accuracy: v.enumOf(['matches', 'mismatch', 'undeclared'], {
                description: "Whether the tool's declared hints match its behavior"
              })
            })
          )
        })
      ),
      implementation: v.nullable(
        v.object({
          strengths: v.array(pointSchema),
          weaknesses: v.array(pointSchema)
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
      category: v.string({ description: 'Finding category', examples: ['input_validation'] }),
      severity: severitySchema,
      change: v.enumOf(['new', 'persisting', 'resolved'], {
        description: 'How the finding relates to the previous revision'
      }),
      title: v.string({ description: 'Short title' }),
      body: v.string({ description: 'Explanation' }),
      recommendation: v.nullable(v.string({ description: 'Suggested fix' })),
      tool_keys: v.array(v.string(), { description: 'Tools the finding applies to' }),
      evidence: evidenceSchema
    })
  ),

  rules_version: v.string({
    description: 'Version of the scoring rules',
    examples: ['2026.10']
  }),
  prompt_version: v.string({ description: 'Version of the reviewer instructions' }),

  started_at: v.nullable(v.date({ description: 'When the review started running' })),
  completed_at: v.nullable(v.date({ description: 'When the review finished' })),
  created_at: v.date({ description: 'When the revision was created' })
});

export let v1ProviderSecurityReviewRevisionPresenter = Presenter.create(
  providerSecurityReviewRevisionType
)
  .presenter(async d => presentRevision(d))
  .schema(revisionSchema)
  .build();

export let v1ProviderSecurityReviewPresenter = Presenter.create(providerSecurityReviewType)
  .presenter(async ({ review, current, inProgress }) => ({
    object: 'provider.security_review' as const,

    id: review.id,
    provider_id: review.provider?.id ?? null,
    provider_version_id: review.providerVersion?.id ?? null,

    maintained_by:
      review.scope == 'global' ? ('metorial' as const) : ('organization' as const),
    status: review.status == 'deleted' ? ('disabled' as const) : review.status,

    current_revision: current ? presentRevision({ review, revision: current }) : null,
    in_progress_revision: inProgress
      ? presentRevision({ review, revision: inProgress })
      : null,

    last_checked_at: review.lastCheckedAt,
    created_at: review.createdAt,
    updated_at: review.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.security_review', {
        description: "String representing the object's type"
      }),
      id: v.string({
        description: 'Unique identifier of the security review',
        examples: ['srv_5gHjKlMnPqRsTuVw']
      }),
      provider_id: v.nullable(
        v.string({ description: 'The reviewed provider', examples: ['pro_5gHjKlMnPqRsTuVw'] })
      ),
      provider_version_id: v.nullable(
        v.string({
          description: 'The reviewed provider version',
          examples: ['prv_4dEfGhJkLmNpQrSt']
        })
      ),
      maintained_by: v.enumOf(['metorial', 'organization'], {
        description:
          'Reviews of Metorial integrations are maintained by Metorial and shared by every organization; reviews of custom providers belong to the organization'
      }),
      status: v.enumOf(['active', 'outdated', 'disabled'], {
        description: '`outdated` means a newer provider version exists that has its own review'
      }),
      current_revision: v.nullable(revisionSchema),
      in_progress_revision: v.nullable(revisionSchema),
      last_checked_at: v.nullable(
        v.date({
          description:
            'When the review was last verified without finding anything new. Null until the first routine re-check completes'
        })
      ),
      created_at: v.date({ description: 'When the review was created' }),
      updated_at: v.date({ description: 'When the review was last updated' })
    })
  )
  .build();
