import { getSentry } from '@lowerdeck/sentry';
import { Service } from '@lowerdeck/service';
import type { SessionDataRetentionLevel } from '@metorial-subspace/db';
import { getProtoGuardConfigForEvaluation } from '@metorial-subspace/module-monitor';
import { activeRuleset } from '../definitions/rulesets';
import { getContentHashKey } from '../internal/contentHashKey';
import { syncProtoGuardFilters } from '../lib/filterRegistry';
import { getSessionToolNames } from '../internal/sessionTools';
import {
  deriveCapabilityTags,
  getSizeTier,
  measurePayloadChars,
  projectFinding,
  scanPayload,
  TIME_BUDGET_MS,
  type ScanPayload,
  type ScanResult
} from '../lib/engine';
import { isToolCallMessage, shouldScanMessage } from '../lib/messageScope';
import type { MessageScanDirection, PersistMessageScanJob } from '../lib/persistJob';
import { ScanScheduler, type ScanJobOutcome } from '../lib/scheduler';
import { persistMessageScanQueue } from '../queues/persistMessageScan';

let Sentry = getSentry();

let scanScheduler = new ScanScheduler();

interface ScheduleMessageScanParams {
  message: {
    id: string;
    tenantOid: bigint;
    sessionOid: bigint;
    retentionLevel: SessionDataRetentionLevel;
  };
  methodOrToolKey: string | null;
  tool?: { key: string; name?: string | null; value?: unknown } | null;
  input?: PrismaJson.SessionMessageInput | null;
  output?: PrismaJson.SessionMessageOutput | null;
}

let getDirections = (payload: ScanPayload) => {
  let directions: MessageScanDirection[] = [];
  if (payload.input !== undefined) directions.push('input');
  if (payload.output !== undefined) directions.push('output');

  return directions;
};

let runOnScheduler = (d: {
  payload: ScanPayload;
  chars: number;
  sessionToolNames: string[];
  currentToolName: string | null;
  enabledFamilies: Set<string>;
}) =>
  new Promise<ScanJobOutcome<ScanResult>>(resolve => {
    let maxDurationMs = TIME_BUDGET_MS[getSizeTier(d.chars)];

    scanScheduler.schedule({
      chars: d.chars,
      start: clock =>
        scanPayload({
          ruleset: activeRuleset,
          payload: d.payload,
          context: {
            sessionToolNames: d.sessionToolNames,
            currentToolName: d.currentToolName
          },
          budget: { maxDurationMs, now: clock.now },
          enabledFamilies: d.enabledFamilies
        }),
      onSettled: resolve
    });
  });

class ProtoGuardServiceImpl {
  // Called on the gateway's hot path with the payload still in memory. Content is scanned here and
  // only projected findings leave the process, which is what lets ProtoGuard cover sessions whose
  // retention level forbids storing the payload.
  scheduleMessageScan(d: ScheduleMessageScanParams) {
    let scope = {
      methodOrToolKey: d.methodOrToolKey,
      hasTool: !!d.tool,
      input: d.input,
      output: d.output
    };
    if (!shouldScanMessage(scope)) return;

    setImmediate(() => {
      this.scanMessage({ ...d, isToolCall: isToolCallMessage(scope) }).catch(error =>
        Sentry.captureException(error)
      );
    });
  }

  private async scanMessage(d: ScheduleMessageScanParams & { isToolCall: boolean }) {
    let filters = await syncProtoGuardFilters();
    let config = await getProtoGuardConfigForEvaluation({ tenantOid: d.message.tenantOid });
    if (!config.enabled) return;

    let enabledFamilies = new Set(
      config.filters
        .filter(
          filter => filter.enabled && filter.stage != 'deprecated' && filters.has(filter.key)
        )
        .map(filter => filter.key)
    );
    if (!enabledFamilies.size) return;

    let payload: ScanPayload = {};
    if (d.input) payload.input = d.input.data;
    if (d.output) payload.output = d.output.data;

    let directions = getDirections(payload);
    if (!directions.length) return;

    let [hmacKey, sessionToolNames] = await Promise.all([
      getContentHashKey({ tenantOid: d.message.tenantOid }),
      getSessionToolNames({ sessionOid: d.message.sessionOid })
    ]);

    let chars = measurePayloadChars(payload);
    let outcome = await runOnScheduler({
      payload,
      chars,
      sessionToolNames,
      currentToolName: d.tool?.name ?? d.tool?.key ?? null,
      enabledFamilies
    });

    let base = {
      messageId: d.message.id,
      directions,
      rulesetVersion: activeRuleset.version,
      retentionLevel: d.message.retentionLevel,
      isToolCall: d.isToolCall,
      toolKey: d.tool?.key ?? (d.isToolCall ? d.methodOrToolKey : null),
      capabilityTags: deriveCapabilityTags(d.tool?.value as any)
    };

    await persistMessageScanQueue.add(this.toPersistJob({ base, outcome, chars, hmacKey }), {
      id: `${d.message.id}-${directions.join('-')}`
    });
  }

  private toPersistJob(d: {
    base: Omit<
      PersistMessageScanJob,
      'coverage' | 'skipReason' | 'scannedChars' | 'totalChars' | 'durationMs' | 'findings'
    >;
    outcome: ScanJobOutcome<ScanResult>;
    chars: number;
    hmacKey: string;
  }): PersistMessageScanJob {
    if (d.outcome.type != 'completed') {
      if (d.outcome.type == 'failed') Sentry.captureException(d.outcome.error);

      return {
        ...d.base,
        coverage: 'skipped',
        skipReason: d.outcome.type == 'skipped' ? d.outcome.reason : 'scan_failed',
        scannedChars: 0,
        totalChars: d.chars,
        durationMs: 0,
        findings: []
      };
    }

    let result = d.outcome.result;

    return {
      ...d.base,
      coverage: result.coverage,
      skipReason: result.isBudgetExceeded ? 'time_budget' : null,
      scannedChars: result.scannedChars,
      totalChars: result.totalChars,
      durationMs: Math.round(d.outcome.activeMs),
      findings: result.findings.map(finding =>
        projectFinding(finding, d.base.retentionLevel, { hmacKey: d.hmacKey })
      )
    };
  }
}

export let protoGuardService = Service.create(
  'protoGuardService',
  () => new ProtoGuardServiceImpl()
).build();
