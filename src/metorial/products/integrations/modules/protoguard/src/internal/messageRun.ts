import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type ProtoGuardAlertInstance,
  type ProtoGuardFilter,
  type ProtoGuardSuppression
} from '@metorial-subspace/db';
import {
  alertInternalService,
  getProtoGuardConfigForEvaluation
} from '@metorial-subspace/module-monitor';
import { createHash } from 'node:crypto';
import { env } from '../env';
import {
  scoreFindings,
  type ProjectedFinding,
  type ScoreResult,
  type SessionFinding
} from '../lib/engine';
import { mergeCoverage, type PersistMessageScanJob } from '../lib/persistJob';
import { recordProtoGuardAlertAuditEvent } from './alertAudit';
import { syncProtoGuardFilters } from '../lib/filterRegistry';
import { protoGuardSessionPlaneService } from './sessionPlane';

let ALERT_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;
let SAMPLE_MARKDOWN_MAX_CHARS = 8000;
let SESSION_FINDING_PATH = 'session';

let messageLock = createLock({
  name: 'sub/pg/msg/lock',
  redisUrl: env.service.REDIS_URL
});

type TenantConfig = Awaited<ReturnType<typeof getProtoGuardConfigForEvaluation>>;

type StoredFinding = Omit<ProjectedFinding, 'direction'> & {
  direction: 'input' | 'output' | 'session';
};

interface FindingMetadata {
  hardRule: boolean;
  family: string;
  redactedPath: string;
  decodedSample: string | null;
}

let findScanMessage = (messageId: string) =>
  db.sessionMessage.findUnique({
    where: { id: messageId },
    select: {
      oid: true,
      id: true,
      sessionOid: true,
      connectionOid: true,
      providerRunOid: true,
      tenantOid: true,
      projectOid: true,
      environmentOid: true,
      instanceOid: true,
      solutionOid: true,
      sessionProvider: { select: { providerOid: true } }
    }
  });

type ScanMessage = NonNullable<Awaited<ReturnType<typeof findScanMessage>>>;

let toStoredFindings = (findings: ProjectedFinding[]): StoredFinding[] =>
  findings.flatMap(finding =>
    finding.direction == 'tool_definition'
      ? []
      : [{ ...finding, direction: finding.direction }]
  );

let fromSessionFinding = (finding: SessionFinding): StoredFinding => ({
  ruleKey: finding.ruleKey,
  family: finding.family,
  stage: 'active',
  direction: 'session',
  view: 'raw',
  precision: finding.precision,
  hardRule: finding.hardRule,
  description: finding.description,
  path: SESSION_FINDING_PATH,
  redactedPath: SESSION_FINDING_PATH,
  startOffset: 0,
  endOffset: 0,
  matchedText: null,
  sampleMarkdown: null,
  decodedSample: null,
  contentHmac: finding.contentHmac
});

let getMetadata = (instance: ProtoGuardAlertInstance) =>
  instance.metadata as FindingMetadata | null;

let isSuppressedBy = (
  suppression: ProtoGuardSuppression,
  d: {
    filterOid: bigint;
    providerOid: bigint | null;
    toolKey: string | null;
    contentHmac: string | null;
  }
) =>
  suppression.filterOid == d.filterOid &&
  (suppression.providerOid == null || suppression.providerOid == d.providerOid) &&
  (suppression.toolKey == null || suppression.toolKey == d.toolKey) &&
  (suppression.contentHmac == null || suppression.contentHmac == d.contentHmac);

// The dedup key ignores the message on purpose: the same injection from the same provider keeps
// arriving in new messages and should become one alert with an occurrence count, not a flood.
let createDedupKey = (d: {
  tenantOid: bigint;
  providerOid: bigint | null;
  score: ScoreResult;
  topContentHmac: string | null;
}) =>
  createHash('sha256')
    .update(
      [
        String(d.tenantOid),
        d.providerOid == null ? '' : String(d.providerOid),
        d.score.familyScores.map(family => family.family).join(','),
        d.score.hardRuleKeys.join(','),
        d.topContentHmac ?? ''
      ].join('|')
    )
    .digest('hex');

class ProtoGuardMessageRunServiceImpl {
  async persistMessageScan(d: { job: PersistMessageScanJob }) {
    let message = await findScanMessage(d.job.messageId);
    if (!message) return;

    let config = await getProtoGuardConfigForEvaluation({ tenantOid: message.tenantOid });
    if (!config.enabled) return;

    let filters = await syncProtoGuardFilters();
    let providerOid = message.sessionProvider?.providerOid ?? null;

    let sessionFindings = await protoGuardSessionPlaneService.apply({
      sessionOid: message.sessionOid,
      providerOid,
      messageId: message.id,
      job: d.job
    });
    let findings = [
      ...toStoredFindings(d.job.findings),
      ...sessionFindings.map(fromSessionFinding)
    ];

    let alert = await messageLock.usingLock(message.id, () =>
      this.storeRun({ job: d.job, message, config, filters, providerOid, findings })
    );
    if (!alert) return;

    await alertInternalService.createFromProtoGuardAlert({ protoGuardAlertId: alert.alertId });

    if (alert.isNew) await this.recordAlertAudit({ message, config, ...alert });
  }

  private async storeRun(d: {
    job: PersistMessageScanJob;
    message: ScanMessage;
    config: TenantConfig;
    filters: Map<string, ProtoGuardFilter>;
    providerOid: bigint | null;
    findings: StoredFinding[];
  }) {
    let run = await this.upsertRun(d);

    await this.insertFindings({ ...d, runOid: run.oid });

    let instances = await db.protoGuardAlertInstance.findMany({
      where: { runOid: run.oid },
      orderBy: [{ confidence: 'desc' }, { oid: 'asc' }]
    });
    let score = this.scoreInstances({ instances, config: d.config });
    let liveInstances = instances.filter(
      instance => instance.stage == 'active' && !instance.isSuppressed
    );

    await db.protoGuardRun.update({
      where: { oid: run.oid },
      data: {
        score: score.score,
        maxScore: score.maxScore,
        confidence: score.probability,
        probability: score.probability,
        familyScores: score.familyScores,
        triggeredFilterCount: score.triggeredFamilyCount,
        matchedInstanceCount: liveInstances.length,
        alertFilterCountThreshold: d.config.alertFilterCountThreshold
      }
    });

    if (!score.isAlert || !liveInstances.length) return null;

    let alert = await this.upsertAlert({ ...d, run, score, liveInstances });
    if (!alert) return null;

    return { ...alert, runId: run.id, score, liveInstances };
  }

  private async upsertRun(d: {
    job: PersistMessageScanJob;
    message: ScanMessage;
    config: TenantConfig;
  }) {
    let jobStatus =
      d.job.coverage == 'skipped' ? ('skipped' as const) : ('completed' as const);

    let existing = await db.protoGuardRun.findUnique({
      where: { messageOid: d.message.oid },
      include: { alert: true }
    });

    if (existing) {
      return await db.protoGuardRun.update({
        where: { oid: existing.oid },
        data: {
          status: existing.status == 'skipped' ? jobStatus : existing.status,
          rulesetVersion: d.job.rulesetVersion,
          coverage: mergeCoverage(existing.coverage, d.job.coverage),
          skipReason: existing.skipReason ?? d.job.skipReason,
          scannedChars: (existing.scannedChars ?? 0) + d.job.scannedChars,
          totalChars: (existing.totalChars ?? 0) + d.job.totalChars,
          durationMs: (existing.durationMs ?? 0) + d.job.durationMs
        },
        include: { alert: true }
      });
    }

    return await db.protoGuardRun.create({
      data: {
        ...getId('protoGuardRun'),
        status: jobStatus,

        score: 0,
        maxScore: 0,
        confidence: 0,
        triggeredFilterCount: 0,
        matchedInstanceCount: 0,
        alertFilterCountThreshold: d.config.alertFilterCountThreshold,

        rulesetVersion: d.job.rulesetVersion,
        retentionLevel: d.job.retentionLevel,
        coverage: d.job.coverage,
        skipReason: d.job.skipReason,
        scannedChars: d.job.scannedChars,
        totalChars: d.job.totalChars,
        durationMs: d.job.durationMs,

        messageOid: d.message.oid,
        sessionOid: d.message.sessionOid,
        connectionOid: d.message.connectionOid,
        providerRunOid: d.message.providerRunOid,
        tenantOid: d.message.tenantOid,
        projectOid: d.message.projectOid,
        environmentOid: d.message.environmentOid,
        instanceOid: d.message.instanceOid,
        solutionOid: d.message.solutionOid
      },
      include: { alert: true }
    });
  }

  private async insertFindings(d: {
    job: PersistMessageScanJob;
    message: ScanMessage;
    config: TenantConfig;
    filters: Map<string, ProtoGuardFilter>;
    providerOid: bigint | null;
    findings: StoredFinding[];
    runOid: bigint;
  }) {
    if (!d.findings.length) return;

    let suppressions = await this.listActiveSuppressions({ tenantOid: d.message.tenantOid });
    let thresholdByFamily = new Map(
      d.config.filters.map(filter => [filter.key, filter.alertConfidenceThreshold])
    );

    let rows = d.findings.flatMap(finding => {
      let filter = d.filters.get(finding.family);
      if (!filter) return [];

      let metadata: FindingMetadata = {
        hardRule: finding.hardRule,
        family: finding.family,
        redactedPath: finding.redactedPath,
        decodedSample: finding.decodedSample
      };
      let isSuppressed = suppressions.some(suppression =>
        isSuppressedBy(suppression, {
          filterOid: filter.oid,
          providerOid: d.providerOid,
          toolKey: d.job.toolKey,
          contentHmac: finding.contentHmac
        })
      );

      return [
        {
          ...getId('protoGuardAlertInstance'),
          issueType: filter.issueType,
          severity: filter.severity,

          ruleKey: finding.ruleKey,
          stage: finding.stage,
          direction: finding.direction,
          view: finding.view,

          path: finding.path,
          startOffset: finding.startOffset,
          endOffset: finding.endOffset,
          matchedText: finding.matchedText,
          sampleMarkdown: finding.sampleMarkdown,
          description: finding.description,
          contentHmac: finding.contentHmac,

          confidence: finding.precision,
          confidenceThreshold:
            thresholdByFamily.get(finding.family) ?? filter.alertConfidenceThreshold,
          isSuppressed,

          metadata: { ...metadata },
          runOid: d.runOid,
          filterOid: filter.oid
        }
      ];
    });

    if (rows.length) await db.protoGuardAlertInstance.createMany({ data: rows });
  }

  private scoreInstances(d: { instances: ProtoGuardAlertInstance[]; config: TenantConfig }) {
    return scoreFindings({
      findings: d.instances.map(instance => ({
        ruleKey: instance.ruleKey ?? instance.issueType,
        family: getMetadata(instance)?.family ?? instance.issueType,
        precision: instance.confidence,
        hardRule: getMetadata(instance)?.hardRule ?? false,
        stage: instance.stage,
        isSuppressed: instance.isSuppressed
      })),
      families: d.config.filters
        .filter(filter => filter.enabled)
        .map(filter => ({
          key: filter.key,
          scoreWeight: filter.scoreWeight,
          alertConfidenceThreshold: filter.alertConfidenceThreshold
        })),
      alertProbabilityThreshold: d.config.alertProbabilityThreshold,
      alertFilterCountThreshold: d.config.alertFilterCountThreshold
    });
  }

  private async listActiveSuppressions(d: { tenantOid: bigint }) {
    return await db.protoGuardSuppression.findMany({
      where: {
        tenantOid: d.tenantOid,
        status: 'active',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      }
    });
  }

  private async upsertAlert(d: {
    message: ScanMessage;
    providerOid: bigint | null;
    run: Awaited<ReturnType<ProtoGuardMessageRunServiceImpl['upsertRun']>>;
    score: ScoreResult;
    liveInstances: ProtoGuardAlertInstance[];
  }) {
    let now = new Date();
    let issueTypes = [...new Set(d.liveInstances.map(instance => instance.issueType))].sort();

    // A second scan of the same message (input then output) extends the alert it already has.
    if (d.run.alert) {
      await db.protoGuardAlert.update({
        where: { oid: d.run.alert.oid },
        data: { issueTypes, lastSeenAt: now }
      });
      await db.protoGuardAlertInstance.updateMany({
        where: { runOid: d.run.oid, alertOid: null },
        data: { alertOid: d.run.alert.oid }
      });

      return { alertId: d.run.alert.id, isNew: false, createdAt: d.run.alert.createdAt };
    }

    let dedupKey = createDedupKey({
      tenantOid: d.message.tenantOid,
      providerOid: d.providerOid,
      score: d.score,
      topContentHmac:
        d.liveInstances.find(instance => instance.contentHmac)?.contentHmac ?? null
    });

    let duplicate = await db.protoGuardAlert.findFirst({
      where: {
        tenantOid: d.message.tenantOid,
        dedupKey,
        lastSeenAt: { gte: new Date(now.getTime() - ALERT_DEDUP_WINDOW_MS) }
      },
      orderBy: { lastSeenAt: 'desc' }
    });

    if (duplicate) {
      await db.protoGuardAlert.update({
        where: { oid: duplicate.oid },
        data: { occurrenceCount: { increment: 1 }, lastSeenAt: now }
      });
      return null;
    }

    let alert = await db.protoGuardAlert.create({
      data: {
        ...getId('protoGuardAlert'),
        sampleMarkdown: this.buildAlertSample(d.liveInstances[0]!),
        issueTypes,

        dedupKey,
        occurrenceCount: 1,
        firstSeenAt: now,
        lastSeenAt: now,

        runOid: d.run.oid,
        messageOid: d.message.oid,
        sessionOid: d.message.sessionOid,
        connectionOid: d.message.connectionOid,
        providerRunOid: d.message.providerRunOid,
        tenantOid: d.message.tenantOid,
        projectOid: d.message.projectOid,
        environmentOid: d.message.environmentOid,
        instanceOid: d.message.instanceOid,
        solutionOid: d.message.solutionOid
      }
    });

    await db.protoGuardAlertInstance.updateMany({
      where: { runOid: d.run.oid },
      data: { alertOid: alert.oid }
    });

    return { alertId: alert.id, isNew: true, createdAt: alert.createdAt };
  }

  // Below full retention the projected finding has no sample, so the alert falls back to the
  // redacted path and the ruleset's own description.
  private buildAlertSample(instance: ProtoGuardAlertInstance) {
    let sample =
      instance.sampleMarkdown ??
      `**${getMetadata(instance)?.redactedPath ?? instance.path}**\n\n${instance.description ?? ''}`;

    return sample.slice(0, SAMPLE_MARKDOWN_MAX_CHARS);
  }

  private async recordAlertAudit(d: {
    message: ScanMessage;
    config: TenantConfig;
    alertId: string;
    runId: string;
    createdAt: Date;
    score: ScoreResult;
    liveInstances: ProtoGuardAlertInstance[];
  }) {
    await recordProtoGuardAlertAuditEvent({
      alertId: d.alertId,
      runId: d.runId,
      messageId: d.message.id,
      instanceOid: d.message.instanceOid,
      projectOid: d.message.projectOid,
      alertFilterCountThreshold: d.config.alertFilterCountThreshold,
      score: d.score,
      createdAt: d.createdAt,
      findings: d.liveInstances.map(instance => ({
        ruleKey: instance.ruleKey ?? instance.issueType,
        family: getMetadata(instance)?.family ?? instance.issueType,
        confidence: instance.confidence,
        confidenceThreshold: instance.confidenceThreshold,
        redactedPath: getMetadata(instance)?.redactedPath ?? '*',
        startOffset: instance.startOffset,
        endOffset: instance.endOffset
      }))
    });
  }
}

export let protoGuardMessageRunService = Service.create(
  'protoGuardMessageRunService',
  () => new ProtoGuardMessageRunServiceImpl()
).build();
