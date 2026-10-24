import { isServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  type SecurityReport,
  type SecurityReview,
  type SecurityReviewFinding,
  type SecurityReviewMode,
  type SecurityReviewRevision,
  type SecurityReviewRevisionContext,
  type SecurityReviewRevisionStatus,
  type SecurityReviewStage,
  type SecurityReviewThoroughness
} from '@metorial-subspace/db';
import { getSubspaceSystemProviderEventBase } from '@metorial-subspace/module-tenant';
import { Fabric, type SecurityReviewRunEvent } from '@metorial/fabric';
import {
  createReviewTools,
  createReviewWorkspace,
  createRunState,
  createWebAccess,
  deserializeWorkspace,
  emptyUsage,
  ReportDraft,
  type ReviewUsage,
  runConsistencyJudge,
  runReviewAgent
} from '@metorial/review-engine';
import { judgeModel, thoroughnessTiers } from '../definitions/thoroughness';
import {
  SECURITY_REVIEW_PROMPT_VERSION,
  SECURITY_REVIEW_RULES_VERSION
} from '../definitions/versions';
import { env } from '../env';
import {
  type AgentRunResult,
  carryOverReport,
  restoreWebSnapshots,
  sumUsage
} from '../lib/agentRun';
import { assembleReport } from '../lib/assemble';
import type { CollectedEvidence } from '../lib/evidence';
import { classifyFindings, isReportStatus, toReportFinding } from '../lib/findings';
import type { SecurityReviewRunInput } from '../lib/revisions';
import { buildSystemPrompt, buildUserPrompt } from '../lib/playbooks';
import { createSecurityReportDefinition } from '../lib/report';
import { workspaceKeyFor, workspaceStore } from '../lib/storage';
import {
  buildEvidenceFiles,
  buildLedger,
  collectEvidence,
  hashEvidence
} from '../lib/subjects';
import { type ReviewGate, internalSecurityReviewGateService } from './securityReviewGate';
import { internalSecurityReviewLeaseService } from './securityReviewLease';
import { internalSecurityReviewMirrorService } from './securityReviewMirror';
import { internalSecurityReviewSinkService } from './securityReviewSink';
import { internalSecurityReviewStoreService } from './securityReviewStore';

let RUN_TIMEOUT_MS = 20 * 60 * 1000;
let STALE_RUNNING_MS = 3 * 60 * 1000;
let HISTORY_REVISIONS = 5;
let JUDGE_FIX_STEPS = 6;
let STAGES: SecurityReviewStage[] = ['collecting', 'verifying', 'analyzing', 'writing'];

let reviewInclude = {
  currentRevision: true,
  providerVersion: { include: { slate: true } }
} as const;

class BillingBlockedError extends Error {}

class InternalSecurityReviewRunnerServiceImpl {
  async runSecurityReview(d: SecurityReviewRunInput) {
    let review = await db.securityReview.findUnique({
      where: { id: d.reviewId },
      include: reviewInclude
    });
    if (!review || review.status == 'deleted' || review.status == 'disabled') return;

    if (review.scope != 'global' || !review.globalId) {
      await this.executeReview({ review, input: d });
      return;
    }

    let globalId = review.globalId;

    await internalSecurityReviewLeaseService.withGlobalReviewLease({
      subjectKey: review.subjectKey,
      fn: async signal => {
        await internalSecurityReviewMirrorService.mirrorGlobalReview({
          globalReviewId: globalId
        });

        let fresh = await db.securityReview.findUniqueOrThrow({
          where: { oid: review.oid },
          include: reviewInclude
        });

        await this.executeReview({ review: fresh, input: d, signal });
      }
    });
  }

  // Staff can lower a run to deterministic checks or change its depth, but never lift a block:
  // billing, AI-analysis and disable settings still apply to staff re-runs.
  private applyAdminOverrides(d: {
    gate: ReviewGate;
    admin?: { mode?: SecurityReviewMode; thoroughness?: SecurityReviewThoroughness };
  }): ReviewGate {
    if (!d.admin || !d.gate.allowAi) return d.gate;
    if (d.admin.mode == 'deterministic') return { ...d.gate, allowAi: false };

    return { ...d.gate, thoroughness: d.admin.thoroughness ?? d.gate.thoroughness };
  }

  private async loadHistory(d: { review: SecurityReview }): Promise<Record<string, string>> {
    let revisions = await db.securityReviewRevision.findMany({
      where: {
        reviewOid: d.review.oid,
        snapshotOfId: null,
        status: { in: ['completed', 'completed_with_gaps', 'blocked'] }
      },
      orderBy: { number: 'desc' },
      take: HISTORY_REVISIONS
    });
    if (!revisions.length) return {};

    let history = revisions.map(revision => ({
      number: revision.number,
      completedAt: revision.completedAt,
      trigger: revision.trigger,
      mode: revision.mode,
      security: revision.securityScore,
      exposure: revision.exposure,
      risk: revision.risk,
      summary: revision.report?.summary?.text ?? null,
      changes: revision.report?.changes?.body ?? null
    }));

    return {
      'revisions.json': JSON.stringify(history, null, 2),
      'previous-report.json': JSON.stringify(revisions[0]!.report ?? {}, null, 2)
    };
  }

  private async runAgent(d: {
    review: SecurityReview;
    revision: SecurityReviewRevision;
    gate: ReviewGate;
    evidence: CollectedEvidence;
    files: Record<string, string>;
    previous: SecurityReviewRevision | null;
    previousFindings: SecurityReviewFinding[];
    lockedFindings: ReturnType<typeof toReportFinding>[];
    input: SecurityReviewRunInput;
    signal?: AbortSignal;
  }): Promise<AgentRunResult> {
    let tier = thoroughnessTiers[d.gate.thoroughness];
    let eventBase = d.gate.billing
      ? await getSubspaceSystemProviderEventBase({
          job: 'security-review',
          instanceOid: d.gate.billing.instanceOid
        })
      : null;

    let run = await internalSecurityReviewStoreService.createRun({
      revision: d.revision,
      model: tier.model.slug,
      maxCostMicros: tier.maxCostMicros,
      isBillable: !!eventBase
    });
    let runEvent: SecurityReviewRunEvent = {
      reviewId: d.review.id,
      revisionId: d.revision.id,
      runId: run.id,
      model: tier.model.slug,
      thoroughness: d.gate.thoroughness,
      maxCostMicros: tier.maxCostMicros
    };

    if (eventBase) {
      try {
        await Fabric.fire('security_review.run.started:before', {
          ...eventBase,
          run: runEvent
        });
      } catch (error) {
        await internalSecurityReviewStoreService.updateRun({
          runOid: run.oid,
          status: 'failed',
          steps: 0,
          usage: emptyUsage()
        });

        if (isServiceError(error) && error.data.status == 402) throw new BillingBlockedError();
        throw error;
      }
    }

    let spent = emptyUsage();
    let steps = 0;
    let status: 'succeeded' | 'failed' | 'budget_exhausted' = 'failed';
    let signal = AbortSignal.any([
      AbortSignal.timeout(RUN_TIMEOUT_MS),
      ...(d.signal ? [d.signal] : [])
    ]);

    try {
      let workspaceKey = workspaceKeyFor({ scope: d.review.scope, reviewId: d.review.id });
      let stored = await workspaceStore.load(workspaceKey);
      let workspaceFiles = stored ? deserializeWorkspace(stored) : {};

      let keepFindingKeys = new Set(
        d.previousFindings
          .filter(
            finding =>
              finding.change != 'resolved' && (finding.origin == 'agent' || finding.isLocked)
          )
          .map(finding => finding.key)
      );
      let initialReport = d.previous?.report
        ? carryOverReport({ report: d.previous.report, keepFindingKeys })
        : undefined;

      let isRecheck = !!d.input.recheck && d.review.scope == 'tenant' && !!initialReport;

      let definition = createSecurityReportDefinition({
        expectedToolKeys: d.evidence.tools?.map(tool => tool.key) ?? null,
        allowedProvenance: d.evidence.allowedProvenance,
        requiresImplementation: d.evidence.kind == 'function' && !!d.evidence.codeReadable,
        hasHistory: !!initialReport,
        previousFindingKeys: [...keepFindingKeys],
        lockedFindings: d.lockedFindings
      });
      let draft = new ReportDraft(definition, initialReport);

      let workspace = await createReviewWorkspace({
        evidence: d.files,
        history: await this.loadHistory({ review: d.review }),
        workspace: workspaceFiles,
        report: Object.fromEntries(
          Object.entries(initialReport ?? {}).map(([section, value]) => [
            `${section}.json`,
            JSON.stringify(value, null, 2)
          ])
        )
      });

      let ledger = buildLedger({ evidence: d.evidence, files: d.files });
      restoreWebSnapshots({ files: workspaceFiles, ledger });

      let preview = (report: Partial<SecurityReport>) =>
        assembleReport({
          evidence: d.evidence,
          draft: report,
          budgetExhausted: false,
          gaps: [],
          previous: d.previous?.scores
            ? { security: d.previous.scores.security, risk: d.previous.scores.risk }
            : undefined,
          lockedFindings: d.lockedFindings
        });

      let state = createRunState();
      let tools = createReviewTools<SecurityReport>({
        workspace,
        ledger,
        draft,
        state,
        stages: STAGES,
        recheck: isRecheck,
        web:
          d.evidence.kind == 'remote'
            ? createWebAccess({
                scout:
                  env.scout.SCOUT_URL && env.scout.SCOUT_TOKEN
                    ? { endpoint: env.scout.SCOUT_URL, token: env.scout.SCOUT_TOKEN }
                    : undefined
              })
            : undefined,
        hooks: {
          onStage: async ({ stage, activity }) =>
            await internalSecurityReviewSinkService.progress({
              review: d.review,
              revision: d.revision,
              progress: { stage: stage as SecurityReviewStage, activity }
            }),
          onSectionWritten: async ({ report }) =>
            await internalSecurityReviewSinkService.progress({
              review: d.review,
              revision: d.revision,
              progress: { report, scores: preview(report).scores }
            }),
          previewScores: async report => preview(report).scores
        }
      });

      let system = buildSystemPrompt({ kind: d.evidence.kind, definition });
      let onStep = async (progress: { usage: ReviewUsage; steps: number }) => {
        await internalSecurityReviewStoreService.updateRun({
          runOid: run.oid,
          steps: steps + progress.steps,
          usage: sumUsage(spent, progress.usage)
        });
      };

      let result = await runReviewAgent({
        model: tier.model,
        system,
        prompt: buildUserPrompt({
          title: d.evidence.title,
          isUpdate: !!initialReport,
          isRecheck,
          reason: d.input.reason,
          changes: d.input.changes
        }),
        tools,
        state,
        maxSteps: tier.maxSteps,
        maxCostMicros: tier.maxCostMicros,
        maxFixRounds: tier.maxFixRounds,
        abortSignal: signal,
        onStep
      });
      spent = sumUsage(spent, result.usage);
      steps += result.steps;

      let unresolvedIssues: string[] = [];
      let unchanged = result.outcome == 'unchanged' ? state.recheck : null;

      if (state.submitted && !unchanged) {
        let judged = await runConsistencyJudge({
          model: judgeModel,
          report: draft.current,
          scores: preview(draft.current).scores,
          abortSignal: signal
        });
        spent = sumUsage(spent, judged.usage);

        let issues = judged.verdict.consistent
          ? []
          : judged.verdict.issues.map(issue => `${issue.section}: ${issue.message}`);

        if (issues.length && spent.costMicros < tier.maxCostMicros) {
          state.submitted = false;

          let fix = await runReviewAgent({
            model: tier.model,
            system,
            prompt: `A consistency check of your submitted report found these problems:\n${issues
              .map(issue => `- ${issue}`)
              .join(
                '\n'
              )}\n\nFix the affected sections with write_section, then submit again.`,
            tools,
            state,
            maxSteps: JUDGE_FIX_STEPS,
            maxCostMicros: tier.maxCostMicros - spent.costMicros,
            maxFixRounds: 1,
            abortSignal: signal,
            onStep
          });
          spent = sumUsage(spent, fix.usage);
          steps += fix.steps;
        }

        if (issues.length && !state.submitted) unresolvedIssues = issues;
      }

      await workspace
        .serializeWorkspace()
        .then(data => workspaceStore.save(workspaceKey, data))
        .catch(error => console.error('Failed to persist security review workspace', error));

      let budgetExhausted =
        result.outcome == 'cost_budget_exhausted' || result.outcome == 'step_budget_exhausted';
      status = budgetExhausted ? 'budget_exhausted' : 'succeeded';

      return {
        draft: draft.current,
        complete: state.submitted && !unresolvedIssues.length,
        budgetExhausted,
        gaps: state.submitted ? [] : [...state.lastErrors, ...unresolvedIssues],
        model: tier.model.slug,
        costMicros: spent.costMicros,
        unchanged
      };
    } finally {
      await internalSecurityReviewStoreService.updateRun({
        runOid: run.oid,
        status,
        steps,
        usage: spent,
        billed: !!eventBase
      });

      if (eventBase) {
        await Fabric.fire('security_review.run.completed:after', {
          ...eventBase,
          run: runEvent,
          costMicros: spent.costMicros
        }).catch(error => console.error('Failed to report security review usage', error));
      }
    }
  }

  private async executeReview(d: {
    review: SecurityReview & {
      currentRevision: SecurityReviewRevision | null;
      providerVersion: { slate: { slateIdOnRegistry: string | null } | null } | null;
    };
    input: SecurityReviewRunInput;
    signal?: AbortSignal;
  }) {
    let { review, input } = d;

    let running = await db.securityReviewRevision.findFirst({
      where: {
        reviewOid: review.oid,
        status: 'running',
        heartbeatAt: { gt: new Date(Date.now() - STALE_RUNNING_MS) }
      },
      select: { oid: true }
    });
    if (running) return;

    if (review.scope == 'tenant') {
      await db.securityReviewRevision.updateMany({
        where: { reviewOid: review.oid, status: 'running' },
        data: {
          status: 'failed',
          failureCode: 'abandoned',
          stage: null,
          completedAt: new Date()
        }
      });
    }

    let gate = this.applyAdminOverrides({
      gate: await internalSecurityReviewGateService.resolveReviewGate({
        review,
        slateRegistryId: review.providerVersion?.slate?.slateIdOnRegistry ?? null
      }),
      admin: input.admin
    });

    let evidence = await collectEvidence({
      review,
      includeTenantSignals: gate.includeTenantSignals
    });
    if (!evidence) return;

    let files = buildEvidenceFiles(evidence);
    let evidenceHash = hashEvidence(files);
    let previous = review.currentRevision;

    let isUnchanged =
      previous &&
      isReportStatus(previous.status) &&
      previous.evidenceHash == evidenceHash &&
      previous.rulesVersion == SECURITY_REVIEW_RULES_VERSION &&
      previous.promptVersion == SECURITY_REVIEW_PROMPT_VERSION &&
      (previous.mode == 'ai' || !gate.allowAi);
    if (isUnchanged && !input.force) return;

    let previousFindings = await internalSecurityReviewStoreService.previousFindingsFor({
      revisionOid: previous?.oid ?? null
    });
    let lockedFindings = previousFindings
      .filter(finding => finding.isLocked && finding.change != 'resolved')
      .map(toReportFinding);

    let context: SecurityReviewRevisionContext = {
      reason: input.reason,
      previousRevisionId: previous?.id,
      changes: input.changes,
      admin: input.admin
        ? { actorId: input.admin.actorId, action: 'rerun', at: new Date().toISOString() }
        : undefined
    };

    let revision = await internalSecurityReviewSinkService.start({
      review,
      start: {
        trigger: input.trigger,
        mode: gate.allowAi ? 'ai' : 'deterministic',
        thoroughness: gate.thoroughness,
        context,
        workspaceKey: workspaceKeyFor({ scope: review.scope, reviewId: review.id })
      }
    });

    let agent: AgentRunResult | null = null;
    let blockReason = gate.blockReason;
    let failureCode: string | undefined;

    if (gate.allowAi) {
      try {
        agent = await this.runAgent({
          review,
          revision,
          gate,
          evidence,
          files,
          previous,
          previousFindings,
          lockedFindings,
          input,
          signal: d.signal
        });
      } catch (error) {
        if (error instanceof BillingBlockedError) {
          blockReason = 'billing';
        } else {
          console.error(`Security review ${review.id} agent run failed`, error);
          failureCode = 'agent_error';
        }
      }
    }

    if (agent?.unchanged && previous) {
      await internalSecurityReviewStoreService.completeRecheck({
        review,
        revision,
        previous,
        evidenceHash
      });
      return;
    }

    let assembled = assembleReport({
      evidence,
      draft: agent?.draft ?? null,
      blockReason,
      budgetExhausted: agent?.budgetExhausted ?? false,
      gaps: agent?.gaps ?? [],
      previous: previous?.scores
        ? { security: previous.scores.security, risk: previous.scores.risk }
        : undefined,
      lockedFindings
    });

    let findings = classifyFindings({
      findings: assembled.findings.map(finding => ({
        finding,
        origin: assembled.origins[finding.key] ?? 'agent'
      })),
      previous: previousFindings,
      lockedKeys: new Set(lockedFindings.map(finding => finding.key))
    });

    await internalSecurityReviewSinkService.complete({
      review,
      revision,
      completion: {
        status: this.completionStatus({ agent, blockReason }),
        mode: agent ? 'ai' : 'deterministic',
        blockReason: agent ? undefined : blockReason,
        failureCode,
        report: assembled.report,
        scores: assembled.scores,
        findings,
        census: evidence.census,
        evidenceHash,
        awaitingTools: evidence.tools === null,
        specificationOid: evidence.specificationOid,
        context: {
          ...context,
          limitations: assembled.report.method?.limitations,
          validationErrors: agent?.gaps.length ? agent.gaps : undefined
        },
        model: agent?.model,
        costMicros: agent?.costMicros ?? 0
      }
    });
  }

  private completionStatus(d: {
    agent: { complete: boolean } | null;
    blockReason?: string;
  }): SecurityReviewRevisionStatus {
    if (d.agent) return d.agent.complete ? 'completed' : 'completed_with_gaps';

    return d.blockReason ? 'blocked' : 'completed_with_gaps';
  }
}

export let internalSecurityReviewRunnerService = Service.create(
  'internalSecurityReviewRunnerService',
  () => new InternalSecurityReviewRunnerServiceImpl()
).build();
