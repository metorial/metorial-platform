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
  createSubmissionVerifier,
  runReviewAgent
} from '@metorial/review-engine';
import {
  getJudgeModel,
  getThoroughnessTier,
  reviewModelAccess
} from '../definitions/thoroughness';
import {
  SECURITY_REVIEW_PROMPT_VERSION,
  SECURITY_REVIEW_RULES_VERSION
} from '../definitions/versions';
import { env } from '../env';
import { containsTokenForReview } from '@metorial-subspace/module-protoguard';
import { securityReviewWebAccessService } from '../services/securityReviewWebAccess';
import {
  type AgentRunResult,
  buildJudgeEvidence,
  carryOverReport,
  restoreWebSnapshots,
  sumUsage
} from '../lib/agentRun';
import { assembleReport } from '../lib/assemble';
import type { CollectedEvidence } from '../lib/evidence';
import { classifyFindings, isReportStatus, toReportFinding } from '../lib/findings';
import { STALE_RUNNING_MS, type SecurityReviewRunInput } from '../lib/revisions';
import { redactSecrets, RunLog } from '../lib/runLog';
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
import { internalSecurityUsageReviewRunnerService } from './securityUsageReviewRunner';

let RUN_TIMEOUT_MS = 20 * 60 * 1000;
let HISTORY_REVISIONS = 5;
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

    if (review.subjectType == 'provider_usage') {
      await internalSecurityUsageReviewRunnerService.runUsageReview({ review, input: d });
      return;
    }

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
    runLog: RunLog;
    onRunCreated: (runOid: bigint) => void;
    signal?: AbortSignal;
  }): Promise<AgentRunResult> {
    let tier = getThoroughnessTier({
      thoroughness: d.gate.thoroughness,
      scope: d.review.scope
    });
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
    d.onRunCreated(run.oid);
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
    let runLog = d.runLog;
    runLog.add(
      `run ${run.id} started · ${d.evidence.kind} "${d.evidence.title}" · ${tier.model.slug} · ${d.gate.thoroughness} · budget $${(tier.maxCostMicros / 1_000_000).toFixed(2)} · up to ${tier.maxSteps} steps · ${Object.keys(d.files).length} evidence files`
    );
    let errorMessage: string | undefined;
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
      let methodChanged =
        !!d.previous &&
        (d.previous.rulesVersion != SECURITY_REVIEW_RULES_VERSION ||
          d.previous.promptVersion != SECURITY_REVIEW_PROMPT_VERSION);
      let initialReport = d.previous?.report
        ? carryOverReport({ report: d.previous.report, keepFindingKeys })
        : undefined;

      if (methodChanged) initialReport = undefined;
      let isRecheck =
        !methodChanged && !!d.input.recheck && d.review.scope == 'tenant' && !!initialReport;

      let definition = createSecurityReportDefinition({
        observations: d.evidence.observations,
        expectedBehaviors: d.evidence.behaviors,
        expectedToolKeys: d.evidence.tools?.map(tool => tool.key) ?? null,
        allowedProvenance: d.evidence.allowedProvenance,
        requiresImplementation: d.evidence.kind == 'function' && !!d.evidence.codeReadable,
        isSkill: d.evidence.kind == 'skill',
        hasHistory: !!d.previous?.report,
        previousFindingKeys: [...keepFindingKeys],
        lockedFindings: d.lockedFindings
      });
      let draft = new ReportDraft(definition, initialReport);

      let workspace = await createReviewWorkspace({
        abortSignal: signal,
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

      let system = buildSystemPrompt({ kind: d.evidence.kind, definition });
      let agentProgress = { usage: emptyUsage(), steps: 0 };
      let onStep = async (progress: { usage: ReviewUsage; steps: number }) => {
        agentProgress = progress;
        await internalSecurityReviewSinkService.progress({
          review: d.review,
          revision: d.revision,
          progress: {}
        });
        await internalSecurityReviewStoreService.updateRun({
          runOid: run.oid,
          steps: progress.steps,
          usage: sumUsage(spent, progress.usage),
          log: runLog.toString()
        });
      };
      let validateSubmission = createSubmissionVerifier<SecurityReport>({
        model: getJudgeModel(),
        modelAccess: reviewModelAccess,
        sectionNames: draft.sectionNames,
        reviewInstructions: system,
        prepare: report => {
          let assembled = preview(report);
          return {
            report: assembled.report,
            scores: assembled.scores,
            evidence: buildJudgeEvidence({ report: assembled.report, files: d.files })
          };
        },
        abortSignal: signal,
        onUsage: usage => {
          spent = sumUsage(spent, usage);
        },
        onLog: async entry => {
          runLog.add(redactSecrets(entry));
          await onStep(agentProgress);
        }
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
                webRiskApiKey: env.scout.GOOGLE_WEB_RISK_API_KEY,
                containsSensitiveText: containsTokenForReview,
                abortSignal: signal,
                onAccess: event =>
                  securityReviewWebAccessService.recordAccess({ runOid: run.oid, event }),
                scout:
                  env.scout.SCOUT_URL && env.scout.SCOUT_TOKEN
                    ? { endpoint: env.scout.SCOUT_URL, token: env.scout.SCOUT_TOKEN }
                    : undefined
              })
            : undefined,
        hooks: {
          validateSubmission,
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
          previewScores: async report => {
            let { scores, findings } = preview(report);
            let { findings: securityFindings, ...counts } = scores.counts;

            return {
              ...scores,
              counts: {
                ...counts,
                securityFindings,
                capabilityObservations: findings.filter(
                  finding => finding.kind == 'capability'
                ).length
              },
              note: 'securityFindings counts only findings of kind security. Capability observations and positives are listed separately and never change the score, so zeros in securityFindings do not mean your capability findings were lost.'
            };
          }
        }
      });

      let result = await runReviewAgent({
        model: tier.model,
        modelAccess: reviewModelAccess,
        system,
        prompt: buildUserPrompt({
          title: d.evidence.title,
          isUpdate: !!initialReport,
          isRecheck,
          methodChanged,
          reason: d.input.reason,
          changes: d.input.changes
        }),
        tools,
        state,
        maxSteps: tier.maxSteps,
        maxCostMicros: tier.maxCostMicros,
        maxFixRounds: tier.maxFixRounds,
        extraCostMicros: () => spent.costMicros,
        abortSignal: signal,
        onLog: entry => runLog.add(entry),
        onStep
      });
      spent = sumUsage(spent, result.usage);
      steps += result.steps;
      runLog.add(
        `agent finished: ${result.outcome} after ${result.steps} steps · ${JSON.stringify(result.modelSteps)} · $${(result.usage.costMicros / 1_000_000).toFixed(4)}`
      );

      let unchanged = result.outcome == 'unchanged' ? state.recheck : null;

      await workspace
        .serializeWorkspace()
        .then(data => workspaceStore.save(workspaceKey, data))
        .catch(error => console.error('Failed to persist security review workspace', error));

      let budgetExhausted =
        result.outcome == 'cost_budget_exhausted' || result.outcome == 'step_budget_exhausted';
      status = budgetExhausted ? 'budget_exhausted' : 'succeeded';
      runLog.add(
        `run ${status}${budgetExhausted ? ` (${result.outcome == 'cost_budget_exhausted' ? 'cost limit' : 'step limit'})` : ''} · ${steps} steps · $${(spent.costMicros / 1_000_000).toFixed(4)} · ${state.submitted ? 'report submitted' : 'no report submitted'}`
      );

      return {
        draft: draft.current,
        complete: state.submitted,
        budgetExhausted,
        gaps: state.submitted ? [] : state.lastErrors,
        model: tier.model.slug,
        costMicros: spent.costMicros,
        unchanged
      };
    } catch (error) {
      errorMessage =
        error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown agent error';
      errorMessage = redactSecrets(errorMessage).slice(0, 4000);
      runLog.add(`run failed: ${errorMessage}`);
      throw error;
    } finally {
      await internalSecurityReviewStoreService.updateRun({
        runOid: run.oid,
        status,
        errorMessage,
        log: runLog.toString(),
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
    let reviewLog = new RunLog();
    let runOid: bigint | undefined;

    if (review.dismissedAt && input.trigger != 'admin') return;
    if (!(await internalSecurityReviewGateService.isReviewGenerationAllowed({ review })))
      return;

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
    if (input.deterministicOnly) gate = { ...gate, allowAi: false };

    let evidence = await collectEvidence({ review });
    if (!evidence) return;

    let files = buildEvidenceFiles(evidence);
    let evidenceHash = hashEvidence(files);
    let previous = review.currentRevision;

    reviewLog.add(
      `review started · ${review.scope} scope · trigger ${input.trigger}${input.reason ? ` (${input.reason})` : ''} · ${gate.allowAi ? `AI review, ${gate.thoroughness}` : `deterministic only${gate.blockReason ? `, blocked: ${gate.blockReason}` : ''}`}`
    );
    reviewLog.add(
      `evidence collected · ${evidence.kind} "${evidence.title}" · ${Object.keys(files).length} files · ${evidence.tools ? `${evidence.tools.length} tools` : 'tools not available yet'} · ${evidence.findings.length} deterministic finding(s) · evidence hash ${evidenceHash.slice(0, 12)}`
    );
    for (let limitation of evidence.limitations)
      reviewLog.add(`evidence limitation: ${limitation}`);

    let isUnchanged =
      previous &&
      isReportStatus(previous.status) &&
      previous.evidenceHash == evidenceHash &&
      previous.rulesVersion == SECURITY_REVIEW_RULES_VERSION &&
      previous.promptVersion == SECURITY_REVIEW_PROMPT_VERSION &&
      (previous.mode == 'ai' || !gate.allowAi);
    if (isUnchanged && !input.force) return;

    let rateLimit = await internalSecurityReviewGateService.checkGenerationRateLimit({
      review,
      consume: true
    });
    if (!rateLimit.allowed) return;

    if (!previous && !input.force && evidence.contentHash) {
      let reused = await this.reuseIdenticalSkillReview({
        review,
        input,
        evidence,
        evidenceHash
      });
      if (reused) return;
    }

    let previousFindings = await internalSecurityReviewStoreService.previousFindingsFor({
      revisionOid: previous?.oid ?? null
    });
    let lockedFindings = previousFindings
      .filter(finding => finding.isLocked && finding.change != 'resolved')
      .map(toReportFinding);
    reviewLog.add(
      `previous revision ${previous ? `#${previous.number} (${previous.status})` : 'none'} · ${previousFindings.length} earlier finding(s) · ${lockedFindings.length} locked`
    );

    if (input.deterministicOnly && review.subjectType == 'skill_version') {
      evidence.limitations.push('The AI review of this version has not run yet.');
    }

    let context: SecurityReviewRevisionContext = {
      reason: input.reason,
      previousRevisionId: previous?.id,
      changes: input.changes,
      admin: input.admin
        ? { actorId: input.admin.actorId, action: 'rerun', at: new Date().toISOString() }
        : undefined,
      skill: evidence.skill
        ? { skillVersionId: evidence.skillVersionId!, ...evidence.skill }
        : undefined
    };

    let revision = await internalSecurityReviewSinkService.start({
      review,
      start: {
        trigger: input.trigger,
        mode: gate.allowAi ? 'ai' : 'deterministic',
        thoroughness: gate.thoroughness,
        context,
        workspaceKey: workspaceKeyFor({ scope: review.scope, reviewId: review.id }),
        skillVersionId: evidence.skillVersionId
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
          runLog: reviewLog,
          onRunCreated: oid => (runOid = oid),
          signal: d.signal
        });
      } catch (error) {
        if (error instanceof BillingBlockedError) {
          blockReason = 'billing';
          reviewLog.add('review blocked: billing');
        } else {
          console.error(`Security review ${review.id} agent run failed`, error);
          failureCode = 'agent_error';
          reviewLog.add(
            'review failed: the agent run errored, falling back to deterministic checks'
          );
        }
      }
    } else {
      reviewLog.add('AI review skipped, assembling deterministic report');
    }

    if (agent?.unchanged && previous) {
      reviewLog.add('recheck found no change, keeping the previous report');
      await this.saveReviewLog({ runOid, log: reviewLog });
      await internalSecurityReviewStoreService.completeRecheck({
        review,
        revision,
        previous,
        evidenceHash
      });
      return;
    }

    let carriedDraft =
      !agent && input.deterministicOnly && previous?.report
        ? carryOverReport({
            report: previous.report,
            keepFindingKeys: new Set(
              previousFindings
                .filter(finding => finding.change != 'resolved' && finding.origin == 'agent')
                .map(finding => finding.key)
            )
          })
        : null;

    let assembled = assembleReport({
      evidence,
      draft: agent?.draft ?? carriedDraft,
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

    let completionStatus = this.completionStatus({
      agent: agent
        ? { complete: agent.complete && !!assembled.scores.assessmentComplete }
        : null,
      blockReason,
      deferred: !!input.deterministicOnly && !failureCode
    });
    reviewLog.add(
      `report assembled · security ${assembled.scores.security} (${assembled.scores.band}) · exposure ${assembled.scores.exposure} · risk ${assembled.scores.risk} · ${findings.length} finding(s) · ${assembled.report.method?.limitations?.length ?? 0} limitation(s)`
    );
    reviewLog.add(`review ${completionStatus}${failureCode ? ` (${failureCode})` : ''}`);
    await this.saveReviewLog({ runOid, log: reviewLog });

    await internalSecurityReviewSinkService.complete({
      review,
      revision,
      completion: {
        status: completionStatus,
        mode: agent ? 'ai' : 'deterministic',
        blockReason: agent ? undefined : blockReason,
        failureCode,
        report: assembled.report,
        scores: assembled.scores,
        findings,
        census: evidence.census,
        evidenceHash,
        contentHash: evidence.contentHash,
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

  private async saveReviewLog(d: { runOid: bigint | undefined; log: RunLog }) {
    if (!d.runOid) return;

    await internalSecurityReviewStoreService
      .setRunLog({ runOid: d.runOid, log: d.log.toString() })
      .catch(error => console.error('Failed to save security review log', error));
  }

  // Forks and duplicates start out identical to a skill this tenant already had reviewed. The
  // agent's verdict carries over without its history, and the deterministic checks and
  // provenance are recomputed for the new skill. Never matches across tenants.
  private async reuseIdenticalSkillReview(d: {
    review: SecurityReview;
    input: SecurityReviewRunInput;
    evidence: CollectedEvidence;
    evidenceHash: string;
  }) {
    let source = await db.securityReviewRevision.findFirst({
      where: {
        contentHash: d.evidence.contentHash,
        mode: 'ai',
        status: { in: ['completed', 'completed_with_gaps'] },
        rulesVersion: SECURITY_REVIEW_RULES_VERSION,
        promptVersion: SECURITY_REVIEW_PROMPT_VERSION,
        review: {
          oid: { not: d.review.oid },
          tenantOid: d.review.tenantOid,
          subjectType: 'skill_version'
        }
      },
      orderBy: { completedAt: 'desc' },
      include: { findings: true }
    });
    if (!source?.report) return false;

    let carried = {
      ...carryOverReport({
        report: source.report,
        keepFindingKeys: new Set(
          source.findings
            .filter(finding => finding.change != 'resolved' && finding.origin == 'agent')
            .map(finding => finding.key)
        )
      }),
      provenance: undefined
    };

    let context: SecurityReviewRevisionContext = {
      reason: d.input.reason,
      skill: d.evidence.skill
        ? { skillVersionId: d.evidence.skillVersionId!, ...d.evidence.skill }
        : undefined
    };

    let revision = await internalSecurityReviewSinkService.start({
      review: d.review,
      start: {
        trigger: d.input.trigger,
        mode: 'ai',
        thoroughness: source.thoroughness,
        context,
        workspaceKey: workspaceKeyFor({ scope: d.review.scope, reviewId: d.review.id }),
        skillVersionId: d.evidence.skillVersionId
      }
    });

    let assembled = assembleReport({
      evidence: d.evidence,
      draft: carried,
      budgetExhausted: false,
      gaps: [],
      lockedFindings: []
    });

    await internalSecurityReviewSinkService.complete({
      review: d.review,
      revision,
      completion: {
        status: source.status,
        mode: 'ai',
        report: assembled.report,
        scores: assembled.scores,
        findings: classifyFindings({
          findings: assembled.findings.map(finding => ({
            finding,
            origin: assembled.origins[finding.key] ?? 'agent'
          })),
          previous: [],
          lockedKeys: new Set()
        }),
        evidenceHash: d.evidenceHash,
        contentHash: d.evidence.contentHash,
        awaitingTools: false,
        context: { ...context, limitations: assembled.report.method?.limitations },
        costMicros: 0
      }
    });

    return true;
  }

  private completionStatus(d: {
    agent: { complete: boolean } | null;
    blockReason?: string;
    deferred?: boolean;
  }): SecurityReviewRevisionStatus {
    if (d.agent) return d.agent.complete ? 'completed' : 'completed_with_gaps';
    if (d.deferred) return 'completed';

    return d.blockReason ? 'blocked' : 'completed_with_gaps';
  }
}

export let internalSecurityReviewRunnerService = Service.create(
  'internalSecurityReviewRunnerService',
  () => new InternalSecurityReviewRunnerServiceImpl()
).build();
