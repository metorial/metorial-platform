import { isServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  type SecurityReview,
  type SecurityReviewRevision,
  type SecurityReviewRevisionContext,
  type SecurityReviewRevisionStatus,
  type SecurityReviewStage,
  type SecurityUsageReport
} from '@metorial-subspace/db';
import { getSubspaceSystemProviderEventBase } from '@metorial-subspace/module-tenant';
import { Fabric, type SecurityReviewRunEvent } from '@metorial/fabric';
import {
  createReviewTools,
  createReviewWorkspace,
  createRunState,
  deserializeWorkspace,
  emptyUsage,
  EvidenceLedger,
  ReportDraft,
  type ReviewUsage,
  runReviewAgent
} from '@metorial/review-engine';
import { getUsageReviewTier, reviewModelAccess } from '../definitions/thoroughness';
import { SECURITY_USAGE_PROMPT_VERSION } from '../definitions/versions';
import { sumUsage } from '../lib/agentRun';
import { classifyFindings } from '../lib/findings';
import { STALE_RUNNING_MS, type SecurityReviewRunInput } from '../lib/revisions';
import { redactSecrets, RunLog } from '../lib/runLog';
import { workspaceKeyFor, workspaceStore } from '../lib/storage';
import { assembleUsageReport, computeUsageScores } from '../lib/usage/assemble';
import { resolveUsageBaseRevision } from '../lib/usage/base';
import { type CollectedUsage, collectUsageEvidence } from '../lib/usage/collect';
import { createUsageReportDefinition } from '../lib/usage/definition';
import { buildUsageSystemPrompt, buildUsageUserPrompt } from '../lib/usage/playbook';
import { MIN_USAGE_CALLS } from '../lib/usage/policy';
import { refreshRecentUsage } from '../lib/usage/presence';
import { internalSecurityReviewGateService, type ReviewGate } from './securityReviewGate';
import { internalSecurityReviewStoreService } from './securityReviewStore';

let RUN_TIMEOUT_MS = 10 * 60 * 1000;
let STAGES: SecurityReviewStage[] = ['collecting', 'analyzing', 'writing'];

class BillingBlockedError extends Error {}

let buildReadme = (d: { title: string; usage: CollectedUsage }) =>
  [
    `# Usage review of ${d.title}`,
    '',
    `All data is aggregated over the last ${d.usage.stats.windowDays} days. It contains counts only: no message content, tokens or user data.`,
    '',
    '## Available evidence',
    '',
    '- /evidence/base/report.json: the base review of the provider, with its tool capabilities and findings.',
    '- /evidence/usage/overview.json: total calls, errors, active configs and auth configs.',
    '- /evidence/usage/tools.json: calls and errors per tool, whether the current filters allow it, and its capability tags.',
    '- /evidence/usage/scopes.json: scopes held by connected accounts and whether a called tool needs them.',
    '- /evidence/usage/tool-filters.json: how many filter configurations apply and which tools they block.',
    '- /evidence/usage/protoguard.json: aggregated ProtoGuard matches by filter, severity and tool.',
    '- /evidence/usage/daily.json: calls and errors per day.',
    '- /evidence/provider/: the provider specification and its tool definitions.',
    '- /evidence/facts.json: pre-computed facts and the findings already recorded from them.',
    '',
    `Tools in the specification: ${d.usage.stats.tools.map(tool => tool.key).join(', ') || '(none)'}`
  ].join('\n');

let buildFacts = (usage: CollectedUsage) =>
  JSON.stringify(
    {
      facts: usage.facts,
      findings: usage.findings.map(finding => ({ ...finding, recorded: true }))
    },
    null,
    2
  );

class InternalSecurityUsageReviewRunnerServiceImpl {
  async runUsageReview(d: { review: SecurityReview; input: SecurityReviewRunInput }) {
    let { review, input } = d;
    if (review.status == 'deleted' || review.status == 'disabled') return;
    if (!review.tenantOid || !review.providerOid || !review.instanceOid) return;

    let gate = await internalSecurityReviewGateService.resolveUsageGate({ review });
    if (!gate) return;

    let running = await db.securityReviewRevision.findFirst({
      where: {
        reviewOid: review.oid,
        status: 'running',
        heartbeatAt: { gt: new Date(Date.now() - STALE_RUNNING_MS) }
      },
      select: { oid: true }
    });
    if (running) return;

    await db.securityReviewRevision.updateMany({
      where: { reviewOid: review.oid, status: 'running' },
      data: {
        status: 'failed',
        failureCode: 'abandoned',
        stage: null,
        completedAt: new Date()
      }
    });

    let baseRevision = await resolveUsageBaseRevision({ review });
    if (!baseRevision) return;

    let scope = { instanceOid: review.instanceOid, providerOid: review.providerOid };
    if (input.force) await refreshRecentUsage(scope);

    let usage = await collectUsageEvidence({ review: scope, baseRevision });
    if (usage.stats.calls < (input.force ? 1 : MIN_USAGE_CALLS)) return;

    let rateLimit = await internalSecurityReviewGateService.checkGenerationRateLimit({
      review,
      consume: true
    });
    if (!rateLimit.allowed) return;

    let previous = review.currentRevisionOid
      ? await db.securityReviewRevision.findUnique({
          where: { oid: review.currentRevisionOid }
        })
      : null;
    let previousFindings = await internalSecurityReviewStoreService.previousFindingsFor({
      revisionOid: previous?.oid ?? null
    });

    let context: SecurityReviewRevisionContext = {
      reason: input.reason,
      previousRevisionId: previous?.id,
      usage: usage.snapshot,
      admin: input.admin
        ? { actorId: input.admin.actorId, action: 'rerun', at: new Date().toISOString() }
        : undefined
    };

    let revision = await internalSecurityReviewStoreService.createUsageRevision({
      review,
      baseRevision,
      trigger: input.trigger,
      thoroughness: gate.thoroughness,
      context,
      workspaceKey: workspaceKeyFor({ scope: review.scope, reviewId: review.id })
    });

    let log = new RunLog();
    log.add(
      `usage review started · trigger ${input.trigger}${input.reason ? ` (${input.reason})` : ''} · ${usage.stats.calls} calls · ${usage.stats.tools.length} tools · base revision #${baseRevision.number}`
    );

    let agent: Awaited<ReturnType<typeof this.runAgent>> | null = null;
    try {
      agent = await this.runAgent({ review, revision, gate, usage, previous, log });
    } catch (error) {
      if (error instanceof BillingBlockedError) {
        await db.securityReviewRevision.delete({ where: { oid: revision.oid } });
        return;
      }

      console.error(`Usage review ${review.id} agent run failed`, error);
      log.add('usage review: the agent run errored, keeping the recorded data only');
    }

    let assembled = assembleUsageReport({
      stats: usage.stats,
      recorded: usage.findings,
      draft: agent?.draft ?? null,
      gaps: agent?.gaps ?? [],
      budgetExhausted: agent?.budgetExhausted ?? false
    });

    let findings = classifyFindings({
      findings: assembled.findings,
      previous: previousFindings,
      lockedKeys: new Set()
    });

    let status: SecurityReviewRevisionStatus = agent?.complete
      ? 'completed'
      : 'completed_with_gaps';

    await internalSecurityReviewStoreService.completeUsageRevision({
      review,
      revision,
      completion: {
        status,
        failureCode: agent ? undefined : 'agent_error',
        report: assembled.report,
        scores: assembled.scores,
        findings,
        context: {
          ...context,
          limitations: assembled.report.method?.limitations,
          validationErrors: agent?.gaps.length ? agent.gaps : undefined
        }
      }
    });
  }

  private async runAgent(d: {
    review: SecurityReview;
    revision: SecurityReviewRevision;
    gate: ReviewGate;
    usage: CollectedUsage;
    previous: SecurityReviewRevision | null;
    log: RunLog;
  }) {
    let tier = getUsageReviewTier();
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
    let errorMessage: string | undefined;
    let signal = AbortSignal.timeout(RUN_TIMEOUT_MS);

    try {
      let files: Record<string, string> = {
        ...d.usage.files,
        'README.md': buildReadme({ title: 'this integration', usage: d.usage }),
        'facts.json': buildFacts(d.usage)
      };

      let workspaceKey = workspaceKeyFor({ scope: d.review.scope, reviewId: d.review.id });
      let stored = await workspaceStore.load(workspaceKey);

      let definition = createUsageReportDefinition({
        recordedFindingKeys: d.usage.findings.map(finding => finding.key)
      });
      let draft = new ReportDraft<SecurityUsageReport>(definition);

      let workspace = await createReviewWorkspace({
        abortSignal: signal,
        evidence: files,
        history: d.previous?.usageReport
          ? { 'previous-report.json': JSON.stringify(d.previous.usageReport, null, 2) }
          : {},
        workspace: stored ? deserializeWorkspace(stored) : {},
        report: {}
      });

      let ledger = new EvidenceLedger();
      for (let [path, content] of Object.entries(files)) {
        ledger.addFile(`/evidence/${path}`, content);
      }
      for (let tool of d.usage.stats.tools) ledger.addTool(tool.key);
      for (let fact of d.usage.facts) ledger.addFact(fact);

      let preview = (report: Partial<SecurityUsageReport>) =>
        computeUsageScores({
          stats: d.usage.stats,
          findings: [...(report.findings ?? []), ...d.usage.findings],
          budgetExhausted: false
        });

      let state = createRunState();
      let tools = createReviewTools<SecurityUsageReport>({
        workspace,
        ledger,
        draft,
        state,
        stages: STAGES,
        hooks: {
          onStage: async ({ stage, activity }) =>
            await internalSecurityReviewStoreService.updateUsageRevision({
              revision: d.revision,
              progress: { stage: stage as SecurityReviewStage, activity }
            }),
          onSectionWritten: async ({ report }) =>
            await internalSecurityReviewStoreService.updateUsageRevision({
              revision: d.revision,
              progress: { report, scores: preview(report) }
            }),
          previewScores: async report => {
            let { stats: _stats, ...scores } = preview(report);
            return scores;
          }
        }
      });

      let onStep = async (progress: { usage: ReviewUsage; steps: number }) => {
        await internalSecurityReviewStoreService.updateUsageRevision({
          revision: d.revision,
          progress: {}
        });
        await internalSecurityReviewStoreService.updateRun({
          runOid: run.oid,
          steps: steps + progress.steps,
          usage: sumUsage(spent, progress.usage),
          log: d.log.toString()
        });
      };

      let result = await runReviewAgent({
        model: tier.model,
        modelAccess: reviewModelAccess,
        system: buildUsageSystemPrompt({ definition }),
        prompt: buildUsageUserPrompt({ title: 'this integration' }),
        tools,
        state,
        maxSteps: tier.maxSteps,
        maxCostMicros: tier.maxCostMicros,
        maxFixRounds: tier.maxFixRounds,
        abortSignal: signal,
        onLog: entry => d.log.add(entry),
        onStep
      });
      spent = sumUsage(spent, result.usage);
      steps += result.steps;

      await workspace
        .serializeWorkspace()
        .then(data => workspaceStore.save(workspaceKey, data))
        .catch(error => console.error('Failed to persist usage review workspace', error));

      let budgetExhausted =
        result.outcome == 'cost_budget_exhausted' || result.outcome == 'step_budget_exhausted';
      status = budgetExhausted ? 'budget_exhausted' : 'succeeded';
      d.log.add(
        `run ${status} · ${steps} steps · $${(spent.costMicros / 1_000_000).toFixed(4)} · ${state.submitted ? 'report submitted' : 'no report submitted'}`
      );

      return {
        draft: draft.current,
        complete: state.submitted,
        budgetExhausted,
        gaps: state.submitted ? [] : state.lastErrors
      };
    } catch (error) {
      errorMessage = redactSecrets(
        error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown agent error'
      ).slice(0, 4000);
      d.log.add(`run failed: ${errorMessage}`);
      throw error;
    } finally {
      await internalSecurityReviewStoreService.updateRun({
        runOid: run.oid,
        status,
        errorMessage,
        log: d.log.toString(),
        steps,
        usage: spent,
        billed: !!eventBase
      });

      if (eventBase) {
        await Fabric.fire('security_review.run.completed:after', {
          ...eventBase,
          run: runEvent,
          costMicros: spent.costMicros
        }).catch(error => console.error('Failed to report usage review cost', error));
      }
    }
  }
}

export let internalSecurityUsageReviewRunnerService = Service.create(
  'internalSecurityUsageReviewRunnerService',
  () => new InternalSecurityUsageReviewRunnerServiceImpl()
).build();
