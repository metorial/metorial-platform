import { v } from '@lowerdeck/validation';
import type {
  Prisma,
  SecurityLedgerRef,
  SecurityReport,
  SecurityReportPoint,
  SecurityReviewComputedScores,
  SecurityReviewFindingPayload,
  SecurityReviewRevisionContext,
  SecurityToolHints,
  SecurityUsageComputedScores,
  SecurityUsageReport
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
  | { type: 'file'; path: string; lines: number[] | null; excerpt: string | null }
  | { type: 'url'; url: string }
  | { type: 'tool'; tool_key: string }
  | { type: 'note'; label: string; detail: string | null };

// The review workspace paths mean nothing outside the review, so generated evidence files are
// presented under the name of what they contain, and internal ones are not presented at all.
let evidenceFileLabels: [RegExp, string][] = [
  [/^auth\.json$/, 'Authentication methods'],
  [/^spec\.json$/, 'Integration specification'],
  [/^tools\//, 'Tool definitions'],
  [/^deployment\.json$/, 'Deployment configuration'],
  [/^remote\.json$/, 'Remote server configuration'],
  [/^image\.json$/, 'Container image reference'],
  [/^signals\/protoguard\.json$/, 'ProtoGuard alerts'],
  [/^base\/report\.json$/, 'Provider security report'],
  [/^usage\/overview\.json$/, 'Usage overview'],
  [/^usage\/tools\.json$/, 'Tool usage'],
  [/^usage\/scopes\.json$/, 'Granted scopes'],
  [/^usage\/protoguard\.json$/, 'ProtoGuard matches'],
  [/^usage\/daily\.json$/, 'Daily usage'],
  [/^usage\/tool-filters\.json$/, 'Tool filters'],
  [/^docs\/(.+)$/, 'Documentation']
];

let CODE_EVIDENCE_PREFIX = /^\/?evidence\/code\//;
let EVIDENCE_PREFIX = /^\/?evidence\//;

let presentFileEvidence = (
  ref: Extract<SecurityLedgerRef, { type: 'file' }>
): PresentedEvidence[] => {
  if (CODE_EVIDENCE_PREFIX.test(ref.path)) {
    return [
      {
        type: 'file',
        path: ref.path.replace(CODE_EVIDENCE_PREFIX, ''),
        lines: ref.lines ?? null,
        excerpt: ref.excerpt ?? null
      }
    ];
  }

  let path = ref.path.replace(EVIDENCE_PREFIX, '');
  let match = evidenceFileLabels.find(([pattern]) => pattern.test(path));
  if (!match) return [];

  let documentPath = path.match(/^docs\/(.+)$/)?.[1];
  return [
    {
      type: 'note',
      label: documentPath ? `${match[1]}: ${documentPath}` : match[1],
      detail: null
    }
  ];
};

export let presentEvidence = (evidence: SecurityLedgerRef[] | undefined) => {
  let presented = (evidence ?? []).flatMap((ref): PresentedEvidence[] => {
    if (ref.type == 'file') return presentFileEvidence(ref);
    if (ref.type == 'url') return [{ type: 'url', url: ref.url }];
    if (ref.type == 'tool') return [{ type: 'tool', tool_key: ref.key }];
    if (ref.type == 'fact' && ref.title) {
      return [{ type: 'note', label: ref.title, detail: ref.detail ?? null }];
    }
    return [];
  });

  let seen = new Set<string>();
  return presented.filter(item => {
    let key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

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

let presentFindings = (findings: RevisionInput['findings']) =>
  findings.map(finding => {
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
  });

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

    scores: presentScores(revision.scores as SecurityReviewComputedScores | null),
    report: presentReport(revision.report as SecurityReport | null),
    findings: presentFindings(revision.findings),

    started_at: revision.startedAt,
    completed_at: revision.completedAt,
    created_at: revision.createdAt
  };
};

let presentUsageScores = (scores: SecurityUsageComputedScores | null) =>
  scores
    ? {
        exposure: scores.exposure,
        confidence: scores.confidence,
        headline: [...scores.headline],
        counts: {
          tools_allowed: scores.counts.toolsAllowed,
          tools_used: scores.counts.toolsUsed,
          tools_never_used: scores.counts.toolsNeverUsed,
          scopes_granted: scores.counts.scopesGranted,
          scopes_unused: scores.counts.scopesUnused,
          findings: {
            info: scores.counts.findings.info,
            low: scores.counts.findings.low,
            medium: scores.counts.findings.medium,
            high: scores.counts.findings.high,
            critical: scores.counts.findings.critical
          }
        },
        stats: {
          window_days: scores.stats.windowDays,
          calls: scores.stats.calls,
          errors: scores.stats.errors,
          auth_configs: scores.stats.authConfigs,
          configs: scores.stats.configs,
          tools: scores.stats.tools.map(tool => ({
            key: tool.key,
            calls: tool.calls,
            errors: tool.errors,
            allowed: tool.allowed,
            tags: tool.tags
          })),
          scopes: scores.stats.scopes.map(scope => ({
            scope: scope.scope,
            auth_configs: scope.authConfigs,
            required_by_used_tool: scope.requiredByUsedTool
          })),
          protoguard: {
            matches: scores.stats.protoguard.matches,
            alerts: scores.stats.protoguard.alerts,
            filters: scores.stats.protoguard.filters.map(filter => ({
              filter: filter.filter,
              issue_type: filter.issueType,
              severity: filter.severity,
              matches: filter.matches
            }))
          }
        }
      }
    : null;

let presentUsageBody = (
  section: { body: string; evidence: SecurityLedgerRef[] } | undefined
) => (section ? { body: section.body, evidence: presentEvidence(section.evidence) } : null);

let presentUsageReport = (report: SecurityUsageReport | null) => ({
  summary: report?.summary
    ? { text: report.summary.text, exposure_note: report.summary.exposureNote }
    : null,
  observed_exposure: presentUsageBody(report?.observedExposure),
  access: presentUsageBody(report?.access),
  runtime: presentUsageBody(report?.runtime),
  recommendations: (report?.recommendations ?? []).map(presentPoint),
  method: report?.method
    ? { included: report.method.included, limitations: report.method.limitations }
    : null
});

let presentUsageRevision = (d: { review: ReviewInput; revision: RevisionInput }) => {
  let { review, revision } = d;

  return {
    object: 'provider.security_review.usage_revision' as const,

    id: revision.id,
    security_review_id: review.id,
    number: revision.number,

    status: revision.status,
    stage: revision.stage,
    activity: revision.activity,
    block_reason: revision.blockReason,

    scores: presentUsageScores(revision.usageScores as SecurityUsageComputedScores | null),
    report: presentUsageReport(revision.usageReport as SecurityUsageReport | null),
    findings: presentFindings(revision.findings),

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
      ),
      excerpt: v.nullable(v.string({ description: 'The cited lines as they were reviewed' }))
    }),
    v.object({
      type: v.literal('url'),
      url: v.string({ description: 'Web page the reviewer consulted' })
    }),
    v.object({
      type: v.literal('tool'),
      tool_key: v.string({ description: 'Key of the tool the evidence refers to' })
    }),
    v.object({
      type: v.literal('note'),
      label: v.string({ description: 'What the evidence is, in plain words' }),
      detail: v.nullable(v.string({ description: 'What the review found there' }))
    })
  ]),
  { description: 'Evidence the statement is based on' }
);

export let levelSchema = v.enumOf(['unknown', 'low', 'moderate', 'high', 'critical']);
let riskSchema = v.enumOf(['low', 'moderate', 'high', 'critical'], {
  description: 'Overall risk of connecting the provider, combining security and exposure'
});
let capabilityTagSchema = v.enumOf([
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
]);

export let severitySchema = v.enumOf(['info', 'low', 'medium', 'high', 'critical']);

export let pointSchema = v.object({
  title: v.string({ description: 'Short title of the observation' }),
  body: v.string({ description: 'Explanation of the observation' }),
  evidence: evidenceSchema
});

let findingSchema = v.object({
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
              tags: v.array(capabilityTagSchema, {
                description: 'Capabilities of the tool',
                examples: [['read', 'external_send']]
              }),
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

  findings: v.array(findingSchema),

  started_at: v.nullable(v.date({ description: 'When the review started running' })),
  completed_at: v.nullable(v.date({ description: 'When the review finished' })),
  created_at: v.date({ description: 'When the revision was created' })
});

let usageRevisionSchema = v.object({
  object: v.literal('provider.security_review.usage_revision', {
    description: "String representing the object's type"
  }),
  id: v.string({
    description: 'Unique identifier of the usage revision',
    examples: ['srr_4dEfGhJkLmNpQrSt']
  }),
  security_review_id: v.string({
    description: 'The usage review this revision belongs to',
    examples: ['srv_5gHjKlMnPqRsTuVw']
  }),
  number: v.number({
    description: 'Sequential revision number within the usage review',
    examples: [2]
  }),

  status: v.enumOf(
    ['queued', 'running', 'completed', 'completed_with_gaps', 'failed', 'blocked'],
    { description: 'Lifecycle state of the usage revision' }
  ),
  stage: v.nullable(
    v.enumOf(['collecting', 'verifying', 'analyzing', 'writing'], {
      description: 'Current stage while the revision is running'
    })
  ),
  activity: v.nullable(
    v.string({ description: 'Short description of what the reviewer is doing right now' })
  ),
  block_reason: v.nullable(
    v.enumOf(['billing', 'ai_disabled', 'admin_disabled'], {
      description: 'Why the usage review could not run, when the revision is blocked'
    })
  ),

  scores: v.nullable(
    v.object(
      {
        exposure: levelSchema,
        confidence: v.enumOf(['low', 'medium', 'high'], {
          description: 'How much usage data the assessment is based on'
        }),
        headline: v.array(v.string(), {
          description: 'Two-part headline: the observed exposure and the main reason'
        }),
        counts: v.object({
          tools_allowed: v.number({ description: 'Tools the integration allows' }),
          tools_used: v.number({ description: 'Allowed tools that were called' }),
          tools_never_used: v.number({ description: 'Allowed tools that were never called' }),
          scopes_granted: v.number({
            description: 'Distinct scopes granted to connected accounts'
          }),
          scopes_unused: v.number({ description: 'Granted scopes no called tool needs' }),
          findings: v.object({
            info: v.number({ description: 'Informational findings' }),
            low: v.number({ description: 'Low severity findings' }),
            medium: v.number({ description: 'Medium severity findings' }),
            high: v.number({ description: 'High severity findings' }),
            critical: v.number({ description: 'Critical findings' })
          })
        }),
        stats: v.object({
          window_days: v.number({ description: 'Days of usage the assessment covers' }),
          calls: v.number({ description: 'Tool calls in the window' }),
          errors: v.number({ description: 'Tool calls that failed in the window' }),
          auth_configs: v.number({ description: 'Active auth configs' }),
          configs: v.number({ description: 'Active provider configs' }),
          tools: v.array(
            v.object({
              key: v.string({ description: 'Tool key' }),
              calls: v.number({ description: 'Calls in the window' }),
              errors: v.number({ description: 'Failed calls in the window' }),
              allowed: v.boolean({
                description: 'Whether the integration currently allows the tool'
              }),
              tags: v.array(capabilityTagSchema, { description: 'Capabilities of the tool' })
            })
          ),
          scopes: v.array(
            v.object({
              scope: v.string({ description: 'Scope granted to connected accounts' }),
              auth_configs: v.number({ description: 'Auth configs that hold the scope' }),
              required_by_used_tool: v.boolean({
                description: 'Whether a tool that was called needs the scope'
              })
            })
          ),
          protoguard: v.object({
            matches: v.number({ description: 'ProtoGuard matches in the window' }),
            alerts: v.number({ description: 'ProtoGuard alerts in the window' }),
            filters: v.array(
              v.object({
                filter: v.string({ description: 'ProtoGuard filter that matched' }),
                issue_type: v.string({ description: 'Type of issue that matched' }),
                severity: v.string({ description: 'Severity of the match' }),
                matches: v.number({ description: 'Number of matches' })
              })
            )
          })
        })
      },
      {
        description: 'Scores computed from the usage data; null until the review has finished'
      }
    )
  ),

  report: v.object(
    {
      summary: v.nullable(
        v.object({
          text: v.string({ description: 'What the observed usage shows' }),
          exposure_note: v.string({ description: 'What the observed exposure means' })
        })
      ),
      observed_exposure: v.nullable(
        v.object({
          body: v.string({
            description: 'What the called tools can do to connected accounts'
          }),
          evidence: evidenceSchema
        })
      ),
      access: v.nullable(
        v.object({
          body: v.string({ description: 'How granted scopes compare with the scopes used' }),
          evidence: evidenceSchema
        })
      ),
      runtime: v.nullable(
        v.object({
          body: v.string({ description: 'What ProtoGuard matched at runtime' }),
          evidence: evidenceSchema
        })
      ),
      recommendations: v.array(pointSchema),
      method: v.nullable(
        v.object({
          included: v.array(v.string(), { description: 'What the usage review covered' }),
          limitations: v.array(v.string(), { description: 'Known gaps in the usage review' })
        })
      )
    },
    { description: 'Report sections; sections that are not written yet are null' }
  ),

  findings: v.array(findingSchema),

  started_at: v.nullable(v.date({ description: 'When the usage review started running' })),
  completed_at: v.nullable(v.date({ description: 'When the usage review finished' })),
  created_at: v.date({ description: 'When the usage revision was created' })
});

let usageReviewSchema = v.object(
  {
    status: v.enumOf(
      ['disabled', 'waiting_for_review', 'not_enough_data', 'pending', 'running', 'ready'],
      {
        description:
          '`disabled` when usage reviews are off for the project, `waiting_for_review` until the provider has an AI-written security review, `not_enough_data` until the integration has been used enough, `pending` once a review is scheduled and `ready` when a usage review exists'
      }
    ),
    can_run: v.boolean({
      description:
        'Whether a usage review can be started now. Needs a finished security review and at least one tool call in this project, even when there is not enough data for an automatic review'
    }),
    current_revision: v.nullable(usageRevisionSchema),
    in_progress_revision: v.nullable(usageRevisionSchema)
  },
  {
    description:
      'Review of how the integration is actually used in this project, based on aggregated usage data'
  }
);

export let v1ProviderSecurityReviewRevisionPresenter = Presenter.create(
  providerSecurityReviewRevisionType
)
  .presenter(async d => presentRevision(d))
  .schema(revisionSchema)
  .build();

export let v1ProviderSecurityReviewPresenter = Presenter.create(providerSecurityReviewType)
  .presenter(async ({ review, current, inProgress, usage }) => ({
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

    usage_review: usage
      ? {
          status: usage.status,
          can_run: usage.canRun,
          current_revision:
            usage.review && usage.current
              ? presentUsageRevision({ review: usage.review, revision: usage.current })
              : null,
          in_progress_revision:
            usage.review && usage.inProgress
              ? presentUsageRevision({ review: usage.review, revision: usage.inProgress })
              : null
        }
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
      usage_review: v.nullable(usageReviewSchema),
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
